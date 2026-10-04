from decimal import Decimal

import pytest

from app.services.impact_engine.calculator import ImpactInputs
from app.services.impact_engine.scenarios import (
    DeterministicScenarioEngine,
    ScenarioChanges,
    ScenarioDefinition,
    ScenarioValidationError,
)


def baseline_inputs() -> ImpactInputs:
    return ImpactInputs(
        sales_quantity=Decimal("100"),
        selling_price_per_unit=Decimal("1000"),
        imported_quantity=Decimal("100"),
        imported_unit_cost=Decimal("10"),
        exchange_rate=Decimal("280"),
        local_input_cost=Decimal("200000"),
        operating_expenses=Decimal("100000"),
        exchange_rate_change=Decimal("0.10"),
    )


def test_scenario_changes_price_and_recalculates_deterministically():
    scenario = ScenarioDefinition(
        name="Price adjustment",
        changes=ScenarioChanges(
            selling_price_per_unit=Decimal("1040"),
        ),
    )

    result = DeterministicScenarioEngine().run(
        baseline_inputs=baseline_inputs(),
        scenario=scenario,
    )

    assert result.name == "Price adjustment"
    assert result.baseline.baseline_revenue == Decimal("100000.00")
    assert result.projected.shocked_revenue == Decimal("104000.00")
    assert result.projected.shocked_imported_cost == Decimal("308000.00")


def test_scenario_can_reduce_imported_quantity():
    scenario = ScenarioDefinition(
        name="Reduce imported quantity",
        changes=ScenarioChanges(
            imported_quantity=Decimal("85"),
        ),
    )

    result = DeterministicScenarioEngine().run(
        baseline_inputs=baseline_inputs(),
        scenario=scenario,
    )

    assert result.projected.shocked_imported_cost == Decimal("261800.00")
    assert result.projected.cogs_impact == Decimal("-46200.00")


def test_scenario_can_change_exchange_rate_assumption():
    scenario = ScenarioDefinition(
        name="Higher FX shock",
        changes=ScenarioChanges(
            exchange_rate_change_delta=Decimal("0.05"),
        ),
    )

    result = DeterministicScenarioEngine().run(
        baseline_inputs=baseline_inputs(),
        scenario=scenario,
    )

    assert result.projected.shocked_imported_cost == Decimal("322000.00")


def test_scenario_rejects_empty_name():
    scenario = ScenarioDefinition(
        name="   ",
        changes=ScenarioChanges(),
    )

    with pytest.raises(ScenarioValidationError):
        DeterministicScenarioEngine().run(
            baseline_inputs=baseline_inputs(),
            scenario=scenario,
        )
