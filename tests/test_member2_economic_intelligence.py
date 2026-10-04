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


def test_non_exact_effective_date_is_treated_as_not_stated():
    """Real model output (openai/gpt-oss-120b) copied a month as the date."""
    from app.services.economic_intelligence.extractor import EconomicShockExtractor

    class RealShapeLLM:
        def complete(self, messages):
            return (
                '[{"shock_type": "exchange_rate", "variable": "USD/PKR exchange rate", '
                '"direction_or_change": "increase", "magnitude": 4.5, "unit": "percent", '
                '"effective_date": "September 2026", "potential_dependencies": []}]'
            )

    result = EconomicShockExtractor(RealShapeLLM()).extract(
        source_id=uuid4(),
        title="SBP statement",
        publisher="State Bank of Pakistan",
        source_url="https://www.sbp.org.pk/example",
        quote="The USD/PKR exchange rate increased by 4.5 percent during September 2026.",
    )
    assert len(result) == 1
    assert result[0].effective_date is None
    assert result[0].magnitude == Decimal("4.5")


def number_candidate(magnitude: str, quote: str) -> ShockCandidate:
    source = approved_source()
    return ShockCandidate(
        shock_type="exchange_rate",
        variable="exchange rate",
        direction_or_change="increase",
        magnitude=Decimal(magnitude),
        unit="percent",
        source_evidence=[
            SourceEvidence(
                source_id=source.source_id,
                title=source.title,
                publisher=source.publisher,
                source_url=source.source_url,
                quote=quote,
                variable_text="exchange rate",
                value_text=magnitude,
            )
        ],
    )


def test_value_must_match_a_whole_number_not_a_substring():
    verifier = EconomicEvidenceVerifier()
    assert verifier.verify(number_candidate("20", "In 2026 the exchange rate increased.")).status == "REJECTED"
    assert verifier.verify(number_candidate("1", "The exchange rate rose 11.1 percent.")).status == "REJECTED"
    assert verifier.verify(number_candidate("4.50", "The exchange rate increased by 4.5 percent.")).status == "VERIFIED"
    assert verifier.verify(number_candidate("1250", "The exchange rate moved 1,250 percent.")).status == "VERIFIED"


def test_llm_reported_value_cannot_replace_the_checked_magnitude():
    from app.services.economic_intelligence.extractor import EconomicShockExtractor

    class InjectedLLM:
        def complete(self, messages):
            return (
                '[{"shock_type": "exchange_rate", "variable": "exchange rate", '
                '"direction_or_change": "increase", "magnitude": 50, "reported_value": "5", '
                '"unit": "percent", "effective_date": null, "potential_dependencies": []}]'
            )

    candidate = EconomicShockExtractor(InjectedLLM()).extract(
        source_id=uuid4(),
        title="SBP statement",
        publisher="State Bank of Pakistan",
        source_url="https://www.sbp.org.pk/example",
        quote="The exchange rate increased by 5 percent.",
    )[0]
    assert candidate.source_evidence[0].value_text == "50"
    assert EconomicEvidenceVerifier().verify(candidate).status == "REJECTED"


def test_malformed_llm_items_are_rejected_not_coerced():
    from app.services.economic_intelligence.extractor import EconomicShockExtractor

    class Malformed:
        def __init__(self, text):
            self.text = text

        def complete(self, messages):
            return self.text

    for text in (
        "[1]",
        '[{"shock_type": "exchange_rate", "variable": "x", "direction_or_change": "increase", '
        '"magnitude": null, "potential_dependencies": "abc"}]',
    ):
        with pytest.raises(ValueError):
            EconomicShockExtractor(Malformed(text)).extract(
                source_id=uuid4(), title="t", publisher="p", source_url=None, quote="x"
            )


def test_single_line_code_fence_is_parsed():
    from app.services.economic_intelligence.extractor import EconomicShockExtractor

    assert EconomicShockExtractor._parse_json('```json [{"a": 1}]```') == [{"a": 1}]
    assert EconomicShockExtractor._parse_json('```\n[{"a": 1}]\n```') == [{"a": 1}]


def test_percent_unit_must_be_stated_in_the_evidence():
    verifier = EconomicEvidenceVerifier()
    level = number_candidate("300", "The exchange rate reached 300 rupees per US dollar.")
    assert verifier.verify(level).status == "REJECTED"
    change = number_candidate("5", "The exchange rate increased by 5% this month.")
    assert verifier.verify(change).status == "VERIFIED"


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
