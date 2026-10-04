from __future__ import annotations

import json
import re
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
    effective_date must be an ISO date (YYYY-MM-DD) and only when the evidence states an
    exact calendar day; for a month, period, or vague timing use null.
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
            if not isinstance(item, dict):
                raise ValueError("Each Economic Monitor item must be a JSON object.")
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
        # Accept a Markdown code fence, on one line or several.
        fenced = re.fullmatch(r"```[A-Za-z]*\s*(.*?)\s*```", text, flags=re.DOTALL)
        if fenced:
            text = fenced.group(1)
        return json.loads(text)

    @staticmethod
    def _string_list(value: Any) -> list[str]:
        if value is None:
            return []
        if not isinstance(value, list) or not all(isinstance(entry, str) for entry in value):
            raise ValueError("potential_dependencies must be a list of strings.")
        return value

    @staticmethod
    def _exact_date(value: Any) -> date | None:
        """Accept only an exact ISO calendar date.

        Sources often state timing as a month or period ("September 2026").
        That is not an exact effective date, so it is treated as not stated
        rather than guessed or allowed to fail the whole detection.
        """

        if not value:
            return None
        try:
            return date.fromisoformat(str(value).strip())
        except ValueError:
            return None

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

        # The verifier checks the number that will actually be used: the
        # magnitude. An LLM-supplied "reported_value" must never stand in for
        # it, or a different number could be verified than the one calculated.
        reported_value = (
            format(magnitude.normalize(), "f")
            if magnitude is not None
            else item.get("reported_value")
        )
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
            effective_date=EconomicShockExtractor._exact_date(item.get("effective_date")),
            source_evidence=[evidence],
            potential_dependencies=EconomicShockExtractor._string_list(
                item.get("potential_dependencies")
            ),
        )
