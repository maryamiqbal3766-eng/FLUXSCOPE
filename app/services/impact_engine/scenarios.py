from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .calculator import (
    DeterministicImpactCalculator,
    ImpactInputs,
    ImpactResult,
)


class ScenarioValidationError(ValueError):
    """Raised when a scenario contains an invalid assumption."""


@dataclass(frozen=True)
class ScenarioChanges:
    """
    Explicit user-controlled changes for SIMULATE.

    None means the scenario keeps the original business value.

    Values are replacement values except:
    - exchange_rate_change_delta is an additional change to the
      existing exchange-rate shock assumption.
    """

    selling_price_per_unit: Decimal | None = None
    imported_quantity: Decimal | None = None
    operating_expenses: Decimal | None = None
    exchange_rate: Decimal | None = None
    exchange_rate_change_delta: Decimal | None = None


@dataclass(frozen=True)
class ScenarioDefinition:
    name: str
    changes: ScenarioChanges


@dataclass(frozen=True)
class ScenarioResult:
    name: str

    # Original business situation under the existing economic shock.
    baseline: ImpactResult

    # Projected business situation after applying scenario assumptions.
    projected: ImpactResult


class DeterministicScenarioEngine:
    """
    Runs user-defined what-if scenarios through the deterministic
    QUANTIFY calculation engine.

    Important distinction:

    baseline
        = original business inputs + existing economic shock

    projected
        = modified business inputs + existing economic shock

    Therefore scenario results can be compared directly against the
    original business baseline.
    """

    def __init__(
        self,
        calculator: DeterministicImpactCalculator | None = None,
    ):
        self.calculator = calculator or DeterministicImpactCalculator()

    def run(
        self,
        *,
        baseline_inputs: ImpactInputs,
        scenario: ScenarioDefinition,
    ) -> ScenarioResult:
        if not scenario.name.strip():
            raise ScenarioValidationError(
                "Scenario name cannot be empty."
            )

        # Calculate the original business position first.
        baseline_result = self.calculator.calculate(
            baseline_inputs
        )

        # Apply the user's scenario assumptions.
        projected_inputs = self._apply_changes(
            baseline_inputs,
            scenario.changes,
        )

        # Calculate the modified scenario.
        projected_result = self.calculator.calculate(
            projected_inputs
        )

        # Convert the projected calculation into a comparison against
        # the ORIGINAL business baseline.
        projected_result = self._rebase_result(
            baseline=baseline_result,
            projected=projected_result,
        )

        return ScenarioResult(
            name=scenario.name,
            baseline=baseline_result,
            projected=projected_result,
        )

    def _apply_changes(
        self,
        baseline: ImpactInputs,
        changes: ScenarioChanges,
    ) -> ImpactInputs:
        return ImpactInputs(
            sales_quantity=baseline.sales_quantity,

            selling_price_per_unit=(
                baseline.selling_price_per_unit
                if changes.selling_price_per_unit is None
                else changes.selling_price_per_unit
            ),

            imported_quantity=(
                baseline.imported_quantity
                if changes.imported_quantity is None
                else changes.imported_quantity
            ),

            imported_unit_cost=baseline.imported_unit_cost,

            exchange_rate=(
                baseline.exchange_rate
                if changes.exchange_rate is None
                else changes.exchange_rate
            ),

            local_input_cost=baseline.local_input_cost,

            operating_expenses=(
                baseline.operating_expenses
                if changes.operating_expenses is None
                else changes.operating_expenses
            ),

            exchange_rate_change=(
                baseline.exchange_rate_change
                if changes.exchange_rate_change_delta is None
                else (
                    baseline.exchange_rate_change
                    + changes.exchange_rate_change_delta
                )
            ),
        )

    @staticmethod
    def _rebase_result(
        *,
        baseline: ImpactResult,
        projected: ImpactResult,
    ) -> ImpactResult:
        """
        Rebase the projected calculation against the ORIGINAL business
        result.

        The calculator itself always calculates the internal financial
        relationships of the supplied inputs. For SIMULATE we additionally
        need the difference between the original business position and
        the scenario position.
        """

        def change_pct(
            original: Decimal,
            new: Decimal,
        ) -> Decimal:
            if original == Decimal("0"):
                return Decimal("0")

            return (
                (new - original)
                / abs(original)
            ) * Decimal("100")

        return ImpactResult(
            baseline_revenue=baseline.baseline_revenue,
            shocked_revenue=projected.baseline_revenue,

            baseline_imported_cost=baseline.shocked_imported_cost,
            shocked_imported_cost=projected.shocked_imported_cost,

            imported_cost_impact=(
                projected.shocked_imported_cost
                - baseline.shocked_imported_cost
            ),

            baseline_cogs=baseline.shocked_cogs,
            shocked_cogs=projected.shocked_cogs,

            cogs_impact=(
                projected.shocked_cogs
                - baseline.shocked_cogs
            ),

            baseline_gross_profit=baseline.shocked_gross_profit,
            shocked_gross_profit=projected.shocked_gross_profit,

            baseline_gross_margin_pct=baseline.shocked_gross_margin_pct,
            shocked_gross_margin_pct=projected.shocked_gross_margin_pct,

            gross_margin_change_pct_points=(
                projected.shocked_gross_margin_pct
                - baseline.shocked_gross_margin_pct
            ),

            baseline_operating_profit=baseline.shocked_operating_profit,
            shocked_operating_profit=projected.shocked_operating_profit,

            profit_impact=(
                projected.shocked_operating_profit
                - baseline.shocked_operating_profit
            ),

            baseline_cash_requirement=baseline.shocked_cash_requirement,
            shocked_cash_requirement=projected.shocked_cash_requirement,

            cash_requirement_change=(
                projected.shocked_cash_requirement
                - baseline.shocked_cash_requirement
            ),

            revenue_change_pct=change_pct(
                baseline.shocked_revenue,
                projected.baseline_revenue,
            ),

            cogs_change_pct=change_pct(
                baseline.shocked_cogs,
                projected.shocked_cogs,
            ),

            profit_change_pct=change_pct(
                baseline.shocked_operating_profit,
                projected.shocked_operating_profit,
            ),
        )