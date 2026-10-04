from __future__ import annotations

from .monitor import EconomicMonitor
from .schemas import ShockCandidate, SourceDocument


class EconomicIntelligenceService:
    """Member 2 application service.

    This is deliberately small so Member 1 can adapt it to the existing
    EconomicIntelligencePort without replacing the current orchestration.
    """

    def __init__(self, monitor: EconomicMonitor):
        self.monitor = monitor
        self._events: dict[str, ShockCandidate] = {}

    def detect(self, source: SourceDocument) -> list[ShockCandidate]:
        events = self.monitor.detect_from_source(source)
        for event in events:
            self._events[str(event.shock_id)] = event
        return events

    def list_events(self) -> list[ShockCandidate]:
        return list(self._events.values())

    def get_event(self, shock_id: str) -> ShockCandidate | None:
        return self._events.get(shock_id)
