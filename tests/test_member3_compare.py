from decimal import Decimal

from app.services.impact_engine.calculator import ImpactInputs
from app.services.impact_engine.comparison import (
    DeterministicScenarioComparator,
)
from app.services.impact_engine.scenarios import (
    DeterministicScenarioEngine,
    ScenarioChanges,
    ScenarioDefinition,
)


def inputs() -> ImpactInputs:
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


def test_compare_returns_side_by_side_calculated_outcomes():
    engine = DeterministicScenarioEngine()

    price = engine.run(
        baseline_inputs=inputs(),
        scenario=ScenarioDefinition(
            name="Price adjustment",
            changes=ScenarioChanges(
                selling_price_per_unit=Decimal("1040"),
            ),
        ),
    )

    quantity = engine.run(
        baseline_inputs=inputs(),
        scenario=ScenarioDefinition(
            name="Reduce imported quantity",
            changes=ScenarioChanges(
                imported_quantity=Decimal("85"),
            ),
        ),
    )

    results = DeterministicScenarioComparator().compare(
        [price, quantity]
    )

    assert len(results) == 2
    assert results[0].name == "Price adjustment"
    assert results[1].name == "Reduce imported quantity"

    assert results[0].profit_impact > Decimal("0")
    assert results[1].cost_impact < Decimal("0")
    assert "projected_profit_increases" in results[0].trade_offs
    assert "cash_requirement_decreases" in results[1].trade_offs


def test_compare_does_not_select_a_winner():
    engine = DeterministicScenarioEngine()

    scenario = engine.run(
        baseline_inputs=inputs(),
        scenario=ScenarioDefinition(
            name="Absorb cost",
            changes=ScenarioChanges(),
        ),
    )

    result = DeterministicScenarioComparator().compare([scenario])[0]

    assert result.name == "Absorb cost"
    assert not hasattr(result, "winner")
    assert not hasattr(result, "recommendation")
