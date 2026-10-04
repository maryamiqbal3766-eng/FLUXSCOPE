from __future__ import annotations

import json
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from .schemas import ShockCandidate, SourceEvidence


ALLOWED_SHOCK_TYPES = {
    "exchange_rate",
    "fuel_price",
    "energy",
    "interest_rate",
    "inflation",
    "input_cost",
    "tax_duty",
    "trade_policy",
}

SYSTEM_PROMPT = """You are FLUXSCOPE's Economic Monitor extraction component.
Extract only economic changes explicitly supported by the supplied approved-source evidence.

Rules:
1. Never invent a statistic, date, source, variable, dependency, or magnitude.
2. Do not calculate a change between two reported values.
   If the evidence explicitly reports a numeric value, copy that reported value
   into magnitude and identify its unit. For example, if the evidence says
   "inflation increased to 11.1 percent", return magnitude 11.1 and unit
   "percent". Do not calculate a difference or derive a value that is not stated.
3. If the document only says a variable increased/decreased but gives no magnitude, leave magnitude null.
4. An unchanged policy rate is not an economic shock event under the current FLUXSCOPE contract.
5. Use only these shock_type values:
   exchange_rate, fuel_price, energy, interest_rate, inflation,
   input_cost, tax_duty, trade_policy.
6. Potential business dependencies are hypotheses for TRACE and must be grounded in the
   evidence/context; do not invent a dependency merely to fill a field.
7. Return JSON only.
8. Return a JSON ARRAY, not a JSON object. Do not wrap the array in a "shocks" field.
9. Each shock object MUST contain these fields:
   shock_type, variable, direction_or_change, magnitude, unit,
   effective_date, potential_dependencies.
10. Use "direction_or_change", not "direction".
11. Use "effective_date", not "date".
12. The "variable" field must identify the economic variable explicitly supported by the evidence.
13. If magnitude, unit, effective date, or dependencies are not explicitly supported by the
    evidence, use null for magnitude/unit/effective_date and [] for potential_dependencies.
14. Do not return source, publisher, title, or evidence fields. The application attaches
    source evidence separately.
15. When a numeric value is explicitly present in the supplied evidence,
    do not return null for magnitude merely because the value is not a
    calculated change. Extract the reported value itself.

Required output shape:
[
  {
    "shock_type": "inflation",
    "variable": "inflation",
    "direction_or_change": "increase",
    "magnitude": null,
    "unit": null,
    "effective_date": null,
    "potential_dependencies": []
  }
]
"""

def build_messages(evidence_text: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Approved economic evidence follows. Extract zero or more candidate shocks.\n\n"
                f"{evidence_text}"
            ),
        },
    ]


class EconomicShockExtractor:
    """LLM extraction boundary. It does not verify or calculate."""

    def __init__(self, llm):
        self.llm = llm

    def extract(
        self,
        *,
        source_id,
        title: str,
        publisher: str,
        source_url: str | None,
        quote: str,
    ) -> list[ShockCandidate]:
        response = self.llm.complete(build_messages(quote))
        payload = self._parse_json(response)
        if not isinstance(payload, list):
            raise ValueError("Economic Monitor output must be a JSON list.")

        candidates: list[ShockCandidate] = []
        for item in payload:
            # An unchanged policy rate is evidence/context, not an Economic Shock Event
            # under the locked DETECT contract.
            if item.get("direction_or_change") == "unchanged":
                continue
            candidates.append(
                self._candidate_from_item(
                    item,
                    source_id=source_id,
                    title=title,
                    publisher=publisher,
                    source_url=source_url,
                    quote=quote,
                )
            )
        return candidates

    @staticmethod
    def _parse_json(response: Any) -> Any:
        if isinstance(response, dict):
            return response
        text = str(response).strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        return json.loads(text)

    @staticmethod
    def _candidate_from_item(
        item: dict[str, Any],
        *,
        source_id,
        title: str,
        publisher: str,
        source_url: str | None,
        quote: str,
    ) -> ShockCandidate:
        shock_type = item.get("shock_type")
        if shock_type not in ALLOWED_SHOCK_TYPES:
            raise ValueError(f"Unsupported shock_type: {shock_type!r}")

        magnitude = item.get("magnitude")
        if magnitude is not None:
            try:
                magnitude = Decimal(str(magnitude))
            except InvalidOperation as exc:
                raise ValueError("magnitude must be numeric when supplied") from exc

        reported_value = item.get("reported_value")
        if reported_value is None and magnitude is not None:
            # The verifier must be able to find the extracted magnitude in
            # the quoted evidence; otherwise an LLM-supplied number could be
            # marked verified without appearing in the source.
            reported_value = format(magnitude.normalize(), "f")
        evidence = SourceEvidence(
            source_id=source_id,
            title=title,
            publisher=publisher,
            source_url=source_url,
            quote=quote,
            variable_text=str(item["variable"]),
            value_text=str(reported_value) if reported_value is not None else None,
            evidence_locator=item.get("evidence_locator"),
        )

        return ShockCandidate(
            shock_type=shock_type,
            variable=str(item["variable"]),
            direction_or_change=item["direction_or_change"],
            magnitude=magnitude,
            unit=item.get("unit"),
            effective_date=date.fromisoformat(item["effective_date"])
            if item.get("effective_date")
            else None,
            source_evidence=[evidence],
            potential_dependencies=list(item.get("potential_dependencies") or []),
        )
