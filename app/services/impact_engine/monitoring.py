from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class MonitoringStatus(str, Enum):
    ON_TRACK = "ON_TRACK"
    VARIANCE_DETECTED = "VARIANCE_DETECTED"
    REASSESSMENT_REQUIRED = "REASSESSMENT_REQUIRED"


@dataclass(frozen=True)
class ProjectionMetric:
    metric_name: str
    projected_value: Decimal
    actual_value: Decimal
    tolerance: Decimal


@dataclass(frozen=True)
class MonitoringResult:
    metric_name: str
    projected_value: Decimal
    actual_value: Decimal
    variance: Decimal
    variance_pct: Decimal
    status: MonitoringStatus


class DeterministicMonitoringEngine:
    """
    Compares actual business results against approved projections.

    This engine does not invent thresholds. The caller explicitly supplies
    the tolerance for each metric.

    Status rules:
    - ON_TRACK: absolute variance is within tolerance.
    - VARIANCE_DETECTED: variance exceeds tolerance but is not more than
      twice the tolerance.
    - REASSESSMENT_REQUIRED: variance is more than twice the tolerance.

    These are transparent MVP rules and are intentionally isolated here so
    the thresholds can later be replaced by an approved product rule.
    """

    def evaluate(
        self,
        metric: ProjectionMetric,
    ) -> MonitoringResult:
        if not metric.metric_name.strip():
            raise ValueError("metric_name cannot be empty.")

        if metric.tolerance < Decimal("0"):
            raise ValueError("tolerance cannot be negative.")

        variance = metric.actual_value - metric.projected_value

        if metric.projected_value == Decimal("0"):
            variance_pct = Decimal("0")
        else:
            variance_pct = (
                variance
                / abs(metric.projected_value)
            ) * Decimal("100")

        absolute_variance = abs(variance)

        if absolute_variance <= metric.tolerance:
            status = MonitoringStatus.ON_TRACK
        elif absolute_variance <= (
            metric.tolerance * Decimal("2")
        ):
            status = MonitoringStatus.VARIANCE_DETECTED
        else:
            status = MonitoringStatus.REASSESSMENT_REQUIRED

        return MonitoringResult(
            metric_name=metric.metric_name,
            projected_value=metric.projected_value,
            actual_value=metric.actual_value,
            variance=variance,
            variance_pct=variance_pct,
            status=status,
        )
