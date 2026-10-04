from decimal import Decimal
from uuid import UUID, uuid4

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
    ProvenanceRecord,
    ScenarioCreate,
    ScenarioDefinition,
    ScenarioUpdate,
    VerificationStatus,
    utc_now,
    ProcessingStatus,
)
from app.services.economic_intelligence.schemas import ShockCandidate, SourceDocument
from app.services.store import InMemoryStore
from app.services.member3_integration import Member3Integration


# DETECT verifier outcome -> domain verification status.
DETECT_VERIFICATION_STATUS = {
    "VERIFIED": VerificationStatus.VERIFIED,
    "REJECTED": VerificationStatus.REJECTED,
    "PENDING_VERIFICATION": VerificationStatus.PENDING,
}


class WorkflowOrchestrator:
    """Member 1 state, confirmation, and gate handling; no financial calculation."""

    def __init__(self, store: InMemoryStore) -> None:
        self.store = store
        self.member3 = Member3Integration()

    def register_shock(self, payload: EconomicShockCreate) -> EconomicShockEvent:
        """Register a caller-supplied shock candidate.

        Verification is established only by the DETECT evidence verifier
        (approved-source registry + evidence checks). A caller therefore
        cannot assert a ``verified`` status through this endpoint.
        """

        claims_verified = payload.verification_status == VerificationStatus.VERIFIED or any(
            item.verification_status == VerificationStatus.VERIFIED for item in payload.provenance
        )
        if claims_verified:
            raise ContractError(
                422,
                "VERIFICATION_REQUIRED",
                "A verified status can only be assigned by the DETECT evidence verifier. "
                "Submit the source through POST /detect, or register this shock as pending.",
                stage="DETECT",
                required_fields=["verification_status"],
            )
        event = EconomicShockEvent(**payload.model_dump())
        self.store.shocks[event.id] = event
        return event

    def register_detected_shock(
        self,
        candidate: ShockCandidate,
        source: SourceDocument,
    ) -> EconomicShockEvent:
        """Hand a DETECT candidate to the workflow as an EconomicShockEvent.

        The verification status comes from the server-side DETECT verifier
        result, never from the client. The shock keeps the candidate's ID.
        """

        existing = self.store.shocks.get(candidate.shock_id)
        if existing is not None:
            return existing

        if candidate.effective_date is not None:
            observed_date = candidate.effective_date
            date_note = "Date: effective date stated in the source evidence."
        elif source.published_at is not None:
            observed_date = source.published_at
            date_note = (
                "Date: the source does not state an effective date; "
                "the source publication date supplied with the document is used."
            )
        else:
            raise ContractError(
                422,
                "CLARIFICATION_REQUIRED",
                "The source states no effective date and no publication date was supplied. "
                "Re-run DETECT with the source's publication date.",
                stage="DETECT",
                required_fields=["published_at"],
            )

        verification_status = DETECT_VERIFICATION_STATUS[candidate.verification_status]
        provenance = [
            ProvenanceRecord(
                source_name=evidence.publisher,
                source_url_or_reference=evidence.source_url or source.source_url or evidence.title,
                retrieved_at=source.retrieved_at,
                published_at=source.published_at,
                source_excerpt_or_locator=evidence.evidence_locator or evidence.quote,
                verification_status=verification_status,
            )
            for evidence in candidate.source_evidence
        ]
        notes = [date_note, *candidate.verification_notes]

        event = EconomicShockEvent(
            id=candidate.shock_id,
            shock_type=candidate.shock_type,
            economic_variable=candidate.variable,
            direction_or_change=candidate.direction_or_change,
            observed_or_effective_date=observed_date,
            provenance=provenance,
            verification_status=verification_status,
            magnitude=self._decimal_string(candidate.magnitude),
            unit=candidate.unit or None,
            source_notes=" ".join(notes),
        )
        self.store.shocks[event.id] = event
        return event

    @staticmethod
    def _decimal_string(value: Decimal | None) -> str | None:
        if value is None:
            return None
        return format(value, "f")

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

        # TRACE may use pending, verified, or unverifiable shocks; a shock the
        # verifier rejected does not enter the business workflow.
        if shock.verification_status == VerificationStatus.REJECTED:
            raise ContractError(
                422,
                "VERIFICATION_REQUIRED",
                "This economic shock was rejected by source verification and cannot be traced.",
                stage="TRACE",
                required_fields=["verification_status"],
            )

        self._require_confirmed_business_profile(
            request.business_id,
            "TRACE",
        )

        # The most recently confirmed profile reflects the owner's latest facts.
        profile = max(
            (
                profile
                for profile in self.store.profiles.values()
                if profile.business_id == request.business_id
            ),
            key=lambda profile: profile.created_at,
        )

        mapping = self.member3.create_mapping(
            request=request,
            shock=shock,
            profile=profile,
        )

        self.store.impact_mappings[mapping.id] = mapping

        return mapping

    def request_impact(self, request: ImpactResultRequest):
        shock = self.get_shock(request.shock_event_id)

        if shock.verification_status != VerificationStatus.VERIFIED:
            raise ContractError(
                code="VERIFICATION_REQUIRED",
                message="QUANTIFY requires a verified economic shock.",
                status_code=422,
                stage="QUANTIFY",
                required_fields=["verification_status"],
            )

        self.member3.require_supported_shock(shock)

        # TRACE -> QUANTIFY gate: the referenced mapping must exist and must
        # have been produced for this shock.
        mapping = self.store.impact_mappings.get(request.impact_mapping_id)
        if mapping is None:
            raise ContractError(
                422,
                "CLARIFICATION_REQUIRED",
                "QUANTIFY requires a completed TRACE impact mapping. "
                "Create one with POST /impact-mappings first.",
                stage="QUANTIFY",
                required_fields=["impact_mapping_id"],
            )
        if mapping.shock_event_id != request.shock_event_id:
            raise ContractError(
                409,
                "STATE_CONFLICT",
                "The impact mapping was created for a different economic shock.",
                stage="QUANTIFY",
                required_fields=["impact_mapping_id"],
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

        if mapping.business_id != profile.business_id:
            raise ContractError(
                409,
                "STATE_CONFLICT",
                "The impact mapping belongs to a different business than the confirmed inputs.",
                stage="QUANTIFY",
                required_fields=["impact_mapping_id", "business_input_ids"],
            )

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

        comparison = {
            "id": uuid4(),
            "business_id": request.business_id,
            "base_impact_result_id": request.base_impact_result_id,
            "scenario_result_ids": request.scenario_result_ids,
            "comparisons": comparisons,
            "created_at": utc_now(),
        }
        self.store.comparisons[comparison["id"]] = comparison
        return comparison

    def get_comparison(self, comparison_id: UUID):
        return self.store.required(self.store.comparisons, comparison_id, "Comparison")

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
