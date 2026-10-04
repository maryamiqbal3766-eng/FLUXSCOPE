from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest

from app.services.economic_intelligence.schemas import SourceDocument, ShockCandidate, SourceEvidence
from app.services.economic_intelligence.source_registry import ApprovedSourceRegistry
from app.services.economic_intelligence.verifier import EconomicEvidenceVerifier


def approved_source() -> SourceDocument:
    return SourceDocument(
        title="Approved SBP evidence",
        publisher="State Bank of Pakistan",
        published_at=date(2026, 9, 14),
        source_url="https://www.sbp.org.pk/example",
        content="The statement reports that inflation increased during the period.",
    )


def test_approved_source_registry_accepts_sbp_domain():
    registry = ApprovedSourceRegistry()
    assert registry.is_approved(
        publisher="State Bank of Pakistan",
        url="https://www.sbp.org.pk/example",
    )


def test_unapproved_domain_is_rejected():
    registry = ApprovedSourceRegistry()
    assert not registry.is_approved(
        publisher="State Bank of Pakistan",
        url="https://example.com/evidence",
    )


def test_evidence_value_must_be_present_when_reported():
    verifier = EconomicEvidenceVerifier()
    source = approved_source()
    candidate = ShockCandidate(
        shock_type="inflation",
        variable="inflation",
        direction_or_change="increase",
        magnitude=Decimal("11.1"),
        unit="percent",
        source_evidence=[
            SourceEvidence(
                source_id=source.source_id,
                title=source.title,
                publisher=source.publisher,
                source_url=source.source_url,
                quote="Inflation increased during the period.",
                variable_text="inflation",
                value_text="11.1%",
            )
        ],
    )
    result = verifier.verify(candidate)
    assert result.status == "REJECTED"
    assert any("value" in reason.lower() for reason in result.reasons)


def test_no_value_does_not_create_a_value():
    verifier = EconomicEvidenceVerifier()
    source = approved_source()
    candidate = ShockCandidate(
        shock_type="inflation",
        variable="inflation",
        direction_or_change="increase",
        magnitude=None,
        unit=None,
        source_evidence=[
            SourceEvidence(
                source_id=source.source_id,
                title=source.title,
                publisher=source.publisher,
                source_url=source.source_url,
                quote="Inflation increased during the period.",
                variable_text="inflation",
                value_text=None,
            )
        ],
    )
    result = verifier.verify(candidate)
    assert result.status == "VERIFIED"


def test_model_rejects_non_finite_magnitude():
    with pytest.raises(ValueError):
        ShockCandidate(
            shock_type="inflation",
            variable="inflation",
            direction_or_change="increase",
            magnitude=Decimal("NaN"),
            source_evidence=[],
        )


def test_unchanged_policy_rate_is_not_an_economic_shock_event():
    from app.services.economic_intelligence.extractor import EconomicShockExtractor

    class FakeLLM:
        def complete(self, messages):
            return '[{"shock_type":"interest_rate","variable":"policy rate","direction_or_change":"unchanged","magnitude":null}]'

    result = EconomicShockExtractor(FakeLLM()).extract(
        source_id=uuid4(),
        title="SBP statement",
        publisher="State Bank of Pakistan",
        source_url="https://www.sbp.org.pk/example",
        quote="The policy rate remains unchanged.",
    )
    assert result == []
