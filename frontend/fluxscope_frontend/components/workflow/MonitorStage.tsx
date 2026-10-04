"use client";

import { useState } from "react";
import {
  recordMonitoringInput,
  toApiError,
  type ApiError,
  type HumanDecision,
  type MonitoringResult,
} from "../../lib/api";
import { useLanguage, useT } from "../../lib/i18n";
import {
  MONITOR_METRICS,
  formatSigned,
  formatValue,
  term,
  unitLabel,
  type StageStatus,
} from "../../lib/workflow";
import {
  ActionButton,
  Badge,
  ErrorNotice,
  InfoNotice,
  LockedNotice,
  Ltr,
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
  const t = useT();
  const language = useLanguage();
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

  function metricLabel(key: string) {
    const definition = MONITOR_METRICS.find((item) => item.key === key);
    return language === "ur" && definition ? definition.labelUr : term(key);
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
      tag={t("↗ MONITOR", "↗ نگرانی · MONITOR")}
      title={t("Is reality tracking the projection?", "کیا حقیقی نتائج اندازے کے مطابق ہیں؟")}
      status={status}
      explanation={
        <>
          <p>
            {t(
              "After your decision, enter actual results as they happen. The backend compares each actual value with the stored projection of the scenario you chose and assigns a monitoring status.",
              "فیصلے کے بعد حقیقی نتائج سامنے آتے ہی درج کریں۔ بیک اینڈ ہر حقیقی قدر کا موازنہ آپ کے منتخب منظرنامے کے محفوظ تخمینے سے کرتا ہے اور نگرانی کی حیثیت متعین کرتا ہے۔",
            )}
          </p>
          <p>
            <b>{t("Next:", "اگلا قدم:")}</b>{" "}
            {t(
              "if the status shows a large variance, revisit SIMULATE with updated assumptions.",
              "اگر حیثیت بڑا فرق دکھائے تو نئے مفروضوں کے ساتھ دوبارہ محاکات (SIMULATE) کریں۔",
            )}
          </p>
        </>
      }
    >
      {!confirmed ? (
        <LockedNotice
          requirement={t(
            "Confirm a decision in RESPOND first. Monitoring is only tied to a confirmed owner decision.",
            "پہلے عمل (RESPOND) میں فیصلے کی تصدیق کریں۔ نگرانی صرف مالک کے تصدیق شدہ فیصلے سے منسلک ہوتی ہے۔",
          )}
          href="#stage-respond"
        />
      ) : (
        <>
          {decision?.selected_scenario_id === null ? (
            <InfoNotice tone="warn" title={t("This response has no stored projection", "اس ردِعمل کا کوئی محفوظ تخمینہ نہیں")}>
              <p>
                {t(
                  "You confirmed an owner-defined response. The backend can only compare actual results against a selected scenario’s projection, so it will report a clarification blocker.",
                  "آپ نے اپنا بیان کردہ ردِعمل منتخب کیا ہے۔ بیک اینڈ حقیقی نتائج کا موازنہ صرف منتخب منظرنامے کے تخمینے سے کر سکتا ہے، اس لیے یہ وضاحت کی رکاوٹ دکھائے گا۔",
                )}
              </p>
            </InfoNotice>
          ) : null}
          <StepTitle index={1}>{t("Enter an actual result", "حقیقی نتیجہ درج کریں")}</StepTitle>
          <div className="wfGrid">
            <label className="wfField">
              <span>{t("Metric", "پیمانہ")}</span>
              <select value={metric} onChange={(event) => chooseMetric(event.target.value)}>
                <option value="">{t("Select a metric…", "پیمانہ منتخب کریں…")}</option>
                {MONITOR_METRICS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {t(item.label, item.labelUr)}
                  </option>
                ))}
              </select>
              <small>
                {t(
                  "Only metrics with a stored scenario projection can be compared.",
                  "صرف انہی پیمانوں کا موازنہ ہو سکتا ہے جن کا منظرنامے میں تخمینہ محفوظ ہو۔",
                )}
              </small>
            </label>
            <label className={`wfField ${actualInvalid ? "wfFieldBad" : ""}`}>
              <span>{t("Actual value", "حقیقی قدر")}</span>
              <input inputMode="decimal" dir="ltr" value={actual} onChange={(event) => setActual(event.target.value)} />
              <small>
                {actualInvalid ? (
                  language === "ur" ? (
                    <>
                      کوئی عدد درج کریں، مثلاً <Ltr>182500</Ltr> یا <Ltr>-1200</Ltr>۔
                    </>
                  ) : (
                    "Enter a number, e.g. 182500 or -1200."
                  )
                ) : (
                  t("The figure you actually observed.", "وہ عدد جو آپ نے حقیقت میں دیکھا۔")
                )}
              </small>
            </label>
            <label className="wfField">
              <span>{t("Unit", "اکائی")}</span>
              <input dir="ltr" value={unit} onChange={(event) => setUnit(event.target.value)} />
              <small>
                {t(
                  "Use the same unit as the projection (PKR, or percent for gross margin).",
                  "وہی اکائی استعمال کریں جو تخمینے کی ہے (PKR، یا مجموعی مارجن کے لیے percent)۔",
                )}
              </small>
            </label>
            <label className="wfField">
              <span>{t("Observed on", "مشاہدے کی تاریخ")}</span>
              <input type="date" dir="ltr" value={observedOn} onChange={(event) => setObservedOn(event.target.value)} />
            </label>
            <label className="wfField wfFieldWide">
              <span>{t("Where this figure comes from", "یہ عدد کہاں سے لیا گیا")}</span>
              <input dir="auto" value={reference} onChange={(event) => setReference(event.target.value)} />
              <small>
                {t(
                  "For example, a ledger, an invoice batch or a monthly report. This is stored as the actual value’s reference.",
                  "مثلاً کھاتہ، انوائسوں کا مجموعہ یا ماہانہ رپورٹ۔ یہ حقیقی قدر کے حوالے کے طور پر محفوظ ہوتا ہے۔",
                )}
              </small>
            </label>
          </div>
          <div className="wfActions">
            <ActionButton onClick={handleEvaluate} busy={busy} disabled={!ready}>
              {t("Compare actual with projection", "حقیقی قدر کا تخمینے سے موازنہ کریں")}
            </ActionButton>
            {!ready ? (
              <span className="wfHint">{t("Fill in every field to compare.", "موازنے کے لیے ہر خانہ پُر کریں۔")}</span>
            ) : null}
          </div>
          {error ? <ErrorNotice error={error} title={t("MONITOR did not complete", "نگرانی (MONITOR) مکمل نہیں ہوئی")} /> : null}

          {entries.length > 0 ? (
            <>
              <StepTitle index={2}>{t("Actual vs projected", "حقیقی بمقابلہ تخمینہ")}</StepTitle>
              <div className="wfTableScroll">
                <table className="wfTable wfNumbers">
                  <thead>
                    <tr>
                      <th>{t("Metric", "پیمانہ")}</th>
                      <th>{t("Projected", "تخمینہ")}</th>
                      <th>{t("Actual", "حقیقی")}</th>
                      <th>{t("Variance", "فرق")}</th>
                      <th>{t("Variance %", "فرق %")}</th>
                      <th>{t("Status", "حیثیت")}</th>
                      <th>{t("Observed / source", "تاریخ / ذریعہ")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => (
                      <tr key={index}>
                        <td>
                          {metricLabel(entry.result.metric_name)} <em>({unitLabel(entry.unit, language)})</em>
                        </td>
                        <td>{formatValue(entry.result.projected_value, 2, language)}</td>
                        <td>{formatValue(entry.result.actual_value, 2, language)}</td>
                        <td>{formatSigned(entry.result.variance, 2, language)}</td>
                        <td>{formatSigned(entry.result.variance_pct, 2, language)}%</td>
                        <td className="wfText">
                          <Badge tone={statusTone(entry.result.status)}>{term(entry.result.status, language)}</Badge>
                        </td>
                        <td className="wfText">
                          <Ltr>{entry.observedOn}</Ltr> · <bdi dir="auto">{entry.reference}</bdi>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <InfoNotice title={t("Current monitoring limitations (from the backend)", "نگرانی کی موجودہ حدود (بیک اینڈ کی طرف سے)")}>
            <ul className="wfPlainList">
              <li>
                {language === "ur" ? (
                  <>
                    حیثیت کی حدیں بیک اینڈ کا عارضی MVP اصول ہیں، طے شدہ پروڈکٹ اصول نہیں: تخمینے کے <Ltr>5%</Ltr> کے
                    اندر “اندازے کے مطابق”، <Ltr>10%</Ltr> تک “فرق پایا گیا”، اور اس سے زیادہ پر “دوبارہ جائزہ درکار”۔
                  </>
                ) : (
                  "Status thresholds are a temporary MVP rule in the backend, not an agreed product rule: on track within 5% of the projected value, variance detected up to 10%, reassessment required beyond that."
                )}
              </li>
              <li>
                {t(
                  "The backend does not store monitoring results. This list lasts only for the current browser session.",
                  "بیک اینڈ نگرانی کے نتائج محفوظ نہیں کرتا۔ یہ فہرست صرف موجودہ براؤزر سیشن تک رہتی ہے۔",
                )}
              </li>
              <li>
                {t("Multi-record projection comparison (", "متعدد اندراجات کا تخمینے سے موازنہ (")}
                <code>POST /projection-comparisons</code>
                {t(
                  ") is not connected in the backend and returns 424 UPSTREAM_UNAVAILABLE, so it is not offered here.",
                  ") بیک اینڈ میں منسلک نہیں اور 424 UPSTREAM_UNAVAILABLE واپس کرتا ہے، اس لیے یہاں پیش نہیں کیا گیا۔",
                )}
              </li>
            </ul>
          </InfoNotice>
        </>
      )}
    </StageFrame>
  );
}
