"use client";

import { useState } from "react";
import {
  createComparison,
  toApiError,
  type ApiError,
  type ComparisonSet,
  type ImpactResultRecord,
} from "../../lib/api";
import { formatSigned, formatValue, tradeOffLabel, type StageStatus } from "../../lib/workflow";
import type { ScenarioRun } from "./SimulateStage";
import {
  ActionButton,
  ErrorNotice,
  InfoNotice,
  LockedNotice,
  NextStep,
  StageFrame,
  StepTitle,
} from "./ui";

type Props = {
  status: StageStatus;
  impact: ImpactResultRecord | null;
  runs: ScenarioRun[];
  comparison: ComparisonSet | null;
  onCompared: (comparison: ComparisonSet) => void;
};

export default function CompareStage({ status, impact, runs, comparison, onCompared }: Props) {
  const completed = runs.filter((run): run is ScenarioRun & { result: NonNullable<ScenarioRun["result"]> } =>
    Boolean(run.result),
  );
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const selected = completed.filter((run) => !excluded.has(run.result.id));

  function toggle(id: string) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCompare() {
    if (!impact) return;
    setBusy(true);
    setError(null);
    try {
      onCompared(
        await createComparison({
          business_id: impact.business_id,
          base_impact_result_id: impact.id,
          scenario_result_ids: selected.map((run) => run.result.id),
        }),
      );
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function scenarioNameFor(resultId: string, fallback: string) {
    return completed.find((run) => run.result.id === resultId)?.definition.name ?? fallback;
  }

  return (
    <StageFrame
      id="stage-compare"
      number={5}
      tag="⚖ COMPARE"
      title="What are the trade-offs?"
      status={status}
      explanation={
        <>
          <p>
            The backend puts your simulated responses side by side using its deterministic outputs and
            rule-based trade-off tags. It does not rank them or pick a winner.
          </p>
          <p>
            <b>Next:</b> RESPOND, where you, the owner, record a decision.
          </p>
        </>
      }
    >
      {completed.length === 0 ? (
        <LockedNotice
          requirement="Run at least one confirmed scenario in SIMULATE. Only completed scenario results can be compared."
          href="#stage-simulate"
        />
      ) : (
        <>
          <StepTitle index={1}>Choose the scenarios to compare</StepTitle>
          <div className="wfChecks">
            {completed.map((run) => (
              <label key={run.result.id} className="wfCheck">
                <input
                  type="checkbox"
                  checked={!excluded.has(run.result.id)}
                  onChange={() => toggle(run.result.id)}
                />
                {run.definition.name}
              </label>
            ))}
          </div>
          <div className="wfActions">
            <ActionButton onClick={handleCompare} busy={busy} disabled={selected.length === 0}>
              {comparison ? "Compare again" : "Compare selected scenarios"}
            </ActionButton>
            {selected.length === 0 ? <span className="wfHint">Select at least one scenario.</span> : null}
          </div>
          {error ? <ErrorNotice error={error} title="COMPARE did not complete" /> : null}

          {comparison ? (
            <>
              <StepTitle index={2}>Side-by-side outcomes</StepTitle>
              <div className="wfTableScroll">
                <table className="wfTable wfNumbers">
                  <thead>
                    <tr>
                      <th>Response</th>
                      <th>COGS change vs after-shock (PKR)</th>
                      <th>Gross margin (%)</th>
                      <th>Cash requirement (PKR)</th>
                      <th>Operating profit change vs after-shock (PKR)</th>
                      <th>Trade-offs (rule-based)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.comparisons.map((row, index) => (
                      <tr key={comparison.scenario_result_ids[index] ?? index}>
                        <td>{scenarioNameFor(comparison.scenario_result_ids[index], row.name)}</td>
                        <td>{formatSigned(row.cost_impact)}</td>
                        <td>{formatValue(row.margin)}</td>
                        <td>{formatValue(row.cash_requirement)}</td>
                        <td>{formatSigned(row.profit_impact)}</td>
                        <td>{row.trade_offs.map(tradeOffLabel).join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <InfoNotice title="How to read this">
                <p>
                  Values are projections from the deterministic engine. FLUXSCOPE does not rank these
                  options. Risk levels are not shown because no deterministic risk rule has been agreed
                  yet. Comparison ID <code>{comparison.id}</code>.
                </p>
              </InfoNotice>
              <NextStep href="#stage-respond">Continue to RESPOND</NextStep>
            </>
          ) : null}
        </>
      )}
    </StageFrame>
  );
}
