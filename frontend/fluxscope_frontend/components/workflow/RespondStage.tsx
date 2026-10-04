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
import { useLanguage, useT } from "../../lib/i18n";
import { formatDate, rawTerm, type StageStatus } from "../../lib/workflow";
import type { ScenarioRun } from "./SimulateStage";
import {
  ActionButton,
  Badge,
  ErrorNotice,
  InfoNotice,
  KeyValues,
  LockedNotice,
  Ltr,
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
  const t = useT();
  const language = useLanguage();
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
      tag={t("▤ RESPOND", "▤ عمل · RESPOND")}
      title={t("What response will you take?", "آپ کیا ردِعمل اختیار کریں گے؟")}
      status={status}
      explanation={
        <>
          <p>
            {t(
              "You make the decision. Choose one of the compared scenarios or describe your own response, then confirm it explicitly. FLUXSCOPE records your choice and never selects one for you.",
              "فیصلہ آپ کرتے ہیں۔ موازنہ شدہ منظرناموں میں سے ایک منتخب کریں یا اپنا ردِعمل خود بیان کریں، پھر واضح طور پر اس کی تصدیق کریں۔ FLUXSCOPE آپ کا انتخاب درج کرتا ہے اور کبھی آپ کی جگہ انتخاب نہیں کرتا۔",
            )}
          </p>
          <p>
            <b>{t("Next:", "اگلا قدم:")}</b>{" "}
            {t(
              "MONITOR compares actual results against the projection of the response you chose.",
              "نگرانی (MONITOR) آپ کے منتخب ردِعمل کے تخمینے سے حقیقی نتائج کا موازنہ کرتی ہے۔",
            )}
          </p>
        </>
      }
    >
      {!comparison ? (
        <LockedNotice
          requirement={t(
            "Compare at least one simulated scenario in COMPARE first. A decision references that comparison.",
            "پہلے موازنہ (COMPARE) میں کم از کم ایک آزمائے گئے منظرنامے کا موازنہ کریں۔ فیصلہ اسی موازنے سے منسلک ہوتا ہے۔",
          )}
          href="#stage-compare"
        />
      ) : (
        <>
          {!decision ? (
            <>
              <StepTitle index={1}>{t("Choose a response", "ردِعمل منتخب کریں")}</StepTitle>
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
                    <bdi dir="auto">{run.definition.name}</bdi>
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
                  {t("My own response (not one of the scenarios)", "میرا اپنا ردِعمل (منظرناموں میں سے نہیں)")}
                </label>
              </div>
              {choice === OWNER_DEFINED ? (
                <>
                  <label className="wfField wfFieldWide">
                    <span>{t("Describe your response", "اپنا ردِعمل بیان کریں")}</span>
                    <textarea dir="auto" rows={3} value={ownerText} onChange={(event) => setOwnerText(event.target.value)} />
                  </label>
                  <InfoNotice tone="warn">
                    <p>
                      {t(
                        "An owner-defined response has no calculated projection, so MONITOR cannot compare actual results against it.",
                        "مالک کے اپنے بیان کردہ ردِعمل کا کوئی حسابی تخمینہ نہیں ہوتا، اس لیے نگرانی (MONITOR) حقیقی نتائج کا اس سے موازنہ نہیں کر سکتی۔",
                      )}
                    </p>
                  </InfoNotice>
                </>
              ) : null}
              <div className="wfActions">
                <ActionButton onClick={handleRecord} busy={busy === "record"} disabled={!canRecord}>
                  {t("Record my selection", "میرا انتخاب درج کریں")}
                </ActionButton>
                {!canRecord ? (
                  <span className="wfHint">{t("Choose a response first.", "پہلے ردِعمل منتخب کریں۔")}</span>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <StepTitle index={1}>{t("Your recorded response", "آپ کا درج کردہ ردِعمل")}</StepTitle>
              <KeyValues
                rows={[
                  [t("Response", "ردِعمل"), <bdi key="r" dir="auto">{chosenName ?? decision.owner_defined_response ?? "—"}</bdi>],
                  [
                    t("Decision status", "فیصلے کی حیثیت"),
                    <Badge key="s" tone={decision.decision_status === "confirmed" ? "ok" : "warn"}>
                      {rawTerm(decision.decision_status, language)}
                    </Badge>,
                  ],
                  [
                    t("Confirmed by", "تصدیق کنندہ"),
                    decision.owner_confirmation_reference ? (
                      <bdi key="c" dir="auto">{decision.owner_confirmation_reference}</bdi>
                    ) : (
                      t("Not yet confirmed", "ابھی تصدیق نہیں ہوئی")
                    ),
                  ],
                  [t("Decided at", "فیصلے کا وقت"), <Ltr key="d">{formatDate(decision.decided_at, language)}</Ltr>],
                  [t("Decision ID", "فیصلے کی شناخت (ID)"), <code key="i">{decision.id}</code>],
                ]}
              />
              {decision.decision_status === "selected" ? (
                <>
                  <StepTitle index={2}>{t("Confirm the decision", "فیصلے کی تصدیق کریں")}</StepTitle>
                  <label className="wfField">
                    <span>{t("Confirmed by (owner name or reference)", "تصدیق کنندہ (مالک کا نام یا حوالہ)")}</span>
                    <input dir="auto" value={confirmedBy} onChange={(event) => setConfirmedBy(event.target.value)} />
                    <small>
                      {t(
                        "Recorded with the decision as the owner’s confirmation reference.",
                        "یہ فیصلے کے ساتھ مالک کی تصدیق کے حوالے کے طور پر درج ہوگا۔",
                      )}
                    </small>
                  </label>
                  <div className="wfActions">
                    <ActionButton onClick={handleConfirm} busy={busy === "confirm"} disabled={!confirmedBy.trim()}>
                      {t("Confirm this decision", "اس فیصلے کی تصدیق کریں")}
                    </ActionButton>
                  </div>
                </>
              ) : (
                <NextStep href="#stage-monitor">{t("Continue to MONITOR", "نگرانی (MONITOR) کی طرف بڑھیں")}</NextStep>
              )}
            </>
          )}
          {error ? <ErrorNotice error={error} title={t("RESPOND did not complete", "عمل (RESPOND) مکمل نہیں ہوا")} /> : null}
        </>
      )}
    </StageFrame>
  );
}
