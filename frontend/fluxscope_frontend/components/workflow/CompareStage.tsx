"use client";

import { useState } from "react";
import {
  createComparison,
  toApiError,
  type ApiError,
  type ComparisonSet,
  type ImpactResultRecord,
} from "../../lib/api";
import { useLanguage, useT } from "../../lib/i18n";
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
  const t = useT();
  const language = useLanguage();
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
      tag={t("⚖ COMPARE", "⚖ موازنہ · COMPARE")}
      title={t("What are the trade-offs?", "مختلف راستوں میں کیا فرق ہے؟")}
      status={status}
      explanation={
        <>
          <p>
            {t(
              "The backend puts your simulated responses side by side using its deterministic outputs and rule-based trade-off tags. It does not rank them or pick a winner.",
              "بیک اینڈ آپ کے آزمائے گئے ردِعمل کو اپنے متعین نتائج اور اصولوں پر مبنی فوائد و نقصانات کے ساتھ ساتھ ساتھ دکھاتا ہے۔ یہ نہ درجہ بندی کرتا ہے اور نہ کسی کو بہترین قرار دیتا ہے۔",
            )}
          </p>
          <p>
            <b>{t("Next:", "اگلا قدم:")}</b>{" "}
            {t(
              "RESPOND, where you, the owner, record a decision.",
              "عمل (RESPOND)، جہاں آپ بطور مالک اپنا فیصلہ درج کرتے ہیں۔",
            )}
          </p>
        </>
      }
    >
      {completed.length === 0 ? (
        <LockedNotice
          requirement={t(
            "Run at least one confirmed scenario in SIMULATE. Only completed scenario results can be compared.",
            "محاکات (SIMULATE) میں کم از کم ایک تصدیق شدہ منظرنامہ چلائیں۔ صرف مکمل منظرناموں کا موازنہ ہو سکتا ہے۔",
          )}
          href="#stage-simulate"
        />
      ) : (
        <>
          <StepTitle index={1}>{t("Choose the scenarios to compare", "موازنے کے لیے منظرنامے منتخب کریں")}</StepTitle>
          <div className="wfChecks">
            {completed.map((run) => (
              <label key={run.result.id} className="wfCheck">
                <input
                  type="checkbox"
                  checked={!excluded.has(run.result.id)}
                  onChange={() => toggle(run.result.id)}
                />
                <bdi dir="auto">{run.definition.name}</bdi>
              </label>
            ))}
          </div>
          <div className="wfActions">
            <ActionButton onClick={handleCompare} busy={busy} disabled={selected.length === 0}>
              {comparison
                ? t("Compare again", "دوبارہ موازنہ کریں")
                : t("Compare selected scenarios", "منتخب منظرناموں کا موازنہ کریں")}
            </ActionButton>
            {selected.length === 0 ? (
              <span className="wfHint">{t("Select at least one scenario.", "کم از کم ایک منظرنامہ منتخب کریں۔")}</span>
            ) : null}
          </div>
          {error ? <ErrorNotice error={error} title={t("COMPARE did not complete", "موازنہ (COMPARE) مکمل نہیں ہوا")} /> : null}

          {comparison ? (
            <>
              <StepTitle index={2}>{t("Side-by-side outcomes", "نتائج ساتھ ساتھ")}</StepTitle>
              <div className="wfTableScroll">
                <table className="wfTable wfNumbers">
                  <thead>
                    <tr>
                      <th>{t("Response", "ردِعمل")}</th>
                      <th>{t("COGS change vs after-shock (PKR)", "جھٹکے کے بعد کے مقابلے میں COGS کی تبدیلی (روپے)")}</th>
                      <th>{t("Gross margin (%)", "مجموعی مارجن (%)")}</th>
                      <th>{t("Cash requirement (PKR)", "نقدی کی ضرورت (روپے)")}</th>
                      <th>
                        {t(
                          "Operating profit change vs after-shock (PKR)",
                          "جھٹکے کے بعد کے مقابلے میں آپریٹنگ منافع کی تبدیلی (روپے)",
                        )}
                      </th>
                      <th>{t("Trade-offs (rule-based)", "فوائد و نقصانات (اصولوں پر مبنی)")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.comparisons.map((row, index) => (
                      <tr key={comparison.scenario_result_ids[index] ?? index}>
                        <td dir="auto">{scenarioNameFor(comparison.scenario_result_ids[index], row.name)}</td>
                        <td>{formatSigned(row.cost_impact, 2, language)}</td>
                        <td>{formatValue(row.margin, 2, language)}</td>
                        <td>{formatValue(row.cash_requirement, 2, language)}</td>
                        <td>{formatSigned(row.profit_impact, 2, language)}</td>
                        <td className="wfText">
                          {row.trade_offs.map((tag) => tradeOffLabel(tag, language)).join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <InfoNotice title={t("How to read this", "اسے کیسے پڑھیں")}>
                <p>
                  {t(
                    "Values are projections from the deterministic engine. FLUXSCOPE does not rank these options. Risk levels are not shown because no deterministic risk rule has been agreed yet. Comparison ID ",
                    "یہ اقدار متعین انجن کے تخمینے ہیں۔ FLUXSCOPE ان اختیارات کی درجہ بندی نہیں کرتا۔ خطرے کی سطح نہیں دکھائی گئی کیونکہ خطرے کا کوئی متعین اصول ابھی طے نہیں ہوا۔ موازنے کی شناخت (ID) ",
                  )}
                  <code>{comparison.id}</code>
                  {t(".", "۔")}
                </p>
              </InfoNotice>
              <NextStep href="#stage-respond">{t("Continue to RESPOND", "عمل (RESPOND) کی طرف بڑھیں")}</NextStep>
            </>
          ) : null}
        </>
      )}
    </StageFrame>
  );
}
