from uuid import uuid4

from app.services.impact_engine.graph import ImpactGraphBuilder
from app.services.impact_engine.schemas import ImpactNodeType


def test_impact_graph_contains_required_propagation_chain():
    shock_id = uuid4()
    business_id = uuid4()

    graph = ImpactGraphBuilder().build(
        shock_event_id=shock_id,
        business_id=business_id,
        shock_label="USD/PKR increase",
        dependency="Imported raw material",
        operational_effect="Material cost increases",
        financial_effect="Gross margin decreases",
    )

    assert graph.shock_event_id == shock_id
    assert graph.business_id == business_id
    assert len(graph.nodes) == 4
    assert len(graph.edges) == 3

    node_types = {node.node_type for node in graph.nodes}

    assert ImpactNodeType.ECONOMIC_SHOCK in node_types
    assert ImpactNodeType.BUSINESS_DEPENDENCY in node_types
    assert ImpactNodeType.OPERATIONAL_EFFECT in node_types
    assert ImpactNodeType.FINANCIAL_EFFECT in node_types
