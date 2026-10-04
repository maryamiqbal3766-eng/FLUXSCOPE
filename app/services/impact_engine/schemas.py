from __future__ import annotations

from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class ImpactNodeType(str, Enum):
    ECONOMIC_SHOCK = "economic_shock"
    BUSINESS_DEPENDENCY = "business_dependency"
    OPERATIONAL_EFFECT = "operational_effect"
    FINANCIAL_EFFECT = "financial_effect"


class ImpactNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID = Field(default_factory=uuid4)
    node_type: ImpactNodeType
    label: str = Field(min_length=1)
    source_reference: str | None = None


class ImpactEdge(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_node_id: UUID
    target_node_id: UUID
    relationship: str = Field(min_length=1)


class ImpactGraph(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID = Field(default_factory=uuid4)
    shock_event_id: UUID
    business_id: UUID
    nodes: list[ImpactNode] = Field(min_length=1)
    edges: list[ImpactEdge] = Field(default_factory=list)
