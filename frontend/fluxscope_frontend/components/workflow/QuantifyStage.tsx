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
import {
  fieldLabel,
  formatSigned,
  formatValue,
  humanize,
  type StageStatus,
} from "../../lib/workflow";
import {
  ActionButton,
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
  shock: EconomicShockEvent | null;
  profile: BusinessProfile | null;
  mapping: ImpactGraph | null;
  impact: ImpactResultRecord | null;
  onCalculated: (impact: ImpactResultRecord) => void;
  onMissingFields: (fields: string[]) => void;
  onBlocked: (code: string | null) => void;
};

type MetricRow = {
  label: string;
  before: keyof ImpactMetrics;
  after: keyof ImpactMetrics;
  change?: keyof ImpactMetrics;
  changeLabel?: string;
  unit: string;
};

/** Rows of `ImpactResult` as returned by the deterministic calculator. */
export const IMPACT_ROWS: MetricRow[] = [
  { label: "Revenue", before: "baseline_revenue", after: "shocked_revenue", change: "revenue_change_pct", changeLabel: "%", unit: "PKR" },
  { label: "Imported input cost", before: "baseline_imported_cost", after: "shocked_imported_cost", change: "imported_cost_impact", unit: "PKR" },
  { label: "Cost of goods sold (COGS)", before: "baseline_cogs", after: "shocked_cogs", change: "cogs_impact", unit: "PKR" },
  { label: "Gross profit", before: "baseline_gross_profit", after: "shocked_gross_profit", unit: "PKR" },
  { label: "Gross margin", before: "baseline_gross_margin_pct", after: "shocked_gross_margin_pct", change: "gross_margin_change_pct_points", changeLabel: "pp", unit: "%" },
  { label: "Operating profit", before: "baseline_operating_profit", after: "shocked_operating_profit", change: "profit_impact", unit: "PKR" },
  { label: "Cash requirement", before: "baseline_cash_requirement", after: "shocked_cash_requirement", change: "cash_requirement_change", unit: "PKR" },
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
  return (
    <table className="wfTable wfNumbers">
      <thead>
        <tr>
          <th>Metric</th>
          <th>{beforeLabel}</th>
          <th>{afterLabel}</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>
        {IMPACT_ROWS.map((row) => (
          <tr key={row.label}>
            <td>
              {row.label} <em>({row.unit})</em>
            </td>
            <td>{formatValue(metrics[row.before])}</td>
            <td>{formatValue(metrics[row.after])}</td>
            <td>
              {row.change
                ? `${formatSigned(metrics[row.change])}${row.changeLabel ? ` ${row.changeLabel}` : ""}`
                : "Not returned"}
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const prerequisite = !shock
    ? { text: "Select a detected shock in DETECT first.", href: "#stage-detect" }
    : !profile || !mapping
      ? { text: "Confirm your business facts and create the impact mapping in TRACE first.", href: "#stage-trace" }
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
        onMissingFields(apiError.requiredFields);
      }
    } finally {
      setBusy(false);
    }
  }

  const missingFacts =
    error?.code === "CLARIFICATION_REQUIRED" &&
    error.requiredFields.some((field) => profile && !(field in profile.confirmed_fields));

  return (
    <StageFrame
      id="stage-quantify"
      number={3}
      tag="▥ QUANTIFY"
      title="What is the measurable impact?"
      status={status}
      explanation={
        <>
          <p>
            The backend’s deterministic engine calculates the effect of the verified shock on your
            confirmed facts. No AI model produces these numbers, and this page only displays what the
            engine returns. The current engine models an exchange-rate shock on imported inputs.
            Other shock types are reported as unsupported rather than forced into that model.
          </p>
          <p>
            <b>Next:</b> SIMULATE lets you test responses against this result.
          </p>
        </>
      }
    >
      {prerequisite ? (
        <LockedNotice requirement={prerequisite.text} href={prerequisite.href} />
      ) : (
        <>
          <StepTitle index={1}>Inputs the engine will use</StepTitle>
          <KeyValues
            rows={[
              ["Shock", `${humanize(shock!.shock_type)} — ${shock!.economic_variable}`],
              [
                "Shock change (from the verified source)",
                shock!.magnitude ? `${shock!.direction_or_change} ${shock!.magnitude} ${shock!.unit ?? ""}` : "No magnitude stated",
              ],
              ["Shock verification", shock!.verification_status],
              ["Impact mapping", <code key="m">{mapping!.id}</code>],
              [
                "Confirmed business facts",
                Object.entries(profile!.confirmed_fields)
                  .map(([key, fact]) => `${fieldLabel(key)}: ${fact.value}`)
                  .join(" · "),
              ],
            ]}
          />
          {!impact ? (
            <div className="wfActions">
              <ActionButton onClick={handleCalculate} busy={busy}>
                Run deterministic calculation
              </ActionButton>
            </div>
          ) : null}

          {error ? (
            <>
              <ErrorNotice
                error={error}
                title={
                  error.code === "UNSUPPORTED_SHOCK_TYPE"
                    ? "This shock type cannot be quantified yet"
                    : error.code === "VERIFICATION_REQUIRED"
                      ? "QUANTIFY needs a verified shock"
                      : "QUANTIFY is blocked"
                }
              />
              {missingFacts ? (
                <InfoNotice tone="warn" title="What to do">
                  <p>
                    Add the listed facts in TRACE, confirm them, and create the mapping again. Then
                    return here.
                  </p>
                  <a className="wfLink" href="#stage-trace">
                    Go to TRACE ↑
                  </a>
                </InfoNotice>
              ) : null}
            </>
          ) : null}

          {impact ? (
            <>
              <StepTitle index={2}>Calculated impact (projection, not an observed fact)</StepTitle>
              <MetricsTable metrics={impact.result} beforeLabel="Before shock" afterLabel="After shock" />
              <p className="wfHint">
                Exchange-rate change applied by the engine: {formatValue(impact.inputs.exchange_rate_change, 6)}{" "}
                (decimal fraction, from the verified shock). Impact result ID <code>{impact.id}</code>.
              </p>
              <NextStep href="#stage-simulate">Continue to SIMULATE</NextStep>
            </>
          ) : null}
        </>
      )}
    </StageFrame>
  );
}
