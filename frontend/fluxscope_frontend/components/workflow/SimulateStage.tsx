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
import { useLanguage, useT } from "../../lib/i18n";
import {
  SCENARIO_FIELDS,
  isDecimal,
  percentPointsToFraction,
  rawTerm,
  unitLabel,
  type StageStatus,
} from "../../lib/workflow";
import { MetricsTable } from "./QuantifyStage";
import {
  ActionButton,
  Badge,
  ErrorNotice,
  InfoNotice,
  LockedNotice,
  Ltr,
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
  const t = useT();
  const language = useLanguage();
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [fxDelta, setFxDelta] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [runErrors, setRunErrors] = useState<Record<string, ApiError>>({});

  const fxFraction = fxDelta.trim() ? percentPointsToFraction(fxDelta) : null;
  const invalid = [
    ...SCENARIO_FIELDS.filter((field) => values[field.key]?.trim() && !isDecimal(values[field.key])).map(
      (field) => t(field.label, field.labelUr),
    ),
    ...(fxDelta.trim() && fxFraction === null
      ? [t("Additional exchange-rate change", "شرحِ مبادلہ میں اضافی تبدیلی")]
      : []),
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
      tag={t("≋ SIMULATE", "≋ محاکات · SIMULATE")}
      title={t("What if you respond differently?", "اگر آپ مختلف ردِعمل دیں تو کیا ہوگا؟")}
      status={status}
      explanation={
        <>
          <p>
            {t(
              "Define a response as explicit assumptions. Each one replaces a value in your confirmed baseline, or adds to the verified exchange-rate change. You confirm the assumptions, then the deterministic engine recalculates them. Results are projections compared against the after-shock position from QUANTIFY.",
              "ردِعمل کو واضح مفروضوں کی صورت میں بیان کریں۔ ہر مفروضہ آپ کی تصدیق شدہ بنیادی قدر کی جگہ لیتا ہے، یا تصدیق شدہ شرحِ مبادلہ کی تبدیلی میں اضافہ کرتا ہے۔ آپ مفروضوں کی تصدیق کرتے ہیں، پھر متعین انجن دوبارہ حساب کرتا ہے۔ نتائج تخمینے ہیں جن کا موازنہ حساب (QUANTIFY) کی جھٹکے کے بعد والی صورتحال سے کیا جاتا ہے۔",
            )}
          </p>
          <p>
            <b>{t("Next:", "اگلا قدم:")}</b>{" "}
            {t(
              "run at least one scenario, then COMPARE them side by side.",
              "کم از کم ایک منظرنامہ چلائیں، پھر موازنہ (COMPARE) میں انہیں ساتھ ساتھ دیکھیں۔",
            )}
          </p>
        </>
      }
    >
      {!impact || !profile ? (
        <LockedNotice
          requirement={t(
            "Complete QUANTIFY first. Scenarios are recalculated from that deterministic result.",
            "پہلے حساب (QUANTIFY) مکمل کریں۔ منظرنامے اسی متعین نتیجے سے دوبارہ شمار ہوتے ہیں۔",
          )}
          href="#stage-quantify"
        />
      ) : (
        <>
          <StepTitle index={1}>{t("Describe a response", "ردِعمل بیان کریں")}</StepTitle>
          <div className="wfGrid">
            <label className="wfField wfFieldWide">
              <span>{t("Scenario name", "منظرنامے کا نام")}</span>
              <input dir="auto" value={name} onChange={(event) => setName(event.target.value)} />
              <small>
                {t(
                  "Describe the response in your own words, e.g. “Raise price” or “Buy fewer imports”.",
                  "ردِعمل اپنے الفاظ میں لکھیں، مثلاً “قیمت بڑھائیں” یا “درآمدات کم کریں”۔",
                )}
              </small>
            </label>
            {SCENARIO_FIELDS.map((field) => {
              const current = field.replaces ? profile.confirmed_fields[field.replaces]?.value : undefined;
              const value = values[field.key] ?? "";
              const bad = value.trim() !== "" && !isDecimal(value);
              return (
                <label key={field.key} className={`wfField ${bad ? "wfFieldBad" : ""}`}>
                  <span>
                    {t(field.label, field.labelUr)} <em>({unitLabel(field.unit, language)})</em>
                  </span>
                  <input
                    inputMode="decimal"
                    dir="ltr"
                    value={value}
                    onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  />
                  <small>
                    {bad ? (
                      t("Enter a non-negative number.", "منفی کے علاوہ کوئی عدد درج کریں۔")
                    ) : (
                      <>
                        {t(field.help, field.helpUr)}
                        {t(" Confirmed value: ", " تصدیق شدہ قدر: ")}
                        {current ? <Ltr>{current}</Ltr> : t("not provided", "درج نہیں")}
                        {t(".", "۔")}
                      </>
                    )}
                  </small>
                </label>
              );
            })}
            <label className={`wfField ${fxDelta.trim() && fxFraction === null ? "wfFieldBad" : ""}`}>
              <span>
                {t("Additional exchange-rate change", "شرحِ مبادلہ میں اضافی تبدیلی")}{" "}
                <em>{t("(percentage points)", "(فیصدی پوائنٹس)")}</em>
              </span>
              <input inputMode="decimal" dir="ltr" value={fxDelta} onChange={(event) => setFxDelta(event.target.value)} />
              <small>
                {language === "ur" ? (
                  <>
                    تصدیق شدہ جھٹکے میں شامل ہوگی۔ مزید <Ltr>+5%</Ltr> کے لیے <Ltr>5</Ltr> درج کریں۔ انجن کو اعشاری
                    کسر کی صورت میں بھیجی جاتی ہے
                  </>
                ) : (
                  "Added to the verified shock. Enter 5 for a further +5%. Sent to the engine as a decimal fraction"
                )}
                {fxFraction !== null ? (
                  <>
                    {t(": ", ": ")}
                    <Ltr>{fxFraction}</Ltr>
                  </>
                ) : (
                  <>
                    {" ("}
                    <Ltr>5 → 0.05</Ltr>
                    {")"}
                  </>
                )}
                {t(".", "۔")}
              </small>
            </label>
          </div>

          {assumptions.length > 0 ? (
            <InfoNotice title={t("Assumptions that will be sent", "یہ مفروضے بھیجے جائیں گے")}>
              <ul className="wfPlainList">
                {assumptions.map((item) => (
                  <li key={item.field_reference}>
                    <Ltr>
                      <code>{item.field_reference}</code> = {item.value} ({item.unit})
                    </Ltr>
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
              {t("Create scenario draft", "منظرنامے کا مسودہ بنائیں")}
            </ActionButton>
            {!name.trim() || assumptions.length === 0 ? (
              <span className="wfHint">
                {t(
                  "Enter a name and at least one changed assumption.",
                  "نام اور کم از کم ایک تبدیل شدہ مفروضہ درج کریں۔",
                )}
              </span>
            ) : invalid.length ? (
              <span className="wfHint">
                {t("Fix: ", "درست کریں: ")}
                {invalid.join(t(", ", "، "))}
                {t(".", "۔")}
              </span>
            ) : null}
          </div>
          {formError ? (
            <ErrorNotice error={formError} title={t("The scenario was not created", "منظرنامہ نہیں بن سکا")} />
          ) : null}

          {runs.length > 0 ? (
            <StepTitle index={2}>{t("Confirm and run your scenarios", "اپنے منظرناموں کی تصدیق کریں اور چلائیں")}</StepTitle>
          ) : null}
          {runs.map(({ definition, result }) => {
            const confirmed = definition.assumption_confirmation_status === "confirmed";
            const runError = runErrors[definition.id];
            return (
              <article key={definition.id} className="wfCard">
                <header>
                  <strong dir="auto">{definition.name}</strong>
                  <Badge tone={result ? "ok" : confirmed ? "neutral" : "warn"}>
                    {result ? rawTerm("simulated", language) : rawTerm(definition.assumption_confirmation_status, language)}
                  </Badge>
                </header>
                <ul className="wfPlainList">
                  {definition.changed_assumptions.map((item) => (
                    <li key={item.field_reference}>
                      <Ltr>
                        <code>{item.field_reference}</code> = {item.value} {item.unit ? `(${item.unit})` : ""}
                      </Ltr>
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
                        {t("I confirm these assumptions", "میں ان مفروضوں کی تصدیق کرتا/کرتی ہوں")}
                      </ActionButton>
                    ) : (
                      <ActionButton onClick={() => handleRun(definition.id)} busy={busy === `run-${definition.id}`}>
                        {t("Run scenario", "منظرنامہ چلائیں")}
                      </ActionButton>
                    )}
                    <span className="wfHint">
                      {confirmed
                        ? t(
                            "Confirmed by you. The engine will now recalculate.",
                            "آپ نے تصدیق کر دی۔ اب انجن دوبارہ حساب کرے گا۔",
                          )
                        : t(
                            "The backend refuses to run a scenario until you confirm its assumptions.",
                            "جب تک آپ مفروضوں کی تصدیق نہ کریں، بیک اینڈ منظرنامہ نہیں چلاتا۔",
                          )}
                    </span>
                  </div>
                ) : null}
                {runError ? (
                  <ErrorNotice error={runError} title={t("The scenario did not run", "منظرنامہ نہیں چل سکا")} />
                ) : null}
                {result ? (
                  <>
                    <MetricsTable
                      metrics={result.result.projected}
                      beforeLabel={t("After shock (QUANTIFY)", "جھٹکے کے بعد (QUANTIFY)")}
                      afterLabel={t("With this response", "اس ردِعمل کے ساتھ")}
                    />
                    <p className="wfHint">
                      {t(
                        "Projected by the deterministic engine. Scenario result ID ",
                        "متعین انجن کا تخمینہ۔ منظرنامے کے نتیجے کی شناخت (ID) ",
                      )}
                      <code>{result.id}</code>
                      {t(".", "۔")}
                    </p>
                  </>
                ) : null}
              </article>
            );
          })}

          {completed.length > 0 ? (
            <NextStep href="#stage-compare">
              {t("Continue to COMPARE", "موازنہ (COMPARE) کی طرف بڑھیں")} (
              {t(`${completed.length} simulated`, `${completed.length} منظرنامے مکمل`)})
            </NextStep>
          ) : null}
        </>
      )}
    </StageFrame>
  );
}
