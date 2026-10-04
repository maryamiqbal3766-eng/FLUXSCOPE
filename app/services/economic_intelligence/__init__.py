"""TADBIR Member 2: Economic Intelligence + RAG (DETECT)."""
from .schemas import (
    SourceDocument,
    SourceEvidence,
    ShockCandidate,
    VerificationResult,
)
from .source_registry import ApprovedSourceRegistry
from .verifier import EconomicEvidenceVerifier
from .retrieval import LocalEconomicRetriever
from .monitor import EconomicMonitor, UnapprovedSourceError
from .extractor import EconomicShockExtractor
from .service import EconomicIntelligenceService

__all__ = [
    "SourceDocument",
    "EconomicShockExtractor",
    "SourceEvidence",
    "ShockCandidate",
    "VerificationResult",
    "ApprovedSourceRegistry",
    "EconomicEvidenceVerifier",
    "LocalEconomicRetriever",
    "EconomicMonitor",
    "UnapprovedSourceError",
    "EconomicIntelligenceService",
]
