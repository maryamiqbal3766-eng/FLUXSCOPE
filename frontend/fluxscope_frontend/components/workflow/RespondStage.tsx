"use client";

import { useState } from "react";
import {
  confirmDecision,
  createDecision,
  toApiError,
  type ApiError,
  type ComparisonSet,
  type HumanDecision,
} from "../../lib/api";
import { formatDate, type StageStatus } from "../../lib/workflow";
import type { ScenarioRun } from "./SimulateStage";
import {
  ActionButton,
  Badge,
  ErrorNotice,
  InfoNotice,
  KeyValues,
  LockedNotice,
  NextStep,
  StageFrame,
  StepTitle,
} from "./ui";

type Props = {
  status: StageStatus;
  comparison: ComparisonSet | null;
  runs: ScenarioRun[];
  decision: HumanDecision | null;
  onDecision: (decision: HumanDecision) => void;
};

const OWNER_DEFINED = "owner-defined";

export default function RespondStage({ status, comparison, runs, decision, onDecision }: Props) {
  const [choice, setChoice] = useState("");
  const [ownerText, setOwnerText] = useState("");
  const [confirmedBy, setConfirmedBy] = useState("");
  const [busy, setBusy] = useState<"record" | "confirm" | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  // Scenarios in the comparison, resolved to their scenario definitions.
  const options = (comparison?.scenario_result_ids ?? [])
    .map((resultId) => runs.find((run) => run.result?.id === resultId))
    .filter((run): run is ScenarioRun => Boolean(run));

  const canRecord = choice === OWNER_DEFINED ? ownerText.trim().length > 0 : choice !== "";

  async function handleRecord() {
    if (!comparison) return;
    setBusy("record");
    setError(null);
    try {
      onDecision(
        await createDecision({
          business_id: comparison.business_id,
          comparison_set_id: comparison.id,
          ...(choice === OWNER_DEFINED
            ? { owner_defined_response: ownerText.trim() }
            : { selected_scenario_id: choice }),
        }),
      );
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirm() {
    if (!decision) return;
    setBusy("confirm");
    setError(null);
    try {
      onDecision(await confirmDecision(decision.id, confirmedBy.trim()));
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(null);
    }
  }

  const chosenName = decision?.selected_scenario_id
    ? runs.find((run) => run.definition.id === decision.selected_scenario_id)?.definition.name
    : null;

  return (
    <StageFrame
      id="stage-respond"
      number={6}
      tag="▤ RESPOND"
      title="What response will you take?"
      status={status}
      explanation={
        <>
          <p>
            You make the decision. Choose one of the compared scenarios or describe your own response,
            then confirm it explicitly. FLUXSCOPE records your choice and never selects one for you.
          </p>
          <p>
            <b>Next:</b> MONITOR compares actual results against the projection of the response you
            chose.
          </p>
        </>
      }
    >
      {!comparison ? (
        <LockedNotice
          requirement="Compare at least one simulated scenario in COMPARE first. A decision references that comparison."
          href="#stage-compare"
        />
      ) : (
        <>
          {!decision ? (
            <>
              <StepTitle index={1}>Choose a response</StepTitle>
              <div className="wfChecks">
                {options.map((run) => (
                  <label key={run.definition.id} className="wfCheck">
                    <input
                      type="radio"
                      name="response"
                      value={run.definition.id}
                      checked={choice === run.definition.id}
                      onChange={() => setChoice(run.definition.id)}
                    />
                    {run.definition.name}
                  </label>
                ))}
                <label className="wfCheck">
                  <input
                    type="radio"
                    name="response"
                    value={OWNER_DEFINED}
                    checked={choice === OWNER_DEFINED}
                    onChange={() => setChoice(OWNER_DEFINED)}
                  />
                  My own response (not one of the scenarios)
                </label>
              </div>
              {choice === OWNER_DEFINED ? (
                <>
                  <label className="wfField wfFieldWide">
                    <span>Describe your response</span>
                    <textarea rows={3} value={ownerText} onChange={(event) => setOwnerText(event.target.value)} />
                  </label>
                  <InfoNotice tone="warn">
                    <p>
                      An owner-defined response has no calculated projection, so MONITOR cannot compare
                      actual results against it.
                    </p>
                  </InfoNotice>
                </>
              ) : null}
              <div className="wfActions">
                <ActionButton onClick={handleRecord} busy={busy === "record"} disabled={!canRecord}>
                  Record my selection
                </ActionButton>
                {!canRecord ? <span className="wfHint">Choose a response first.</span> : null}
              </div>
            </>
          ) : (
            <>
              <StepTitle index={1}>Your recorded response</StepTitle>
              <KeyValues
                rows={[
                  ["Response", chosenName ?? decision.owner_defined_response ?? "—"],
                  [
                    "Decision status",
                    <Badge key="s" tone={decision.decision_status === "confirmed" ? "ok" : "warn"}>
                      {decision.decision_status}
                    </Badge>,
                  ],
                  ["Confirmed by", decision.owner_confirmation_reference ?? "Not yet confirmed"],
                  ["Decided at", formatDate(decision.decided_at)],
                  ["Decision ID", <code key="d">{decision.id}</code>],
                ]}
              />
              {decision.decision_status === "selected" ? (
                <>
                  <StepTitle index={2}>Confirm the decision</StepTitle>
                  <label className="wfField">
                    <span>Confirmed by (owner name or reference)</span>
                    <input value={confirmedBy} onChange={(event) => setConfirmedBy(event.target.value)} />
                    <small>Recorded with the decision as the owner’s confirmation reference.</small>
                  </label>
                  <div className="wfActions">
                    <ActionButton onClick={handleConfirm} busy={busy === "confirm"} disabled={!confirmedBy.trim()}>
                      Confirm this decision
                    </ActionButton>
                  </div>
                </>
              ) : (
                <NextStep href="#stage-monitor">Continue to MONITOR</NextStep>
              )}
            </>
          )}
          {error ? <ErrorNotice error={error} title="RESPOND did not complete" /> : null}
        </>
      )}
    </StageFrame>
  );
}
