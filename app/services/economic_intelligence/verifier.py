from __future__ import annotations

import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from .schemas import ShockCandidate, VerificationResult
from .source_registry import ApprovedSourceRegistry


class EconomicEvidenceVerifier:
    """Verifies provenance and evidence presence without doing new arithmetic."""

    def __init__(self, registry: ApprovedSourceRegistry | None = None):
        self.registry = registry or ApprovedSourceRegistry()

    def verify(self, candidate: ShockCandidate) -> VerificationResult:
        reasons: list[str] = []

        for evidence in candidate.source_evidence:
            if not self.registry.is_approved(
                publisher=evidence.publisher,
                url=evidence.source_url,
            ):
                reasons.append(
                    f"Source is not approved for DETECT: {evidence.publisher}"
                )
                continue

            if not evidence.quote.strip():
                reasons.append("Evidence quote is empty.")
                continue

            # The extracted variable/value must be supported by the quoted
            # evidence. We deliberately do not derive a new number here.
            haystack = evidence.quote.lower()
            variable_tokens = self._meaningful_tokens(evidence.variable_text)
            if variable_tokens and not all(token in haystack for token in variable_tokens):
                reasons.append(
                    "Variable text is not sufficiently represented in the evidence quote."
                )

            if evidence.value_text:
                # Compare whole numbers, not substrings: "20" must not match
                # "2026" and "1" must not match "11.1".
                value_numbers = self._numbers(evidence.value_text)
                if value_numbers and not value_numbers & self._numbers(evidence.quote):
                    reasons.append(
                        "Reported value text is not present in the evidence quote."
                    )

            # A percentage unit must be stated by the evidence; a level such as
            # "300 rupees" must not become a "300 percent" change.
            unit = (candidate.unit or "").lower()
            if ("%" in unit or "percent" in unit) and not (
                "%" in haystack or "percent" in haystack
            ):
                reasons.append(
                    "The percentage unit is not stated in the evidence quote."
                )

        if reasons:
            return VerificationResult(status="REJECTED", reasons=reasons)

        return VerificationResult(
            status="VERIFIED",
            reasons=["Approved source and value/variable evidence checks passed."],
            verified_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def _meaningful_tokens(text: str) -> set[str]:
        return {
            token for token in re.findall(r"[a-z0-9]+", text.lower())
            if len(token) >= 3
        }

    @staticmethod
    def _numbers(text: str) -> set[Decimal]:
        """Whole numeric values in the text (thousands separators allowed), unsigned."""
        numbers: set[Decimal] = set()
        for token in re.findall(r"(?<![\d.])\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\d.,])\d+(?:\.\d+)?", text):
            try:
                numbers.add(abs(Decimal(token.replace(",", ""))).normalize())
            except InvalidOperation:
                continue
        return numbers
