from datetime import date, datetime, timezone
from enum import Enum
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


NonEmpty = Annotated[str, Field(min_length=1)]
DecimalString = Annotated[str, Field(pattern=r"^-?\d+(\.\d+)?$")]


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WorkflowStage(str, Enum):
    DETECT = "DETECT"
    TRACE = "TRACE"
    QUANTIFY = "QUANTIFY"
    SIMULATE = "SIMULATE"
    COMPARE = "COMPARE"
    RESPOND = "RESPOND"
    MONITOR = "MONITOR"


class VerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    UNVERIFIABLE = "unverifiable"
    REJECTED = "rejected"


class IntakeStatus(str, Enum):
    DRAFT = "draft"
    CLARIFICATION_REQUIRED = "clarification_required"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class AssumptionConfirmationStatus(str, Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class DecisionStatus(str, Enum):
    NOT_SELECTED = "not_selected"
    SELECTED = "selected"
    CONFIRMED = "confirmed"
    WITHDRAWN = "withdrawn"


class ProcessingStatus(str, Enum):
    READY = "ready"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    FAILED = "failed"


class ProvenanceRecord(ContractModel):
    source_name: NonEmpty
    source_url_or_reference: NonEmpty
    retrieved_at: datetime
    published_at: datetime | date | None = None
    source_excerpt_or_locator: NonEmpty | None = None
    verification_status: VerificationStatus


class EconomicShockCreate(ContractModel):
    shock_type: NonEmpty
    economic_variable: NonEmpty
    direction_or_change: NonEmpty
    observed_or_effective_date: date
    provenance: list[ProvenanceRecord] = Field(min_length=1)
    verification_status: VerificationStatus = VerificationStatus.PENDING
    magnitude: DecimalString | None = None
    unit: NonEmpty | None = None
    period: NonEmpty | None = None
    source_notes: str | None = None

    @model_validator(mode="after")
    def verified_shock_has_verified_provenance(self) -> "EconomicShockCreate":
        if self.verification_status == VerificationStatus.VERIFIED and not any(
            item.verification_status == VerificationStatus.VERIFIED for item in self.provenance
        ):
            raise ValueError("A verified shock requires verified provenance.")
        return self


class EconomicShockEvent(EconomicShockCreate):
    id: UUID = Field(default_factory=uuid4)
    workflow_stage: Literal[WorkflowStage.DETECT] = WorkflowStage.DETECT
    processing_status: ProcessingStatus = ProcessingStatus.READY
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class BusinessFact(ContractModel):
    """A supplied fact remains text/decimal data until the owner confirms it."""

    value: NonEmpty
    unit: NonEmpty | None = None


class IntakeDraftCreate(ContractModel):
    submitted_fields: dict[NonEmpty, BusinessFact] = Field(min_length=1)


class BusinessIntakeDraft(IntakeDraftCreate):
    id: UUID = Field(default_factory=uuid4)
    business_id: UUID
    intake_status: IntakeStatus = IntakeStatus.DRAFT
    workflow_stage: Literal[WorkflowStage.TRACE] = WorkflowStage.TRACE
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class BusinessProfile(ContractModel):
    id: UUID = Field(default_factory=uuid4)
    business_id: UUID
    confirmed_fields: dict[NonEmpty, BusinessFact] = Field(min_length=1)
    source_intake_draft_ids: list[UUID] = Field(min_length=1)
    business_confirmation_status: Literal[IntakeStatus.CONFIRMED] = IntakeStatus.CONFIRMED
    workflow_stage: Literal[WorkflowStage.TRACE] = WorkflowStage.TRACE
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ImpactMappingRequest(ContractModel):
    shock_event_id: UUID
    business_id: UUID


class ImpactResultRequest(ContractModel):
    shock_event_id: UUID
    impact_mapping_id: UUID
    business_input_ids: list[UUID] = Field(min_length=1)
    assumption_ids: list[UUID] = Field(default_factory=list)


class ScenarioAssumption(ContractModel):
    field_reference: NonEmpty
    value: NonEmpty
    unit: NonEmpty | None = None


class ScenarioCreate(ContractModel):
    base_impact_result_id: UUID
    business_id: UUID
    name: NonEmpty
    changed_assumptions: list[ScenarioAssumption] = Field(min_length=1)


class ScenarioDefinition(ScenarioCreate):
    id: UUID = Field(default_factory=uuid4)
    assumption_confirmation_status: AssumptionConfirmationStatus = AssumptionConfirmationStatus.DRAFT
    processing_status: ProcessingStatus = ProcessingStatus.READY
    workflow_stage: Literal[WorkflowStage.SIMULATE] = WorkflowStage.SIMULATE
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ScenarioUpdate(ContractModel):
    name: NonEmpty | None = None
    changed_assumptions: list[ScenarioAssumption] | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def contains_a_change(self) -> "ScenarioUpdate":
        if self.name is None and self.changed_assumptions is None:
            raise ValueError("At least one scenario field must be provided.")
        return self


class DecisionCreate(ContractModel):
    business_id: UUID
    comparison_set_id: UUID
    selected_scenario_id: UUID | None = None
    owner_defined_response: NonEmpty | None = None

    @model_validator(mode="after")
    def has_exactly_one_response(self) -> "DecisionCreate":
        if (self.selected_scenario_id is None) == (self.owner_defined_response is None):
            raise ValueError(
                "Provide exactly one selected scenario or owner-defined response."
            )
        return self


class HumanDecision(DecisionCreate):
    id: UUID = Field(default_factory=uuid4)
    decision_status: DecisionStatus = DecisionStatus.SELECTED
    owner_confirmation_reference: NonEmpty | None = None
    decided_at: datetime | None = None
    workflow_stage: Literal[WorkflowStage.RESPOND] = WorkflowStage.RESPOND
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class DecisionConfirmation(ContractModel):
    owner_confirmation_reference: NonEmpty


class ComparisonCreate(ContractModel):
    business_id: UUID
    base_impact_result_id: UUID
    scenario_result_ids: list[UUID] = Field(min_length=1)


class MonitoringRecordCreate(ContractModel):
    business_id: UUID
    human_decision_id: UUID
    metric_name: NonEmpty
    actual_value: DecimalString
    unit: NonEmpty
    observed_at: datetime
    provenance_or_business_input_reference: NonEmpty


class ProjectionComparisonRequest(ContractModel):
    business_id: UUID
    human_decision_id: UUID
    monitoring_record_ids: list[UUID] = Field(min_length=1)


class MessageResponse(ContractModel):
    message: NonEmpty
    processing_status: ProcessingStatus
    details: dict[str, Any] = Field(default_factory=dict)
