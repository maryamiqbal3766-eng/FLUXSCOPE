from __future__ import annotations

from .extractor import EconomicShockExtractor
from .retrieval import LocalEconomicRetriever
from .schemas import ShockCandidate, SourceDocument
from .verifier import EconomicEvidenceVerifier


class UnapprovedSourceError(ValueError):
    """Raised when a source is not on the approved-source registry."""


class EconomicMonitor:
    """Bounded DETECT component.

    Flow:
    source document -> retrieval context -> extraction -> evidence verification.
    It never performs business-specific financial calculations.
    """

    def __init__(
        self,
        *,
        retriever: LocalEconomicRetriever,
        extractor: EconomicShockExtractor,
        verifier: EconomicEvidenceVerifier,
    ):
        self.retriever = retriever
        self.extractor = extractor
        self.verifier = verifier

    def detect_from_source(
        self,
        source: SourceDocument,
        *,
        query: str = "economic change exchange rate fuel energy inflation interest rate tax duty trade policy",
        top_k: int = 5,
    ) -> list[ShockCandidate]:
        if not self.verifier.registry.is_approved(
            publisher=source.publisher,
            url=source.source_url,
        ):
            raise UnapprovedSourceError("Source is not approved for TADBIR DETECT.")

        self.retriever.add_source(source)
        # Only this document's chunks may be cited as this document's evidence.
        retrieved = self.retriever.retrieve(
            query,
            top_k=top_k,
            source_id=str(source.source_id),
        )
        if not retrieved:
            return []

        # Preserve exact source evidence from retrieved chunks.
        candidates: list[ShockCandidate] = []
        for item in retrieved:
            extracted = self.extractor.extract(
                source_id=source.source_id,
                title=source.title,
                publisher=source.publisher,
                source_url=source.source_url,
                quote=item.chunk.text,
            )
            for candidate in extracted:
                verification = self.verifier.verify(candidate)
                if verification.status == "VERIFIED":
                    candidate.status = "VERIFIED"
                    candidate.verification_status = "VERIFIED"
                    candidate.verification_notes = verification.reasons
                else:
                    candidate.verification_status = verification.status
                    candidate.verification_notes = verification.reasons
                candidates.append(candidate)

        return self._deduplicate(candidates)

    @staticmethod
    def _deduplicate(candidates: list[ShockCandidate]) -> list[ShockCandidate]:
        seen: set[tuple] = set()
        result: list[ShockCandidate] = []
        for item in candidates:
            key = (
                item.shock_type,
                item.variable.lower(),
                item.direction_or_change,
                str(item.magnitude),
                item.effective_date,
            )
            if key not in seen:
                seen.add(key)
                result.append(item)
        return result
