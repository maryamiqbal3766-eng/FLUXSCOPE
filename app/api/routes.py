import json
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from groq import APIError as GroqAPIError
from pydantic import ValidationError

from app.core.errors import ContractError
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
from app.services.groq import GroqConfigurationError
from app.services.economic_intelligence import (
    ApprovedSourceRegistry,
    EconomicIntelligenceService,
    SourceDocument,
    ShockCandidate,
    UnapprovedSourceError,
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

def approved_sources_text() -> str:
    return "; ".join(
        f"{source.publisher} ({', '.join(source.domains)})"
        for source in ApprovedSourceRegistry().sources
    )


@router.post("/detect", response_model=list[ShockCandidate])
def detect_economic_shocks(
    payload: SourceDocument,
    service: EconomicIntelligence,
) -> list[ShockCandidate]:
    try:
        return service.detect(payload)
    except UnapprovedSourceError as exc:
        raise ContractError(
            422,
            "VERIFICATION_REQUIRED",
            "The source is not on the approved-source registry. The publisher must match "
            f"the source URL's domain. Approved: {approved_sources_text()}.",
            stage="DETECT",
            required_fields=["publisher", "source_url"],
        ) from exc
    except GroqConfigurationError as exc:
        raise ContractError(
            424,
            "UPSTREAM_UNAVAILABLE",
            f"Economic shock extraction is not configured on the backend: {exc} "
            "Set GROQ_API_KEY and GROQ_MODEL before starting the API.",
            stage="DETECT",
        ) from exc
    except GroqAPIError as exc:
        raise ContractError(
            424,
            "UPSTREAM_UNAVAILABLE",
            f"The extraction service could not be reached or refused the request ({type(exc).__name__}).",
            stage="DETECT",
        ) from exc
    except (json.JSONDecodeError, KeyError, TypeError, AttributeError, ValidationError, ValueError) as exc:
        raise ContractError(
            500,
            "PROCESSING_FAILED",
            "The extraction output could not be validated against the shock contract; "
            "no shock was produced.",
            stage="DETECT",
        ) from exc


@router.get("/detect/approved-sources")
def list_approved_sources() -> list[dict[str, object]]:
    return [
        {"publisher": source.publisher, "domains": list(source.domains), "role": source.role}
        for source in ApprovedSourceRegistry().sources
    ]


@router.post(
    "/shocks/from-detection/{shock_id}",
    response_model=EconomicShockEvent,
    status_code=status.HTTP_201_CREATED,
)
def register_detected_shock(
    shock_id: UUID,
    detection: EconomicIntelligence,
    service: Orchestrator,
) -> EconomicShockEvent:
    candidate = detection.get_event(str(shock_id))
    source = detection.get_source(str(shock_id))
    if candidate is None or source is None:
        raise ContractError(
            404,
            "RESOURCE_NOT_FOUND",
            "Detected shock candidate was not found. Run DETECT first.",
            stage="DETECT",
        )
    return service.register_detected_shock(candidate, source)

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


@router.post("/comparisons", status_code=status.HTTP_201_CREATED)
def create_comparison(payload: ComparisonCreate, service: Orchestrator):
    return service.request_comparison(payload)


@router.get("/comparisons/{comparison_id}")
def get_comparison(comparison_id: UUID, service: Orchestrator):
    return service.get_comparison(comparison_id)


@router.post("/decisions/{decision_id}/confirm", response_model=HumanDecision)
def confirm_decision(decision_id: UUID, payload: DecisionConfirmation, service: Orchestrator) -> HumanDecision:
    return service.confirm_decision(decision_id, payload)


@router.post("/monitoring-records")
def create_monitoring_record(payload: MonitoringRecordCreate, service: Orchestrator) -> object:
    return service.record_monitoring_input(payload)


@router.post("/projection-comparisons")
def create_projection_comparison(payload: ProjectionComparisonRequest, service: Orchestrator) -> None:
    service.request_projection_comparison(payload)
