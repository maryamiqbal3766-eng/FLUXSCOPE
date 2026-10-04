from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


ShockType = Literal[
    "exchange_rate",
    "fuel_price",
    "energy",
    "interest_rate",
    "inflation",
    "input_cost",
    "tax_duty",
    "trade_policy",
]

VerificationStatus = Literal["PENDING_VERIFICATION", "VERIFIED", "REJECTED"]
CandidateStatus = Literal["CANDIDATE", "VERIFIED", "REJECTED"]


class SourceDocument(BaseModel):
    """A source document known to the economic evidence layer."""

    model_config = ConfigDict(extra="forbid")

    source_id: UUID = Field(default_factory=uuid4)
    title: str = Field(min_length=1)
    publisher: str = Field(min_length=1)
    published_at: date | None = None
    source_url: str | None = None
    source_domain: str | None = None
    content: str = Field(min_length=1)
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, str] = Field(default_factory=dict)


class SourceEvidence(BaseModel):
    """Exact evidence supporting a candidate shock.

    This is evidence, not a calculated value. The detector must not
    manufacture a number that is absent from the source.
    """

    model_config = ConfigDict(extra="forbid")

    source_id: UUID
    title: str
    publisher: str
    source_url: str | None = None
    quote: str = Field(min_length=1)
    variable_text: str = Field(min_length=1)
    value_text: str | None = None
    evidence_locator: str | None = None


class ShockCandidate(BaseModel):
    """Candidate Economic Shock Event produced by DETECT.

    `magnitude` is optional because the source may report a directional
    change without a numeric magnitude. No arithmetic is performed here.
    """

    model_config = ConfigDict(extra="forbid")

    shock_id: UUID = Field(default_factory=uuid4)
    shock_type: ShockType
    variable: str = Field(min_length=1)
    direction_or_change: Literal["increase", "decrease", "unchanged", "change", "new_policy"] 
    magnitude: Decimal | None = None
    unit: str | None = None
    effective_date: date | None = None
    source_evidence: list[SourceEvidence] = Field(min_length=1)
    potential_dependencies: list[str] = Field(default_factory=list)
    status: CandidateStatus = "CANDIDATE"
    verification_status: VerificationStatus = "PENDING_VERIFICATION"
    verification_notes: list[str] = Field(default_factory=list)
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("magnitude")
    @classmethod
    def magnitude_must_be_finite(cls, value: Decimal | None):
        if value is not None and not value.is_finite():
            raise ValueError("magnitude must be finite")
        return value


class VerificationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: VerificationStatus
    reasons: list[str] = Field(default_factory=list)
    verified_at: datetime | None = None
