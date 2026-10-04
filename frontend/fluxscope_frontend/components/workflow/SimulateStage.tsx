"use client";

import { useState } from "react";
import {
  confirmScenario,
  createScenario,
  runScenario,
  toApiError,
  type ApiError,
  type BusinessProfile,
  type ImpactResultRecord,
  type ScenarioAssumption,
  type ScenarioDefinition,
  type ScenarioResultRecord,
} from "../../lib/api";
import {
  SCENARIO_FIELDS,
  isDecimal,
  percentPointsToFraction,
  type StageStatus,
} from "../../lib/workflow";
import { MetricsTable } from "./QuantifyStage";
import {
  ActionButton,
  Badge,
  ErrorNotice,
  InfoNotice,
  LockedNotice,
  NextStep,
  StageFrame,
  StepTitle,
} from "./ui";

export type ScenarioRun = {
  definition: ScenarioDefinition;
  result: ScenarioResultRecord | null;
};

type Props = {
  status: StageStatus;
  profile: BusinessProfile | null;
  impact: ImpactResultRecord | null;
  runs: ScenarioRun[];
  onRunsChange: (update: (runs: ScenarioRun[]) => ScenarioRun[]) => void;
};

const FX_DELTA_FIELD = "exchange_rate_change_delta";

export default function SimulateStage({ status, profile, impact, runs, onRunsChange }: Props) {
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [fxDelta, setFxDelta] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [runErrors, setRunErrors] = useState<Record<string, ApiError>>({});

  const fxFraction = fxDelta.trim() ? percentPointsToFraction(fxDelta) : null;
  const invalid = [
    ...SCENARIO_FIELDS.filter((field) => values[field.key]?.trim() && !isDecimal(values[field.key])).map(
      (field) => field.label,
    ),
    ...(fxDelta.trim() && fxFraction === null ? ["Additional exchange-rate change"] : []),
  ];

  const assumptions: ScenarioAssumption[] = [
    ...SCENARIO_FIELDS.filter((field) => values[field.key]?.trim() && isDecimal(values[field.key])).map(
      (field) => ({ field_reference: field.key, value: values[field.key].trim(), unit: field.unit }),
    ),
    ...(fxFraction !== null ? [{ field_reference: FX_DELTA_FIELD, value: fxFraction, unit: "decimal_fraction" }] : []),
  ];

  function setRun(id: string, update: (run: ScenarioRun) => ScenarioRun) {
    onRunsChange((current) => current.map((run) => (run.definition.id === id ? update(run) : run)));
  }

  function setRunError(id: string, error: ApiError | null) {
    setRunErrors((current) => {
      const next = { ...current };
      if (error) next[id] = error;
      else delete next[id];
      return next;
    });
  }

  async function handleCreate() {
    if (!impact) return;
    setBusy("create");
    setFormError(null);
    try {
      const definition = await createScenario({
        business_id: impact.business_id,
        base_impact_result_id: impact.id,
        name: name.trim(),
        changed_assumptions: assumptions,
      });
      onRunsChange((current) => [...current, { definition, result: null }]);
      setName("");
      setValues({});
      setFxDelta("");
    } catch (err) {
      setFormError(toApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirm(id: string) {
    setBusy(`confirm-${id}`);
    setRunError(id, null);
    try {
      const definition = await confirmScenario(id);
      setRun(id, (run) => ({ ...run, definition }));
    } catch (err) {
      setRunError(id, toApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleRun(id: string) {
    setBusy(`run-${id}`);
    setRunError(id, null);
    try {
      const result = await runScenario(id);
      setRun(id, (run) => ({
        definition: { ...run.definition, processing_status: "completed" },
        result,
      }));
    } catch (err) {
      setRunError(id, toApiError(err));
    } finally {
      setBusy(null);
    }
  }

  const completed = runs.filter((run) => run.result);

  return (
    <StageFrame
      id="stage-simulate"
      number={4}
      tag="≋ SIMULATE"
      title="What if you respond differently?"
      status={status}
      explanation={
        <>
          <p>
            Define a response as explicit assumptions. Each one replaces a value in your confirmed
            baseline, or adds to the verified exchange-rate change. You confirm the assumptions, then the
            deterministic engine recalculates them. Results are projections compared against the
            after-shock position from QUANTIFY.
          </p>
          <p>
            <b>Next:</b> run at least one scenario, then COMPARE them side by side.
          </p>
        </>
      }
    >
      {!impact || !profile ? (
        <LockedNotice
          requirement="Complete QUANTIFY first. Scenarios are recalculated from that deterministic result."
          href="#stage-quantify"
        />
      ) : (
        <>
          <StepTitle index={1}>Describe a response</StepTitle>
          <div className="wfGrid">
            <label className="wfField wfFieldWide">
              <span>Scenario name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
              <small>Describe the response in your own words, e.g. “Raise price” or “Buy fewer imports”.</small>
            </label>
            {SCENARIO_FIELDS.map((field) => {
              const current = field.replaces ? profile.confirmed_fields[field.replaces]?.value : undefined;
              const value = values[field.key] ?? "";
              const bad = value.trim() !== "" && !isDecimal(value);
              return (
                <label key={field.key} className={`wfField ${bad ? "wfFieldBad" : ""}`}>
                  <span>
                    {field.label} <em>({field.unit})</em>
                  </span>
                  <input
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  />
                  <small>
                    {bad
                      ? "Enter a non-negative number."
                      : `${field.help} Confirmed value: ${current ?? "not provided"}.`}
                  </small>
                </label>
              );
            })}
            <label className={`wfField ${fxDelta.trim() && fxFraction === null ? "wfFieldBad" : ""}`}>
              <span>
                Additional exchange-rate change <em>(percentage points)</em>
              </span>
              <input inputMode="decimal" value={fxDelta} onChange={(event) => setFxDelta(event.target.value)} />
              <small>
                Added to the verified shock. Enter 5 for a further +5%. Sent to the engine as a decimal
                fraction{fxFraction !== null ? `: ${fxFraction}` : " (5 → 0.05)"}.
              </small>
            </label>
          </div>

          {assumptions.length > 0 ? (
            <InfoNotice title="Assumptions that will be sent">
              <ul className="wfPlainList">
                {assumptions.map((item) => (
                  <li key={item.field_reference}>
                    <code>{item.field_reference}</code> = {item.value} ({item.unit})
                  </li>
                ))}
              </ul>
            </InfoNotice>
          ) : null}

          <div className="wfActions">
            <ActionButton
              onClick={handleCreate}
              busy={busy === "create"}
              disabled={!name.trim() || assumptions.length === 0 || invalid.length > 0}
            >
              Create scenario draft
            </ActionButton>
            {!name.trim() || assumptions.length === 0 ? (
              <span className="wfHint">Enter a name and at least one changed assumption.</span>
            ) : invalid.length ? (
              <span className="wfHint">Fix: {invalid.join(", ")}.</span>
            ) : null}
          </div>
          {formError ? <ErrorNotice error={formError} title="The scenario was not created" /> : null}

          {runs.length > 0 ? <StepTitle index={2}>Confirm and run your scenarios</StepTitle> : null}
          {runs.map(({ definition, result }) => {
            const confirmed = definition.assumption_confirmation_status === "confirmed";
            const runError = runErrors[definition.id];
            return (
              <article key={definition.id} className="wfCard">
                <header>
                  <strong>{definition.name}</strong>
                  <Badge tone={result ? "ok" : confirmed ? "neutral" : "warn"}>
                    {result ? "simulated" : definition.assumption_confirmation_status}
                  </Badge>
                </header>
                <ul className="wfPlainList">
                  {definition.changed_assumptions.map((item) => (
                    <li key={item.field_reference}>
                      <code>{item.field_reference}</code> = {item.value} {item.unit ? `(${item.unit})` : ""}
                    </li>
                  ))}
                </ul>
                {!result ? (
                  <div className="wfActions">
                    {!confirmed ? (
                      <ActionButton
                        onClick={() => handleConfirm(definition.id)}
                        busy={busy === `confirm-${definition.id}`}
                      >
                        I confirm these assumptions
                      </ActionButton>
                    ) : (
                      <ActionButton onClick={() => handleRun(definition.id)} busy={busy === `run-${definition.id}`}>
                        Run scenario
                      </ActionButton>
                    )}
                    <span className="wfHint">
                      {confirmed
                        ? "Confirmed by you. The engine will now recalculate."
                        : "The backend refuses to run a scenario until you confirm its assumptions."}
                    </span>
                  </div>
                ) : null}
                {runError ? <ErrorNotice error={runError} title="The scenario did not run" /> : null}
                {result ? (
                  <>
                    <MetricsTable
                      metrics={result.result.projected}
                      beforeLabel="After shock (QUANTIFY)"
                      afterLabel="With this response"
                    />
                    <p className="wfHint">
                      Projected by the deterministic engine. Scenario result ID <code>{result.id}</code>.
                    </p>
                  </>
                ) : null}
              </article>
            );
          })}

          {completed.length > 0 ? (
            <NextStep href="#stage-compare">Continue to COMPARE ({completed.length} simulated)</NextStep>
          ) : null}
        </>
      )}
    </StageFrame>
  );
}
