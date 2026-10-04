"use client";

import { useState } from "react";
import {
  recordMonitoringInput,
  toApiError,
  type ApiError,
  type HumanDecision,
  type MonitoringResult,
} from "../../lib/api";
import {
  MONITOR_METRICS,
  formatSigned,
  formatValue,
  humanize,
  type StageStatus,
} from "../../lib/workflow";
import {
  ActionButton,
  Badge,
  ErrorNotice,
  InfoNotice,
  LockedNotice,
  StageFrame,
  StepTitle,
} from "./ui";

export type MonitoringEntry = {
  result: MonitoringResult;
  unit: string;
  observedOn: string;
  reference: string;
};

type Props = {
  status: StageStatus;
  decision: HumanDecision | null;
  entries: MonitoringEntry[];
  onEvaluated: (entry: MonitoringEntry) => void;
};

const NEGATIVE_DECIMAL = /^-?\d+(\.\d+)?$/;

function statusTone(status: MonitoringResult["status"]): "ok" | "warn" | "bad" {
  if (status === "ON_TRACK") return "ok";
  if (status === "VARIANCE_DETECTED") return "warn";
  return "bad";
}

export default function MonitorStage({ status, decision, entries, onEvaluated }: Props) {
  const [metric, setMetric] = useState("");
  const [actual, setActual] = useState("");
  const [unit, setUnit] = useState("");
  const [observedOn, setObservedOn] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const confirmed = decision?.decision_status === "confirmed";
  const actualInvalid = actual.trim() !== "" && !NEGATIVE_DECIMAL.test(actual.trim());
  const ready = metric && actual.trim() && !actualInvalid && unit.trim() && observedOn && reference.trim();

  function chooseMetric(key: string) {
    setMetric(key);
    const definition = MONITOR_METRICS.find((item) => item.key === key);
    if (definition) setUnit(definition.unit);
  }

  async function handleEvaluate() {
    if (!decision) return;
    setBusy(true);
    setError(null);
    try {
      const result = await recordMonitoringInput({
        business_id: decision.business_id,
        human_decision_id: decision.id,
        metric_name: metric,
        actual_value: actual.trim(),
        unit: unit.trim(),
        observed_at: `${observedOn}T00:00:00Z`,
        provenance_or_business_input_reference: reference.trim(),
      });
      onEvaluated({ result, unit: unit.trim(), observedOn, reference: reference.trim() });
      setActual("");
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StageFrame
      id="stage-monitor"
      number={7}
      tag="↗ MONITOR"
      title="Is reality tracking the projection?"
      status={status}
      explanation={
        <>
          <p>
            After your decision, enter actual results as they happen. The backend compares each actual
            value with the stored projection of the scenario you chose and assigns a monitoring status.
          </p>
          <p>
            <b>Next:</b> if the status shows a large variance, revisit SIMULATE with updated
            assumptions.
          </p>
        </>
      }
    >
      {!confirmed ? (
        <LockedNotice
          requirement="Confirm a decision in RESPOND first. Monitoring is only tied to a confirmed owner decision."
          href="#stage-respond"
        />
      ) : (
        <>
          {decision?.selected_scenario_id === null ? (
            <InfoNotice tone="warn" title="This response has no stored projection">
              <p>
                You confirmed an owner-defined response. The backend can only compare actual results
                against a selected scenario’s projection, so it will report a clarification blocker.
              </p>
            </InfoNotice>
          ) : null}
          <StepTitle index={1}>Enter an actual result</StepTitle>
          <div className="wfGrid">
            <label className="wfField">
              <span>Metric</span>
              <select value={metric} onChange={(event) => chooseMetric(event.target.value)}>
                <option value="">Select a metric…</option>
                {MONITOR_METRICS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <small>Only metrics with a stored scenario projection can be compared.</small>
            </label>
            <label className={`wfField ${actualInvalid ? "wfFieldBad" : ""}`}>
              <span>Actual value</span>
              <input inputMode="decimal" value={actual} onChange={(event) => setActual(event.target.value)} />
              <small>{actualInvalid ? "Enter a number, e.g. 182500 or -1200." : "The figure you actually observed."}</small>
            </label>
            <label className="wfField">
              <span>Unit</span>
              <input value={unit} onChange={(event) => setUnit(event.target.value)} />
              <small>Use the same unit as the projection (PKR, or percent for gross margin).</small>
            </label>
            <label className="wfField">
              <span>Observed on</span>
              <input type="date" value={observedOn} onChange={(event) => setObservedOn(event.target.value)} />
            </label>
            <label className="wfField wfFieldWide">
              <span>Where this figure comes from</span>
              <input value={reference} onChange={(event) => setReference(event.target.value)} />
              <small>For example, a ledger, an invoice batch or a monthly report. This is stored as the actual value’s reference.</small>
            </label>
          </div>
          <div className="wfActions">
            <ActionButton onClick={handleEvaluate} busy={busy} disabled={!ready}>
              Compare actual with projection
            </ActionButton>
            {!ready ? <span className="wfHint">Fill in every field to compare.</span> : null}
          </div>
          {error ? <ErrorNotice error={error} title="MONITOR did not complete" /> : null}

          {entries.length > 0 ? (
            <>
              <StepTitle index={2}>Actual vs projected</StepTitle>
              <div className="wfTableScroll">
                <table className="wfTable wfNumbers">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Projected</th>
                      <th>Actual</th>
                      <th>Variance</th>
                      <th>Variance %</th>
                      <th>Status</th>
                      <th>Observed / source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => (
                      <tr key={index}>
                        <td>
                          {humanize(entry.result.metric_name)} <em>({entry.unit})</em>
                        </td>
                        <td>{formatValue(entry.result.projected_value)}</td>
                        <td>{formatValue(entry.result.actual_value)}</td>
                        <td>{formatSigned(entry.result.variance)}</td>
                        <td>{formatSigned(entry.result.variance_pct)}%</td>
                        <td>
                          <Badge tone={statusTone(entry.result.status)}>{humanize(entry.result.status)}</Badge>
                        </td>
                        <td>
                          {entry.observedOn} · {entry.reference}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <InfoNotice title="Current monitoring limitations (from the backend)">
            <ul className="wfPlainList">
              <li>
                Status thresholds are a temporary MVP rule in the backend, not an agreed product rule:
                on track within 5% of the projected value, variance detected up to 10%, reassessment
                required beyond that.
              </li>
              <li>
                The backend does not store monitoring results. This list lasts only for the current
                browser session.
              </li>
              <li>
                Multi-record projection comparison (<code>POST /projection-comparisons</code>) is not
                connected in the backend and returns 424 UPSTREAM_UNAVAILABLE, so it is not offered here.
              </li>
            </ul>
          </InfoNotice>
        </>
      )}
    </StageFrame>
  );
}
