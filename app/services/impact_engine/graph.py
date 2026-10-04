from __future__ import annotations

from uuid import UUID

from .schemas import ImpactEdge, ImpactGraph, ImpactNode, ImpactNodeType


class ImpactGraphBuilder:
    """Builds the TRACE propagation graph from explicitly supplied mappings."""

    def build(
        self,
        *,
        shock_event_id: UUID,
        business_id: UUID,
        dependency: str,
        operational_effect: str,
        financial_effect: str,
        shock_label: str,
    ) -> ImpactGraph:

        shock = ImpactNode(
            node_type=ImpactNodeType.ECONOMIC_SHOCK,
            label=shock_label,
        )

        dependency_node = ImpactNode(
            node_type=ImpactNodeType.BUSINESS_DEPENDENCY,
            label=dependency,
        )

        operational_node = ImpactNode(
            node_type=ImpactNodeType.OPERATIONAL_EFFECT,
            label=operational_effect,
        )

        financial_node = ImpactNode(
            node_type=ImpactNodeType.FINANCIAL_EFFECT,
            label=financial_effect,
        )

        nodes = [
            shock,
            dependency_node,
            operational_node,
            financial_node,
        ]

        edges = [
            ImpactEdge(
                source_node_id=shock.id,
                target_node_id=dependency_node.id,
                relationship="affects",
            ),
            ImpactEdge(
                source_node_id=dependency_node.id,
                target_node_id=operational_node.id,
                relationship="causes",
            ),
            ImpactEdge(
                source_node_id=operational_node.id,
                target_node_id=financial_node.id,
                relationship="affects",
            ),
        ]

        return ImpactGraph(
            shock_event_id=shock_event_id,
            business_id=business_id,
            nodes=nodes,
            edges=edges,
        )
