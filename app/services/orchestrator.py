from uuid import UUID

from app.core.errors import ContractError
from app.models.domain import (
    AssumptionConfirmationStatus,
    BusinessIntakeDraft,
    BusinessProfile,
    ComparisonCreate,
    DecisionConfirmation,
    DecisionCreate,
    DecisionStatus,
    EconomicShockCreate,
    EconomicShockEvent,
    HumanDecision,
    ImpactMappingRequest,
    ImpactResultRequest,
    IntakeDraftCreate,
    IntakeStatus,
    MonitoringRecordCreate,
    ProjectionComparisonRequest,
    ScenarioCreate,
    ScenarioDefinition,
    ScenarioUpdate,
    VerificationStatus,
    utc_now,
    ProcessingStatus,
)
from app.services.store import InMemoryStore
from app.services.member3_integration import Member3Integration


class WorkflowOrchestrator:
    """Member 1 state, confirmation, and gate handling; no financial calculation."""

    def __init__(self, store: InMemoryStore) -> None:
        self.store = store
        self.member3 = Member3Integration()

    def register_shock(self, payload: EconomicShockCreate) -> EconomicShockEvent:
        event = EconomicShockEvent(**payload.model_dump())
        self.store.shocks[event.id] = event
        return event

    def get_shock(self, shock_id: UUID) -> EconomicShockEvent:
        return self.store.required(self.store.shocks, shock_id, "Economic shock")  # type: ignore[return-value]

    def create_intake_draft(self, business_id: UUID, payload: IntakeDraftCreate) -> BusinessIntakeDraft:
        draft = BusinessIntakeDraft(business_id=business_id, **payload.model_dump())
        self.store.intake_drafts[draft.id] = draft
        return draft

    def confirm_intake_draft(self, business_id: UUID, draft_id: UUID) -> BusinessProfile:
        draft = self.store.required(self.store.intake_drafts, draft_id, "Business intake draft")
        assert isinstance(draft, BusinessIntakeDraft)
        if draft.business_id != business_id:
            raise ContractError(404, "RESOURCE_NOT_FOUND", "Business intake draft was not found.")
        if draft.intake_status != IntakeStatus.DRAFT:
            raise ContractError(409, "STATE_CONFLICT", "Only a draft intake record can be confirmed.")
        draft.intake_status = IntakeStatus.CONFIRMED
        draft.updated_at = utc_now()
        profile = BusinessProfile(
            business_id=business_id,
            confirmed_fields=draft.submitted_fields,
            source_intake_draft_ids=[draft.id],
        )
        self.store.profiles[profile.id] = profile
        return profile

    def request_mapping(self, request: ImpactMappingRequest):
        shock = self.get_shock(request.shock_event_id)

        self._require_confirmed_business_profile(
            request.business_id,
            "TRACE",
        )

        profile = next(
            profile
            for profile in self.store.profiles.values()
            if profile.business_id == request.business_id
        )

        mapping = self.member3.create_mapping(
            request=request,
            shock=shock,
            profile=profile,
        )

        self.store.impact_mappings[mapping.shock_event_id] = mapping

        return mapping

    def request_impact(self, request: ImpactResultRequest):
        shock = self.get_shock(request.shock_event_id)

        if shock.verification_status != VerificationStatus.VERIFIED:
            raise ContractError(
                code="VERIFICATION_REQUIRED",
                message="QUANTIFY requires a verified economic shock.",
                status_code=422,
            )

        if not request.business_input_ids:
            raise ContractError(
                code="BUSINESS_INPUT_REQUIRED",
                message="QUANTIFY requires confirmed business inputs.",
                status_code=422,
            )

        profiles = [
            profile
            for profile in self.store.profiles.values()
            if profile.id in request.business_input_ids
        ]

        if len(profiles) != len(request.business_input_ids):
            raise ContractError(
                code="BUSINESS_INPUT_NOT_FOUND",
                message="One or more confirmed business inputs were not found.",
                status_code=404,
            )

        if not profiles:
            raise ContractError(
                "BUSINESS_INPUT_REQUIRED",
                "QUANTIFY requires at least one confirmed business profile.",
                422,
            )

        profile = profiles[0]

        result_record = self.member3.calculate_impact(
            request=request,
            profile=profile,
            shock=shock,
        )

        self.store.impact_results[result_record.id] = result_record

        return result_record

    def create_scenario(self, payload: ScenarioCreate) -> ScenarioDefinition:
        scenario = ScenarioDefinition(**payload.model_dump())
        self.store.scenarios[scenario.id] = scenario
        return scenario

    def update_scenario(self, scenario_id: UUID, payload: ScenarioUpdate) -> ScenarioDefinition:
        scenario = self.store.required(self.store.scenarios, scenario_id, "Scenario")
        assert isinstance(scenario, ScenarioDefinition)
        changes = payload.model_dump(exclude_none=True)
        for field, value in changes.items():
            setattr(scenario, field, value)
        scenario.assumption_confirmation_status = AssumptionConfirmationStatus.DRAFT
        scenario.updated_at = utc_now()
        return scenario

    def confirm_scenario(self, scenario_id: UUID) -> ScenarioDefinition:
        scenario = self.store.required(self.store.scenarios, scenario_id, "Scenario")
        assert isinstance(scenario, ScenarioDefinition)
        if scenario.assumption_confirmation_status != AssumptionConfirmationStatus.DRAFT:
            raise ContractError(409, "STATE_CONFLICT", "Only a draft scenario can be confirmed.")
        scenario.assumption_confirmation_status = AssumptionConfirmationStatus.CONFIRMED
        scenario.updated_at = utc_now()
        return scenario

    def run_scenario(self, scenario_id: UUID):
        scenario = self.store.required(
            self.store.scenarios,
            scenario_id,
            "Scenario",
        )
        assert isinstance(scenario, ScenarioDefinition)

        if scenario.assumption_confirmation_status != AssumptionConfirmationStatus.CONFIRMED:
            raise ContractError(
                422,
                "APPROVAL_REQUIRED",
                "The business owner must confirm the scenario before execution.",
                stage="SIMULATE",
                required_fields=["assumption_confirmation_status"],
            )

        impact_record = self.store.required(
            self.store.impact_results,
            scenario.base_impact_result_id,
            "Impact result",
        )

        if impact_record.business_id != scenario.business_id:
            raise ContractError(
                409,
                "BUSINESS_MISMATCH",
                "The scenario business does not match the base impact result.",
                stage="SIMULATE",
            )

        profile = next(
            (
                candidate
                for candidate in self.store.profiles.values()
                if candidate.business_id == scenario.business_id
            ),
            None,
        )
        if profile is None:
            raise ContractError(
                404,
                "RESOURCE_NOT_FOUND",
                "Business profile was not found.",
            )

        scenario_result = self.member3.run_scenario(
            scenario=scenario,
            profile=profile,
            baseline_inputs=impact_record.inputs,
        )

        self.store.scenario_results[scenario_result.id] = scenario_result

        scenario.processing_status = ProcessingStatus.COMPLETED
        scenario.updated_at = utc_now()

        return scenario_result

    def create_decision(self, payload: DecisionCreate):
        decision = HumanDecision(**payload.model_dump())
        self.store.decisions[decision.id] = decision
        return decision

    def request_comparison(self, request: ComparisonCreate):
        impact_record = self.store.required(
            self.store.impact_results,
            request.base_impact_result_id,
            "Impact result",
        )

        if impact_record.business_id != request.business_id:
            raise ContractError(
                409,
                "BUSINESS_MISMATCH",
                "Impact result does not belong to the requested business.",
                stage="COMPARE",
            )

        scenario_results = []
        for scenario_result_id in request.scenario_result_ids:
            scenario_result = self.store.required(
                self.store.scenario_results,
                scenario_result_id,
                "Scenario result",
            )

            if scenario_result.business_id != request.business_id:
                raise ContractError(
                    409,
                    "BUSINESS_MISMATCH",
                    "Scenario result does not belong to the requested business.",
                    stage="COMPARE",
                )

            if scenario_result.base_impact_result_id != request.base_impact_result_id:
                raise ContractError(
                    409,
                    "BASE_IMPACT_MISMATCH",
                    "Scenario result does not belong to the requested base impact result.",
                    stage="COMPARE",
                )

            scenario_results.append(scenario_result.result)

        comparisons = self.member3.compare_scenarios(scenario_results)

        return {
            "business_id": request.business_id,
            "base_impact_result_id": request.base_impact_result_id,
            "scenario_result_ids": request.scenario_result_ids,
            "comparisons": comparisons,
        }

    def record_monitoring_input(self, request: MonitoringRecordCreate):
        decision = self._require_confirmed_decision(request.human_decision_id)

        if decision.business_id != request.business_id:
            raise ContractError(
                409,
                "BUSINESS_MISMATCH",
                "Decision does not belong to the requested business.",
                stage="MONITOR",
            )

        if decision.selected_scenario_id is None:
            raise ContractError(
                422,
                "CLARIFICATION_REQUIRED",
                "A selected scenario is required to compare actual results against a stored projection.",
                stage="MONITOR",
                required_fields=["selected_scenario_id"],
            )

        scenario_result = next(
            (
                result
                for result in self.store.scenario_results.values()
                if result.scenario_id == decision.selected_scenario_id
                and result.business_id == request.business_id
            ),
            None,
        )

        if scenario_result is None:
            raise ContractError(
                404,
                "RESOURCE_NOT_FOUND",
                "The selected scenario result was not found.",
                stage="MONITOR",
            )

        projected_result = scenario_result.result.projected

        projection_fields = {
            "revenue": "shocked_revenue",
            "COGS": "shocked_cogs",
            "gross_profit": "shocked_gross_profit",
            "gross_margin_pct": "shocked_gross_margin_pct",
            "operating_profit": "shocked_operating_profit",
            "cash_requirement": "shocked_cash_requirement",
        }

        field_name = projection_fields.get(request.metric_name)
        if field_name is None:
            raise ContractError(
                422,
                "CLARIFICATION_REQUIRED",
                f"No approved projection mapping exists for metric '{request.metric_name}'.",
                stage="MONITOR",
                required_fields=list(projection_fields.keys()),
            )

        projected_value = getattr(projected_result, field_name)

        return self.member3.evaluate_monitoring(
            request=request,
            projected_value=projected_value,
        )

    def request_projection_comparison(self, request: ProjectionComparisonRequest) -> None:
        self._require_confirmed_decision(request.human_decision_id)
        raise ContractError(
            424,
            "UPSTREAM_UNAVAILABLE",
            "Projection comparison logic is not connected. Member 3 integration is required.",
            stage="MONITOR",
        )

    def _require_confirmed_business_profile(self, business_id: UUID, stage: str) -> None:
        if not any(profile.business_id == business_id for profile in self.store.profiles.values()):
            raise ContractError(
                422,
                "CLARIFICATION_REQUIRED",
                "Confirmed business information is required.",
                stage=stage,
                required_fields=["BusinessProfile"],
            )

    def _require_confirmed_decision(self, decision_id: UUID) -> None:
        decision = self.store.required(self.store.decisions, decision_id, "Human decision")
        assert isinstance(decision, HumanDecision)
        if decision.decision_status != DecisionStatus.CONFIRMED:
            raise ContractError(
                422,
                "APPROVAL_REQUIRED",
                "A confirmed owner decision is required before monitoring.",
                stage="MONITOR",
                required_fields=["decision_status"],
            )

        return decision

    def confirm_decision(self, decision_id: UUID, payload: DecisionConfirmation):
        decision = self.store.required(self.store.decisions, decision_id, "Human decision")
        assert isinstance(decision, HumanDecision)
        if decision.decision_status != DecisionStatus.SELECTED:
            raise ContractError(409, "STATE_CONFLICT", "Only a selected decision can be confirmed.")
        decision.decision_status = DecisionStatus.CONFIRMED
        decision.owner_confirmation_reference = payload.owner_confirmation_reference
        decision.decided_at = utc_now()
        decision.updated_at = utc_now()
        return decision
