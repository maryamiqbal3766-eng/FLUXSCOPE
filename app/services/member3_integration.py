from __future__ import annotations

from dataclasses import dataclass

from decimal import Decimal, InvalidOperation
from uuid import UUID, uuid4

from app.core.errors import ContractError
from app.models.domain import (
    BusinessFact,
    BusinessProfile,
    ComparisonCreate,
    ImpactMappingRequest,
    ImpactResultRequest,
    MonitoringRecordCreate,
    ProjectionComparisonRequest,
    ScenarioDefinition,
)

from app.services.impact_engine.calculator import (
    DeterministicImpactCalculator,
    ImpactCalculationError,
    ImpactInputs,
)
from app.services.impact_engine.comparison import (
    DeterministicScenarioComparator,
)
from app.services.impact_engine.graph import ImpactGraphBuilder
from app.services.impact_engine.monitoring import (
    DeterministicMonitoringEngine,
    ProjectionMetric,
)
from app.services.impact_engine.scenarios import (
    DeterministicScenarioEngine,
    ScenarioChanges,
    ScenarioDefinition as EngineScenarioDefinition,
    ScenarioValidationError,
)


@dataclass(frozen=True)
class ImpactResultRecord:
    id: UUID
    business_id: UUID
    shock_event_id: UUID
    impact_mapping_id: UUID
    inputs: ImpactInputs
    result: object


@dataclass(frozen=True)
class ScenarioResultRecord:
    id: UUID
    scenario_id: UUID
    business_id: UUID
    base_impact_result_id: UUID
    result: object


class Member3Integration:
    """
    Adapter between TADBIR's domain contracts and Member 3's
    deterministic impact/scenario/monitoring engines.

    This adapter does not perform LLM calls and does not invent
    missing business information.
    """

    # Confirmed business facts required by the deterministic calculator.
    # The exchange-rate change itself is an external fact: it comes from the
    # verified shock magnitude, not from the business profile.
    REQUIRED_CALCULATION_FIELDS = (
        "sales_quantity",
        "selling_price_per_unit",
        "imported_quantity",
        "imported_unit_cost",
        "exchange_rate",
        "local_input_cost",
        "operating_expenses",
    )

    # The current deterministic formula catalogue models only an
    # exchange-rate shock applied to imported inputs.
    SUPPORTED_QUANTIFY_SHOCK_TYPES = ("exchange_rate",)

    # Scenario assumptions the deterministic scenario engine understands.
    SUPPORTED_SCENARIO_FIELDS = (
        "selling_price_per_unit",
        "imported_quantity",
        "operating_expenses",
        "exchange_rate",
        "exchange_rate_change_delta",
    )

    def __init__(self) -> None:
        self.graph_builder = ImpactGraphBuilder()
        self.calculator = DeterministicImpactCalculator()
        self.scenario_engine = DeterministicScenarioEngine(self.calculator)
        self.comparator = DeterministicScenarioComparator()
        self.monitoring_engine = DeterministicMonitoringEngine()

    # ------------------------------------------------------------------
    # TRACE
    # ------------------------------------------------------------------

    def create_mapping(
        self,
        request: ImpactMappingRequest,
        shock,
        profile: BusinessProfile,
    ):
        """
        Build the deterministic four-layer impact graph.

        The graph uses only information available from the verified
        shock and confirmed business profile.
        """

        dependency = self._resolve_dependency(profile)
        operational_effect = self._resolve_operational_effect(shock)
        financial_effect = self._resolve_financial_effect(shock)

        return self.graph_builder.build(
            shock_event_id=request.shock_event_id,
            business_id=request.business_id,
            dependency=dependency,
            operational_effect=operational_effect,
            financial_effect=financial_effect,
            shock_label=self._shock_label(shock),
        )

    # ------------------------------------------------------------------
    # QUANTIFY
    # ------------------------------------------------------------------

    def require_supported_shock(self, shock) -> None:
        """Block QUANTIFY for shocks the formula catalogue does not model."""

        if shock.shock_type not in self.SUPPORTED_QUANTIFY_SHOCK_TYPES:
            raise ContractError(
                422,
                "UNSUPPORTED_SHOCK_TYPE",
                f"This '{shock.shock_type}' shock was detected successfully, but the current "
                "deterministic QUANTIFY engine does not support financial calculation for this "
                "shock type. Supported: " + ", ".join(self.SUPPORTED_QUANTIFY_SHOCK_TYPES) + ".",
                stage="QUANTIFY",
                required_fields=["shock_type"],
            )

    def calculate_impact(
        self,
        request: ImpactResultRequest,
        profile: BusinessProfile,
        shock,
    ):
        """
        Convert confirmed business facts into the typed deterministic
        calculation input.

        Missing fields are rejected rather than invented.
        """

        self.require_supported_shock(shock)

        values = self._extract_calculation_fields(profile)

        if shock.magnitude is None:
            raise ContractError(
                422,
                "CLARIFICATION_REQUIRED",
                "The verified economic shock does not contain a usable magnitude.",
                stage="QUANTIFY",
                required_fields=["magnitude"],
            )

        shock_change = self._decimal(shock.magnitude, "magnitude")

        # The calculator expects exchange_rate_change as a decimal
        # fraction. For example, 5 means 5.0% only if the shock unit
        # explicitly says percent. We therefore require percent units
        # for the exchange-rate change field.
        shock_unit = (shock.unit or "").lower()

        if "%" not in shock_unit and "percent" not in shock_unit:
            raise ContractError(
                422,
                "CLARIFICATION_REQUIRED",
                "The verified exchange-rate shock magnitude must have a percentage unit.",
                stage="QUANTIFY",
                required_fields=["unit"],
            )

        # The sign of the change must be stated by the source; it is not
        # guessed for directions such as "change".
        direction = shock.direction_or_change.lower()
        if direction not in ("increase", "decrease"):
            raise ContractError(
                422,
                "CLARIFICATION_REQUIRED",
                "The verified shock does not state whether the exchange rate increased or decreased.",
                stage="QUANTIFY",
                required_fields=["direction_or_change"],
            )

        # Convert percentage points to decimal fraction.
        exchange_rate_change = shock_change / Decimal("100")

        if direction == "decrease":
            exchange_rate_change = -exchange_rate_change

        inputs = ImpactInputs(
            sales_quantity=values["sales_quantity"],
            selling_price_per_unit=values["selling_price_per_unit"],
            imported_quantity=values["imported_quantity"],
            imported_unit_cost=values["imported_unit_cost"],
            exchange_rate=values["exchange_rate"],
            local_input_cost=values["local_input_cost"],
            operating_expenses=values["operating_expenses"],
            exchange_rate_change=exchange_rate_change,
        )

        try:
            result = self.calculator.calculate(inputs)
        except ImpactCalculationError as exc:
            raise ContractError(
                422,
                "INVALID_INPUT",
                str(exc),
                stage="QUANTIFY",
            ) from exc

        return ImpactResultRecord(
            id=uuid4(),
            business_id=profile.business_id,
            shock_event_id=request.shock_event_id,
            impact_mapping_id=request.impact_mapping_id,
            inputs=inputs,
            result=result,
        )

    # ------------------------------------------------------------------
    # SIMULATE
    # ------------------------------------------------------------------

    def run_scenario(
        self,
        scenario: ScenarioDefinition,
        profile: BusinessProfile,
        baseline_inputs: ImpactInputs,
    ):
        changes = self._scenario_changes(scenario)

        engine_scenario = EngineScenarioDefinition(
            name=scenario.name,
            changes=changes,
        )

        try:
            result = self.scenario_engine.run(
                baseline_inputs=baseline_inputs,
                scenario=engine_scenario,
            )
        except (ImpactCalculationError, ScenarioValidationError) as exc:
            raise ContractError(
                422,
                "INVALID_INPUT",
                str(exc),
                stage="SIMULATE",
            ) from exc

        return ScenarioResultRecord(
            id=uuid4(),
            scenario_id=scenario.id,
            business_id=scenario.business_id,
            base_impact_result_id=scenario.base_impact_result_id,
            result=result,
        )

    # ------------------------------------------------------------------
    # COMPARE
    # ------------------------------------------------------------------

    def compare_scenarios(self, scenarios):
        """
        Compare scenarios without selecting a winner.
        """

        return self.comparator.compare(scenarios)

    # ------------------------------------------------------------------
    # MONITOR
    # ------------------------------------------------------------------

    def evaluate_monitoring(
        self,
        request: MonitoringRecordCreate,
        projected_value: Decimal,
    ):
        actual_value = self._decimal(
            request.actual_value,
            "actual_value",
        )

        metric = ProjectionMetric(
            metric_name=request.metric_name,
            projected_value=projected_value,
            actual_value=actual_value,
            tolerance=self._default_tolerance(projected_value),
        )

        return self.monitoring_engine.evaluate(metric)

    def compare_projection(
        self,
        request: ProjectionComparisonRequest,
        monitoring_records: list[MonitoringRecordCreate],
        projections: dict[str, Decimal],
    ):
        results = []

        for record in monitoring_records:
            if record.metric_name not in projections:
                raise ContractError(
                    422,
                    "CLARIFICATION_REQUIRED",
                    f"No projection is available for metric '{record.metric_name}'.",
                    stage="MONITOR",
                    required_fields=[record.metric_name],
                )

            results.append(
                self.evaluate_monitoring(
                    record,
                    projections[record.metric_name],
                )
            )

        return results

    # ------------------------------------------------------------------
    # Business-profile conversion
    # ------------------------------------------------------------------

    def build_impact_inputs(
        self,
        profile: BusinessProfile,
        exchange_rate_change: Decimal,
    ) -> ImpactInputs:
        values = self._extract_calculation_fields(profile)

        return ImpactInputs(
            sales_quantity=values["sales_quantity"],
            selling_price_per_unit=values["selling_price_per_unit"],
            imported_quantity=values["imported_quantity"],
            imported_unit_cost=values["imported_unit_cost"],
            exchange_rate=values["exchange_rate"],
            local_input_cost=values["local_input_cost"],
            operating_expenses=values["operating_expenses"],
            exchange_rate_change=exchange_rate_change,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _extract_calculation_fields(
        self,
        profile: BusinessProfile,
    ) -> dict[str, Decimal]:
        fields: dict[str, Decimal] = {}

        for field_name, fact in profile.confirmed_fields.items():
            if field_name not in self.REQUIRED_CALCULATION_FIELDS:
                continue

            fields[field_name] = self._business_fact_decimal(
                field_name,
                fact,
            )

        missing = [
            field
            for field in self.REQUIRED_CALCULATION_FIELDS
            if field not in fields
        ]

        if missing:
            raise ContractError(
                422,
                "CLARIFICATION_REQUIRED",
                "Required confirmed business information is missing for deterministic quantification.",
                stage="QUANTIFY",
                required_fields=missing,
            )

        return fields

    @staticmethod
    def _business_fact_decimal(
        field_name: str,
        fact: BusinessFact,
    ) -> Decimal:
        try:
            return Decimal(fact.value)
        except (InvalidOperation, ValueError) as exc:
            raise ContractError(
                422,
                "INVALID_INPUT",
                f"Business field '{field_name}' must contain a numeric value.",
                stage="QUANTIFY",
                required_fields=[field_name],
            ) from exc

    @staticmethod
    def _decimal(value: str, field_name: str) -> Decimal:
        try:
            return Decimal(value)
        except (InvalidOperation, ValueError) as exc:
            raise ContractError(
                422,
                "INVALID_INPUT",
                f"'{field_name}' must contain a numeric value.",
                stage="QUANTIFY",
                required_fields=[field_name],
            ) from exc

    @staticmethod
    def _shock_label(shock) -> str:
        return (
            f"{shock.economic_variable}: "
            f"{shock.direction_or_change}"
        )

    @staticmethod
    def _resolve_dependency(profile: BusinessProfile) -> str:
        fields = set(profile.confirmed_fields.keys())

        if {
            "imported_quantity",
            "imported_unit_cost",
        }.issubset(fields):
            return "Imported input exposure"

        if "operating_expenses" in fields:
            return "Operating cost exposure"

        return "Confirmed business cost exposure"

    @staticmethod
    def _resolve_operational_effect(shock) -> str:
        direction = shock.direction_or_change.lower()

        if direction == "increase":
            return f"{shock.economic_variable} increases business cost pressure"

        if direction == "decrease":
            return f"{shock.economic_variable} decreases business cost pressure"

        return f"{shock.economic_variable} changes the business cost environment"

    @staticmethod
    def _resolve_financial_effect(shock) -> str:
        direction = shock.direction_or_change.lower()

        if direction == "increase":
            return "Potential increase in cost and pressure on margin/cash requirement"

        if direction == "decrease":
            return "Potential reduction in cost and improvement in margin/cash requirement"

        return "Financial effect requires scenario quantification"

    @staticmethod
    def _scenario_changes(
        scenario: ScenarioDefinition,
    ) -> ScenarioChanges:
        values = {
            item.field_reference: item.value
            for item in scenario.changed_assumptions
        }

        # An assumption the engine cannot apply must not be dropped silently:
        # the owner would see a result that ignores what they asked for.
        unsupported = sorted(
            set(values) - set(Member3Integration.SUPPORTED_SCENARIO_FIELDS)
        )
        if unsupported:
            raise ContractError(
                422,
                "CLARIFICATION_REQUIRED",
                "Unsupported scenario assumption(s): " + ", ".join(unsupported)
                + ". Supported: " + ", ".join(Member3Integration.SUPPORTED_SCENARIO_FIELDS) + ".",
                stage="SIMULATE",
                required_fields=list(Member3Integration.SUPPORTED_SCENARIO_FIELDS),
            )

        def optional_decimal(name: str) -> Decimal | None:
            value = values.get(name)
            if value is None:
                return None

            try:
                return Decimal(value)
            except InvalidOperation as exc:
                raise ContractError(
                    422,
                    "INVALID_INPUT",
                    f"Scenario assumption '{name}' must be numeric.",
                    stage="SIMULATE",
                    required_fields=[name],
                ) from exc

        return ScenarioChanges(
            selling_price_per_unit=optional_decimal(
                "selling_price_per_unit"
            ),
            imported_quantity=optional_decimal(
                "imported_quantity"
            ),
            operating_expenses=optional_decimal(
                "operating_expenses"
            ),
            exchange_rate=optional_decimal(
                "exchange_rate"
            ),
            exchange_rate_change_delta=optional_decimal(
                "exchange_rate_change_delta"
            ),
        )

    @staticmethod
    def _default_tolerance(projected_value: Decimal) -> Decimal:
        """
        Temporary explicit MVP tolerance.

        This is intentionally isolated in the adapter so the final
        approved monitoring threshold can be changed without modifying
        the deterministic monitoring engine.
        """

        absolute = abs(projected_value)

        if absolute == Decimal("0"):
            return Decimal("0.01")

        return absolute * Decimal("0.05")