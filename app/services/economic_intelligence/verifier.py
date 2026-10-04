from __future__ import annotations

import re
from datetime import datetime, timezone

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
                value_tokens = self._normalized_value_tokens(evidence.value_text)
                if value_tokens and not any(token in haystack for token in value_tokens):
                    reasons.append(
                        "Reported value text is not present in the evidence quote."
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
    def _normalized_value_tokens(text: str) -> set[str]:
        return {
            token.replace(",", "")
            for token in re.findall(r"[-+]?\d+(?:[.,]\d+)?%?", text.lower())
        }
