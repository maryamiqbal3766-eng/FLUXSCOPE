"use client";

import { useState } from "react";
import {
  calculateImpact,
  toApiError,
  type ApiError,
  type BusinessProfile,
  type EconomicShockEvent,
  type ImpactGraph,
  type ImpactMetrics,
  type ImpactResultRecord,
} from "../../lib/api";
import { useLanguage, useT } from "../../lib/i18n";
import {
  fieldLabel,
  formatSigned,
  formatValue,
  rawTerm,
  term,
  unitLabel,
  type StageStatus,
} from "../../lib/workflow";
import {
  ActionButton,
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
  shock: EconomicShockEvent | null;
  profile: BusinessProfile | null;
  mapping: ImpactGraph | null;
  impact: ImpactResultRecord | null;
  onCalculated: (impact: ImpactResultRecord) => void;
  onMissingFields: (fields: string[]) => void;
  onBlocked: (code: string | null) => void;
};

/** Fields of the economic shock (from DETECT) that QUANTIFY may report as unusable. */
const SHOCK_FIELDS = ["magnitude", "unit", "direction_or_change", "shock_type", "verification_status"];

type MetricRow = {
  label: string;
  labelUr: string;
  before: keyof ImpactMetrics;
  after: keyof ImpactMetrics;
  change?: keyof ImpactMetrics;
  changeLabel?: string;
  unit: string;
};

/** Rows of `ImpactResult` as returned by the deterministic calculator. */
export const IMPACT_ROWS: MetricRow[] = [
  { label: "Revenue", labelUr: "آمدنی", before: "baseline_revenue", after: "shocked_revenue", change: "revenue_change_pct", changeLabel: "%", unit: "PKR" },
  { label: "Imported input cost", labelUr: "درآمدی خام مال کی لاگت", before: "baseline_imported_cost", after: "shocked_imported_cost", change: "imported_cost_impact", unit: "PKR" },
  { label: "Cost of goods sold (COGS)", labelUr: "فروخت شدہ مال کی لاگت (COGS)", before: "baseline_cogs", after: "shocked_cogs", change: "cogs_impact", unit: "PKR" },
  { label: "Gross profit", labelUr: "مجموعی منافع", before: "baseline_gross_profit", after: "shocked_gross_profit", unit: "PKR" },
  { label: "Gross margin", labelUr: "مجموعی منافع کا مارجن", before: "baseline_gross_margin_pct", after: "shocked_gross_margin_pct", change: "gross_margin_change_pct_points", changeLabel: "pp", unit: "%" },
  { label: "Operating profit", labelUr: "آپریٹنگ منافع", before: "baseline_operating_profit", after: "shocked_operating_profit", change: "profit_impact", unit: "PKR" },
  { label: "Cash requirement", labelUr: "نقدی کی ضرورت", before: "baseline_cash_requirement", after: "shocked_cash_requirement", change: "cash_requirement_change", unit: "PKR" },
];

export function MetricsTable({
  metrics,
  beforeLabel,
  afterLabel,
}: {
  metrics: ImpactMetrics;
  beforeLabel: string;
  afterLabel: string;
}) {
  const t = useT();
  const language = useLanguage();
  return (
    <table className="wfTable wfNumbers">
      <thead>
        <tr>
          <th>{t("Metric", "پیمانہ")}</th>
          <th>{beforeLabel}</th>
          <th>{afterLabel}</th>
          <th>{t("Change", "تبدیلی")}</th>
        </tr>
      </thead>
      <tbody>
        {IMPACT_ROWS.map((row) => (
          <tr key={row.label}>
            <td>
              {t(row.label, row.labelUr)} <em>({unitLabel(row.unit, language)})</em>
            </td>
            <td>{formatValue(metrics[row.before], 2, language)}</td>
            <td>{formatValue(metrics[row.after], 2, language)}</td>
            <td className={row.change ? undefined : "wfText"}>
              {row.change
                ? `${formatSigned(metrics[row.change], 2, language)}${row.changeLabel ? ` ${row.changeLabel}` : ""}`
                : t("n/a (not calculated by the engine)", "لاگو نہیں (انجن یہ حساب نہیں کرتا)")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function QuantifyStage({
  status,
  shock,
  profile,
  mapping,
  impact,
  onCalculated,
  onMissingFields,
  onBlocked,
}: Props) {
  const t = useT();
  const language = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const prerequisite = !shock
    ? {
        text: t("Select a detected shock in DETECT first.", "پہلے کھوج (DETECT) میں پایا گیا جھٹکا منتخب کریں۔"),
        href: "#stage-detect",
      }
    : !profile || !mapping
      ? {
          text: t(
            "Confirm your business facts and create the impact mapping in TRACE first.",
            "پہلے تجزیہ (TRACE) میں اپنے کاروباری حقائق کی تصدیق کریں اور اثرات کا نقشہ بنائیں۔",
          ),
          href: "#stage-trace",
        }
      : null;

  async function handleCalculate() {
    if (!shock || !profile || !mapping) return;
    setBusy(true);
    setError(null);
    try {
      const result = await calculateImpact({
        shock_event_id: shock.id,
        impact_mapping_id: mapping.id,
        business_input_ids: [profile.id],
      });
      onMissingFields([]);
      onBlocked(null);
      onCalculated(result);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError);
      onBlocked(apiError.code);
      if (apiError.code === "CLARIFICATION_REQUIRED" && apiError.stage === "QUANTIFY") {
        // Only business facts can be fixed in TRACE; shock fields come from DETECT.
        onMissingFields(apiError.requiredFields.filter((field) => !SHOCK_FIELDS.includes(field)));
      }
    } finally {
      setBusy(false);
    }
  }

  const missingFacts =
    error?.code === "CLARIFICATION_REQUIRED" &&
    error.requiredFields.some(
      (field) => !SHOCK_FIELDS.includes(field) && profile && !(field in profile.confirmed_fields),
    );
  const shockGap =
    error?.code === "CLARIFICATION_REQUIRED" &&
    error.requiredFields.some((field) => SHOCK_FIELDS.includes(field));

  return (
    <StageFrame
      id="stage-quantify"
      number={3}
      tag={t("▥ QUANTIFY", "▥ حساب · QUANTIFY")}
      title={t("What is the measurable impact?", "قابلِ پیمائش اثر کتنا ہے؟")}
      status={status}
      explanation={
        <>
          <p>
            {t(
              "The backend’s deterministic engine calculates the effect of the verified shock on your confirmed facts. No AI model produces these numbers, and this page only displays what the engine returns. The current engine models an exchange-rate shock on imported inputs. Other shock types are reported as unsupported rather than forced into that model.",
              "بیک اینڈ کا متعین حسابی انجن تصدیق شدہ جھٹکے کا اثر آپ کے تصدیق شدہ حقائق پر شمار کرتا ہے۔ یہ اعداد کوئی AI ماڈل نہیں بناتا، اور یہ صفحہ صرف وہی دکھاتا ہے جو انجن واپس کرتا ہے۔ موجودہ انجن درآمدی خام مال پر شرحِ مبادلہ کے جھٹکے کا حساب کرتا ہے۔ دیگر اقسام کے جھٹکوں کو زبردستی اس ماڈل میں ڈالنے کے بجائے غیر معاون بتایا جاتا ہے۔",
            )}
          </p>
          <p>
            <b>{t("Next:", "اگلا قدم:")}</b>{" "}
            {t(
              "SIMULATE lets you test responses against this result.",
              "محاکات (SIMULATE) میں آپ اس نتیجے کے مقابلے میں مختلف ردِعمل آزما سکتے ہیں۔",
            )}
          </p>
        </>
      }
    >
      {prerequisite ? (
        <LockedNotice requirement={prerequisite.text} href={prerequisite.href} />
      ) : (
        <>
          <StepTitle index={1}>{t("Inputs the engine will use", "انجن یہ معلومات استعمال کرے گا")}</StepTitle>
          <KeyValues
            rows={[
              [
                t("Shock", "جھٹکا"),
                <span key="s">
                  {term(shock!.shock_type, language)} — <bdi dir="auto">{shock!.economic_variable}</bdi>
                </span>,
              ],
              [
                t("Shock change (from the verified source)", "جھٹکے کی تبدیلی (تصدیق شدہ ذریعے سے)"),
                shock!.magnitude ? (
                  <span key="c">
                    {rawTerm(shock!.direction_or_change, language)} <Ltr>{shock!.magnitude}</Ltr>{" "}
                    {shock!.unit ? unitLabel(shock!.unit, language) : ""}
                  </span>
                ) : (
                  t("No magnitude stated", "کوئی مقدار درج نہیں")
                ),
              ],
              [t("Shock verification", "جھٹکے کی تصدیق"), rawTerm(shock!.verification_status, language)],
              [t("Impact mapping", "اثرات کا نقشہ"), <code key="m">{mapping!.id}</code>],
              [
                t("Confirmed business facts", "تصدیق شدہ کاروباری حقائق"),
                <span key="f">
                  {Object.entries(profile!.confirmed_fields).map(([key, fact], index) => (
                    <span key={key}>
                      {index > 0 ? " · " : ""}
                      {fieldLabel(key, language)}: <Ltr>{fact.value}</Ltr>
                    </span>
                  ))}
                </span>,
              ],
            ]}
          />
          {!impact ? (
            <div className="wfActions">
              <ActionButton onClick={handleCalculate} busy={busy}>
                {t("Run deterministic calculation", "متعین حساب چلائیں")}
              </ActionButton>
            </div>
          ) : null}

          {error ? (
            <>
              <ErrorNotice
                error={error}
                title={
                  error.code === "UNSUPPORTED_SHOCK_TYPE"
                    ? t("This shock type cannot be quantified yet", "اس قسم کے جھٹکے کا حساب ابھی ممکن نہیں")
                    : error.code === "VERIFICATION_REQUIRED"
                      ? t("QUANTIFY needs a verified shock", "حساب (QUANTIFY) کے لیے تصدیق شدہ جھٹکا ضروری ہے")
                      : t("QUANTIFY is blocked", "حساب (QUANTIFY) رکا ہوا ہے")
                }
              />
              {shockGap ? (
                <InfoNotice tone="warn" title={t("What to do", "اب کیا کریں")}>
                  <p>
                    {t(
                      "The selected shock does not state what the engine needs: a percentage change with a clear increase or decrease. This cannot be fixed with business facts. Go back to DETECT and use a source passage that states the exchange-rate change that way.",
                      "منتخب جھٹکے میں وہ درج نہیں جو انجن کو درکار ہے: واضح اضافے یا کمی کے ساتھ فیصد تبدیلی۔ یہ کاروباری حقائق سے درست نہیں ہو سکتا۔ کھوج (DETECT) پر واپس جائیں اور ایسا اقتباس استعمال کریں جس میں شرحِ مبادلہ کی تبدیلی اسی طرح بیان ہو۔",
                    )}
                  </p>
                  <a className="wfLink" href="#stage-detect">
                    {t("Go to DETECT ↑", "کھوج (DETECT) پر جائیں ↑")}
                  </a>
                </InfoNotice>
              ) : null}
              {missingFacts ? (
                <InfoNotice tone="warn" title={t("What to do", "اب کیا کریں")}>
                  <p>
                    {t(
                      "Add the listed facts in TRACE, confirm them, and create the mapping again. Then return here.",
                      "درج شدہ حقائق تجزیہ (TRACE) میں شامل کریں، ان کی تصدیق کریں اور نقشہ دوبارہ بنائیں۔ پھر یہاں واپس آئیں۔",
                    )}
                  </p>
                  <a className="wfLink" href="#stage-trace">
                    {t("Go to TRACE ↑", "تجزیہ (TRACE) پر جائیں ↑")}
                  </a>
                </InfoNotice>
              ) : null}
            </>
          ) : null}

          {impact ? (
            <>
              <StepTitle index={2}>
                {t("Calculated impact (projection, not an observed fact)", "حساب شدہ اثر (تخمینہ، مشاہدہ شدہ حقیقت نہیں)")}
              </StepTitle>
              <MetricsTable
                metrics={impact.result}
                beforeLabel={t("Before shock", "جھٹکے سے پہلے")}
                afterLabel={t("After shock", "جھٹکے کے بعد")}
              />
              <p className="wfHint">
                {t("Exchange-rate change applied by the engine: ", "انجن کی لاگو کردہ شرحِ مبادلہ کی تبدیلی: ")}
                <Ltr>{formatValue(impact.inputs.exchange_rate_change, 6, language)}</Ltr>{" "}
                {t(
                  "(decimal fraction, from the verified shock). Impact result ID ",
                  "(اعشاری کسر، تصدیق شدہ جھٹکے سے)۔ اثر کے نتیجے کی شناخت (ID) ",
                )}
                <code>{impact.id}</code>
                {t(".", "۔")}
              </p>
              <NextStep href="#stage-simulate">{t("Continue to SIMULATE", "محاکات (SIMULATE) کی طرف بڑھیں")}</NextStep>
            </>
          ) : null}
        </>
      )}
    </StageFrame>
  );
}
