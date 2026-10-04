from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.models.domain import (
    BusinessIntakeDraft,
    BusinessProfile,
    ComparisonCreate,
    DecisionConfirmation,
    DecisionCreate,
    EconomicShockCreate,
    EconomicShockEvent,
    HumanDecision,
    ImpactMappingRequest,
    ImpactResultRequest,
    IntakeDraftCreate,
    MonitoringRecordCreate,
    ProjectionComparisonRequest,
    ScenarioCreate,
    ScenarioDefinition,
    ScenarioUpdate,
)
from app.services.orchestrator import WorkflowOrchestrator
from app.services.economic_intelligence import (
    EconomicIntelligenceService,
    SourceDocument,
    ShockCandidate,
)

router = APIRouter()


def get_orchestrator() -> WorkflowOrchestrator:
    from app.main import orchestrator

    return orchestrator


Orchestrator = Annotated[WorkflowOrchestrator, Depends(get_orchestrator)]
def get_economic_intelligence() -> EconomicIntelligenceService:
    from app.main import economic_intelligence

    return economic_intelligence


EconomicIntelligence = Annotated[
    EconomicIntelligenceService,
    Depends(get_economic_intelligence),
]

@router.post("/detect", response_model=list[ShockCandidate])
def detect_economic_shocks(
    payload: SourceDocument,
    service: EconomicIntelligence,
) -> list[ShockCandidate]:
    return service.detect(payload)

@router.post("/shocks", response_model=EconomicShockEvent, status_code=status.HTTP_201_CREATED)
def create_shock(payload: EconomicShockCreate, service: Orchestrator) -> EconomicShockEvent:
    return service.register_shock(payload)


@router.get("/shocks/{shock_id}", response_model=EconomicShockEvent)
def get_shock(shock_id: UUID, service: Orchestrator) -> EconomicShockEvent:
    return service.get_shock(shock_id)


@router.post("/businesses/{business_id}/intake-drafts", response_model=BusinessIntakeDraft, status_code=status.HTTP_201_CREATED)
def create_intake_draft(business_id: UUID, payload: IntakeDraftCreate, service: Orchestrator) -> BusinessIntakeDraft:
    return service.create_intake_draft(business_id, payload)


@router.post("/businesses/{business_id}/intake-drafts/{draft_id}/confirm", response_model=BusinessProfile)
def confirm_intake_draft(business_id: UUID, draft_id: UUID, service: Orchestrator) -> BusinessProfile:
    return service.confirm_intake_draft(business_id, draft_id)


@router.post("/impact-mappings")
def create_impact_mapping(payload: ImpactMappingRequest, service: Orchestrator):
    return service.request_mapping(payload)


@router.post("/impact-results")
def create_impact_result(payload: ImpactResultRequest, service: Orchestrator):
    return service.request_impact(payload)


@router.post("/scenarios", response_model=ScenarioDefinition, status_code=status.HTTP_201_CREATED)
def create_scenario(payload: ScenarioCreate, service: Orchestrator) -> ScenarioDefinition:
    return service.create_scenario(payload)


@router.patch("/scenarios/{scenario_id}", response_model=ScenarioDefinition)
def update_scenario(scenario_id: UUID, payload: ScenarioUpdate, service: Orchestrator) -> ScenarioDefinition:
    return service.update_scenario(scenario_id, payload)


@router.post("/scenarios/{scenario_id}/confirm", response_model=ScenarioDefinition)
def confirm_scenario(scenario_id: UUID, service: Orchestrator) -> ScenarioDefinition:
    return service.confirm_scenario(scenario_id)


@router.post("/scenarios/{scenario_id}/run")
def run_scenario(scenario_id: UUID, service: Orchestrator):
    return service.run_scenario(scenario_id)


@router.post("/decisions", response_model=HumanDecision, status_code=status.HTTP_201_CREATED)
def create_decision(payload: DecisionCreate, service: Orchestrator) -> HumanDecision:
    return service.create_decision(payload)


@router.post("/comparisons")
def create_comparison(payload: ComparisonCreate, service: Orchestrator) -> None:
    service.request_comparison(payload)


@router.post("/decisions/{decision_id}/confirm", response_model=HumanDecision)
def confirm_decision(decision_id: UUID, payload: DecisionConfirmation, service: Orchestrator) -> HumanDecision:
    return service.confirm_decision(decision_id, payload)


@router.post("/monitoring-records")
def create_monitoring_record(payload: MonitoringRecordCreate, service: Orchestrator) -> object:
    return service.record_monitoring_input(payload)


@router.post("/projection-comparisons")
def create_projection_comparison(payload: ProjectionComparisonRequest, service: Orchestrator) -> None:
    service.request_projection_comparison(payload)
