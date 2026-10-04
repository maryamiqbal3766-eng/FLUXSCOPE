from decimal import Decimal

import pytest

from app.services.impact_engine.monitoring import (
    DeterministicMonitoringEngine,
    MonitoringStatus,
    ProjectionMetric,
)


def test_monitoring_marks_metric_on_track_within_tolerance():
    result = DeterministicMonitoringEngine().evaluate(
        ProjectionMetric(
            metric_name="COGS",
            projected_value=Decimal("500000"),
            actual_value=Decimal("504000"),
            tolerance=Decimal("10000"),
        )
    )

    assert result.variance == Decimal("4000")
    assert result.status == MonitoringStatus.ON_TRACK


def test_monitoring_detects_variance():
    result = DeterministicMonitoringEngine().evaluate(
        ProjectionMetric(
            metric_name="COGS",
            projected_value=Decimal("500000"),
            actual_value=Decimal("515000"),
            tolerance=Decimal("10000"),
        )
    )

    assert result.variance == Decimal("15000")
    assert result.status == MonitoringStatus.VARIANCE_DETECTED


def test_monitoring_requires_reassessment_for_large_variance():
    result = DeterministicMonitoringEngine().evaluate(
        ProjectionMetric(
            metric_name="COGS",
            projected_value=Decimal("500000"),
            actual_value=Decimal("525000"),
            tolerance=Decimal("10000"),
        )
    )

    assert result.variance == Decimal("25000")
    assert result.status == MonitoringStatus.REASSESSMENT_REQUIRED


def test_monitoring_rejects_negative_tolerance():
    with pytest.raises(ValueError):
        DeterministicMonitoringEngine().evaluate(
            ProjectionMetric(
                metric_name="COGS",
                projected_value=Decimal("500000"),
                actual_value=Decimal("505000"),
                tolerance=Decimal("-1"),
            )
        )
