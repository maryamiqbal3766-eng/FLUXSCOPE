from uuid import UUID

from app.core.errors import ContractError
from app.models.domain import (
    BusinessIntakeDraft,
    BusinessProfile,
    EconomicShockEvent,
    HumanDecision,
    ScenarioDefinition,
)


class InMemoryStore:
    """Replaceable development repository; no persistence behavior is assumed."""

    def __init__(self) -> None:
        self.shocks: dict[UUID, EconomicShockEvent] = {}
        self.intake_drafts: dict[UUID, BusinessIntakeDraft] = {}
        self.profiles: dict[UUID, BusinessProfile] = {}
        self.impact_mappings = {}
        self.impact_results = {}
        self.scenarios: dict[UUID, ScenarioDefinition] = {}
        self.scenario_results = {}
        self.comparisons: dict[UUID, dict] = {}
        self.decisions: dict[UUID, HumanDecision] = {}


    @staticmethod
    def required(collection: dict[UUID, object], key: UUID, resource: str) -> object:
        try:
            return collection[key]
        except KeyError as exc:
            raise ContractError(404, "RESOURCE_NOT_FOUND", f"{resource} was not found.") from exc


