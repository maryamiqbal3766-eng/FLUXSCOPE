from typing import Protocol, Sequence

from app.models.domain import ImpactMappingRequest, ImpactResultRequest, ScenarioDefinition


class ImpactMappingPort(Protocol):
    """Member 3 plug-in boundary for TRACE mapping logic."""

    def create_mapping(self, request: ImpactMappingRequest) -> object: ...


class DeterministicImpactPort(Protocol):
    """Member 3 plug-in boundary; it alone may produce financial results."""

    def calculate_impact(self, request: ImpactResultRequest) -> object: ...
    def run_scenario(self, scenario: ScenarioDefinition) -> object: ...
    def compare_scenarios(self, request: object) -> object: ...
    def compare_projection(self, request: object) -> object: ...


class EconomicIntelligencePort(Protocol):
    """Member 2 plug-in boundary for approved-source economic intelligence."""

    def retrieve_shocks(self) -> object: ...


class LLMServicePort(Protocol):
    """Shared LLM boundary for Member 2; never a financial calculation interface."""

    @property
    def is_configured(self) -> bool: ...

    def complete(self, messages: Sequence[object]) -> str: ...
