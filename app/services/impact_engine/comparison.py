from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .scenarios import ScenarioResult


@dataclass(frozen=True)
class ScenarioComparison:
    name: str
    cost_impact: Decimal
    margin: Decimal
    cash_requirement: Decimal
    profit_impact: Decimal
    trade_offs: tuple[str, ...]


class DeterministicScenarioComparator:
    """
    Produces transparent side-by-side scenario data.

    This component does not select a winning scenario. It only exposes
    calculated outcomes and rule-based trade-off descriptions.
    """

    def compare(
        self,
        scenarios: list[ScenarioResult],
    ) -> list[ScenarioComparison]:
        return [
            self._build_comparison(scenario)
            for scenario in scenarios
        ]

    @staticmethod
    def _build_comparison(
        scenario: ScenarioResult,
    ) -> ScenarioComparison:
        projected = scenario.projected

        trade_offs: list[str] = []

        if projected.profit_impact > Decimal("0"):
            trade_offs.append("projected_profit_increases")
        elif projected.profit_impact < Decimal("0"):
            trade_offs.append("projected_profit_decreases")
        else:
            trade_offs.append("projected_profit_unchanged")

        if projected.cash_requirement_change > Decimal("0"):
            trade_offs.append("cash_requirement_increases")
        elif projected.cash_requirement_change < Decimal("0"):
            trade_offs.append("cash_requirement_decreases")
        else:
            trade_offs.append("cash_requirement_unchanged")

        if projected.gross_margin_change_pct_points > Decimal("0"):
            trade_offs.append("gross_margin_improves")
        elif projected.gross_margin_change_pct_points < Decimal("0"):
            trade_offs.append("gross_margin_declines")
        else:
            trade_offs.append("gross_margin_unchanged")

        return ScenarioComparison(
            name=scenario.name,
            cost_impact=projected.cogs_impact,
            margin=projected.shocked_gross_margin_pct,
            cash_requirement=projected.shocked_cash_requirement,
            profit_impact=projected.profit_impact,
            trade_offs=tuple(trade_offs),
        )
