from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP


MONEY_QUANT = Decimal("0.01")
PERCENT_QUANT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def percent(value: Decimal) -> Decimal:
    return value.quantize(PERCENT_QUANT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class ImpactInputs:
    """
    Explicit business inputs for deterministic QUANTIFY calculations.

    No value is inferred by this engine. Every required input must be supplied
    by the caller and validated before calculation.
    """

    sales_quantity: Decimal
    selling_price_per_unit: Decimal

    imported_quantity: Decimal
    imported_unit_cost: Decimal
    exchange_rate: Decimal

    local_input_cost: Decimal
    operating_expenses: Decimal

    # External shock applied to the exchange rate.
    # Example: Decimal("0.07") means +7%.
    exchange_rate_change: Decimal


@dataclass(frozen=True)
class ImpactResult:
    baseline_revenue: Decimal
    shocked_revenue: Decimal

    baseline_imported_cost: Decimal
    shocked_imported_cost: Decimal
    imported_cost_impact: Decimal

    baseline_cogs: Decimal
    shocked_cogs: Decimal
    cogs_impact: Decimal

    baseline_gross_profit: Decimal
    shocked_gross_profit: Decimal
    baseline_gross_margin_pct: Decimal
    shocked_gross_margin_pct: Decimal
    gross_margin_change_pct_points: Decimal

    baseline_operating_profit: Decimal
    shocked_operating_profit: Decimal
    profit_impact: Decimal

    baseline_cash_requirement: Decimal
    shocked_cash_requirement: Decimal
    cash_requirement_change: Decimal

    revenue_change_pct: Decimal
    cogs_change_pct: Decimal
    profit_change_pct: Decimal


class ImpactCalculationError(ValueError):
    """Raised when required calculation inputs are invalid or incomplete."""


class DeterministicImpactCalculator:
    """
    QUANTIFY calculation engine.

    Formula catalogue used here:

    Revenue = sales_quantity × selling_price_per_unit

    Imported cost = imported_quantity × imported_unit_cost × exchange_rate

    COGS = imported cost + local input cost

    Gross profit = revenue − COGS

    Gross margin % = (gross profit / revenue) × 100

    Operating profit = gross profit − operating expenses

    Cash requirement = COGS + operating expenses

    Shocked exchange rate =
        baseline exchange rate × (1 + exchange_rate_change)

    Percentage change =
        ((shocked − baseline) / |baseline|) × 100

    If a denominator is zero, the corresponding percentage change is returned
    as Decimal("0") rather than inventing a value.
    """

    REQUIRED_NON_NEGATIVE = (
        "sales_quantity",
        "selling_price_per_unit",
        "imported_quantity",
        "imported_unit_cost",
        "exchange_rate",
        "local_input_cost",
        "operating_expenses",
    )

    def calculate(self, inputs: ImpactInputs) -> ImpactResult:
        self._validate(inputs)

        baseline_revenue = (
            inputs.sales_quantity * inputs.selling_price_per_unit
        )

        shocked_exchange_rate = (
            inputs.exchange_rate
            * (Decimal("1") + inputs.exchange_rate_change)
        )

        baseline_imported_cost = (
            inputs.imported_quantity
            * inputs.imported_unit_cost
            * inputs.exchange_rate
        )

        shocked_imported_cost = (
            inputs.imported_quantity
            * inputs.imported_unit_cost
            * shocked_exchange_rate
        )

        baseline_cogs = baseline_imported_cost + inputs.local_input_cost
        shocked_cogs = shocked_imported_cost + inputs.local_input_cost

        baseline_gross_profit = baseline_revenue - baseline_cogs
        shocked_gross_profit = baseline_revenue - shocked_cogs

        baseline_gross_margin_pct = self._margin_pct(
            baseline_gross_profit, baseline_revenue
        )
        shocked_gross_margin_pct = self._margin_pct(
            shocked_gross_profit, baseline_revenue
        )

        baseline_operating_profit = (
            baseline_gross_profit - inputs.operating_expenses
        )
        shocked_operating_profit = (
            shocked_gross_profit - inputs.operating_expenses
        )

        baseline_cash_requirement = (
            baseline_cogs + inputs.operating_expenses
        )
        shocked_cash_requirement = (
            shocked_cogs + inputs.operating_expenses
        )

        return ImpactResult(
            baseline_revenue=money(baseline_revenue),
            shocked_revenue=money(baseline_revenue),
            baseline_imported_cost=money(baseline_imported_cost),
            shocked_imported_cost=money(shocked_imported_cost),
            imported_cost_impact=money(
                shocked_imported_cost - baseline_imported_cost
            ),
            baseline_cogs=money(baseline_cogs),
            shocked_cogs=money(shocked_cogs),
            cogs_impact=money(shocked_cogs - baseline_cogs),
            baseline_gross_profit=money(baseline_gross_profit),
            shocked_gross_profit=money(shocked_gross_profit),
            baseline_gross_margin_pct=percent(baseline_gross_margin_pct),
            shocked_gross_margin_pct=percent(shocked_gross_margin_pct),
            gross_margin_change_pct_points=percent(
                shocked_gross_margin_pct - baseline_gross_margin_pct
            ),
            baseline_operating_profit=money(baseline_operating_profit),
            shocked_operating_profit=money(shocked_operating_profit),
            profit_impact=money(
                shocked_operating_profit - baseline_operating_profit
            ),
            baseline_cash_requirement=money(baseline_cash_requirement),
            shocked_cash_requirement=money(shocked_cash_requirement),
            cash_requirement_change=money(
                shocked_cash_requirement - baseline_cash_requirement
            ),
            revenue_change_pct=percent(
                self._change_pct(baseline_revenue, baseline_revenue)
            ),
            cogs_change_pct=percent(
                self._change_pct(baseline_cogs, shocked_cogs)
            ),
            profit_change_pct=percent(
                self._change_pct(
                    baseline_operating_profit,
                    shocked_operating_profit,
                )
            ),
        )

    def _validate(self, inputs: ImpactInputs) -> None:
        for field_name in self.REQUIRED_NON_NEGATIVE:
            value = getattr(inputs, field_name)
            if value < Decimal("0"):
                raise ImpactCalculationError(
                    f"{field_name} cannot be negative."
                )

        # A zero exchange rate is not meaningful for the imported-cost
        # calculation and therefore requires correction by the caller.
        if inputs.exchange_rate <= Decimal("0"):
            raise ImpactCalculationError(
                "exchange_rate must be greater than zero."
            )

        # The shock is a rate change. A value below -100% would make the
        # resulting exchange rate invalid.
        if inputs.exchange_rate_change <= Decimal("-1"):
            raise ImpactCalculationError(
                "exchange_rate_change must be greater than -100%."
            )

    @staticmethod
    def _margin_pct(gross_profit: Decimal, revenue: Decimal) -> Decimal:
        if revenue == Decimal("0"):
            return Decimal("0")
        return (gross_profit / revenue) * Decimal("100")

    @staticmethod
    def _change_pct(
        baseline: Decimal,
        shocked: Decimal,
    ) -> Decimal:
        if baseline == Decimal("0"):
            return Decimal("0")
        return ((shocked - baseline) / abs(baseline)) * Decimal("100")
