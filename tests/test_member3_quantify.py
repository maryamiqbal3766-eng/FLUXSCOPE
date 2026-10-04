from decimal import Decimal

import pytest

from app.services.impact_engine.calculator import (
    DeterministicImpactCalculator,
    ImpactCalculationError,
    ImpactInputs,
)


def test_quantify_calculates_exchange_rate_shock_deterministically():
    inputs = ImpactInputs(
        sales_quantity=Decimal("100"),
        selling_price_per_unit=Decimal("1000"),
        imported_quantity=Decimal("100"),
        imported_unit_cost=Decimal("10"),
        exchange_rate=Decimal("280"),
        local_input_cost=Decimal("200000"),
        operating_expenses=Decimal("100000"),
        exchange_rate_change=Decimal("0.10"),
    )

    result = DeterministicImpactCalculator().calculate(inputs)

    assert result.baseline_revenue == Decimal("100000.00")
    assert result.baseline_imported_cost == Decimal("280000.00")
    assert result.shocked_imported_cost == Decimal("308000.00")
    assert result.imported_cost_impact == Decimal("28000.00")

    assert result.baseline_cogs == Decimal("480000.00")
    assert result.shocked_cogs == Decimal("508000.00")
    assert result.cogs_impact == Decimal("28000.00")

    assert result.baseline_gross_profit == Decimal("-380000.00")
    assert result.shocked_gross_profit == Decimal("-408000.00")
    assert result.profit_impact == Decimal("-28000.00")

    assert result.cash_requirement_change == Decimal("28000.00")


def test_quantify_rejects_missing_or_invalid_negative_values():
    inputs = ImpactInputs(
        sales_quantity=Decimal("-1"),
        selling_price_per_unit=Decimal("1000"),
        imported_quantity=Decimal("100"),
        imported_unit_cost=Decimal("10"),
        exchange_rate=Decimal("280"),
        local_input_cost=Decimal("200000"),
        operating_expenses=Decimal("100000"),
        exchange_rate_change=Decimal("0.10"),
    )

    with pytest.raises(ImpactCalculationError):
        DeterministicImpactCalculator().calculate(inputs)


def test_quantify_rejects_invalid_exchange_rate_shock():
    inputs = ImpactInputs(
        sales_quantity=Decimal("100"),
        selling_price_per_unit=Decimal("1000"),
        imported_quantity=Decimal("100"),
        imported_unit_cost=Decimal("10"),
        exchange_rate=Decimal("280"),
        local_input_cost=Decimal("200000"),
        operating_expenses=Decimal("100000"),
        exchange_rate_change=Decimal("-1"),
    )

    with pytest.raises(ImpactCalculationError):
        DeterministicImpactCalculator().calculate(inputs)
