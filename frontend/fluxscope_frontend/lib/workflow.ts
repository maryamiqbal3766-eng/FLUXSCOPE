/**
 * Presentation helpers for the guided workflow.
 *
 * Nothing in this file calculates a financial result. Field names mirror the
 * backend contracts so that user input is sent exactly as the backend expects.
 */

import type { DecimalValue } from "./api";

export type StageKey =
  | "detect"
  | "trace"
  | "quantify"
  | "simulate"
  | "compare"
  | "respond"
  | "monitor";

export type StageStatusTone = "done" | "ready" | "locked" | "blocked";

export type StageStatus = {
  tone: StageStatusTone;
  label: string;
};

/**
 * Business facts read by the deterministic QUANTIFY engine
 * (`Member3Integration.REQUIRED_CALCULATION_FIELDS`). The exchange-rate change
 * is deliberately absent: it comes from the verified shock, not the business.
 */
export type BusinessFieldDefinition = {
  key: string;
  label: string;
  unit: string;
  help: string;
};

export const BUSINESS_FIELDS: BusinessFieldDefinition[] = [
  {
    key: "sales_quantity",
    label: "Units sold",
    unit: "units",
    help: "Units you sell in the period you are analysing (for example, one month).",
  },
  {
    key: "selling_price_per_unit",
    label: "Selling price per unit",
    unit: "PKR_per_unit",
    help: "Your current selling price for one unit, in PKR.",
  },
  {
    key: "imported_quantity",
    label: "Imported input quantity",
    unit: "units",
    help: "Units of imported input you buy in the same period.",
  },
  {
    key: "imported_unit_cost",
    label: "Imported input cost per unit (foreign currency)",
    unit: "foreign_currency_per_unit",
    help: "Price of one unit of imported input in the foreign currency you pay in.",
  },
  {
    key: "exchange_rate",
    label: "Exchange rate you currently pay",
    unit: "PKR_per_foreign_currency",
    help: "PKR per one unit of that foreign currency, before the shock.",
  },
  {
    key: "local_input_cost",
    label: "Local input cost (total)",
    unit: "PKR",
    help: "Total locally sourced input cost in the same period, in PKR.",
  },
  {
    key: "operating_expenses",
    label: "Operating expenses (total)",
    unit: "PKR",
    help: "Total operating expenses in the same period, in PKR.",
  },
];

export function fieldLabel(key: string): string {
  return BUSINESS_FIELDS.find((field) => field.key === key)?.label ?? key;
}

/** Non-negative decimal accepted by the backend's Decimal parsing. */
export const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

export function isDecimal(value: string): boolean {
  return DECIMAL_PATTERN.test(value.trim());
}

/** Formats a backend-returned number for display only. */
export function formatValue(value: DecimalValue | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === "") return "Not returned";
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(numeric);
}

export function formatSigned(value: DecimalValue | null | undefined, digits = 2): string {
  const formatted = formatValue(value, digits);
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return `+${formatted}`;
  return formatted;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not stated";
  return value.length > 10 ? new Date(value).toLocaleString() : value;
}

export function humanize(value: string): string {
  return value.replace(/_/g, " ");
}

/** Rule tags produced by DeterministicScenarioComparator. */
const TRADE_OFF_LABELS: Record<string, string> = {
  projected_profit_increases: "Operating profit increases",
  projected_profit_decreases: "Operating profit decreases",
  projected_profit_unchanged: "Operating profit unchanged",
  cash_requirement_increases: "Cash requirement increases",
  cash_requirement_decreases: "Cash requirement decreases",
  cash_requirement_unchanged: "Cash requirement unchanged",
  gross_margin_improves: "Gross margin improves",
  gross_margin_declines: "Gross margin declines",
  gross_margin_unchanged: "Gross margin unchanged",
};

export function tradeOffLabel(tag: string): string {
  return TRADE_OFF_LABELS[tag] ?? humanize(tag);
}

/** Scenario fields accepted by the deterministic scenario engine. */
export type ScenarioFieldDefinition = {
  key: string;
  label: string;
  unit: string;
  help: string;
  /** Business fact whose confirmed value this field replaces, if any. */
  replaces?: string;
};

export const SCENARIO_FIELDS: ScenarioFieldDefinition[] = [
  {
    key: "selling_price_per_unit",
    label: "New selling price per unit",
    unit: "PKR_per_unit",
    help: "Replaces your confirmed selling price.",
    replaces: "selling_price_per_unit",
  },
  {
    key: "imported_quantity",
    label: "New imported input quantity",
    unit: "units",
    help: "Replaces your confirmed imported quantity.",
    replaces: "imported_quantity",
  },
  {
    key: "operating_expenses",
    label: "New operating expenses (total)",
    unit: "PKR",
    help: "Replaces your confirmed operating expenses.",
    replaces: "operating_expenses",
  },
  {
    key: "exchange_rate",
    label: "New pre-shock exchange rate",
    unit: "PKR_per_foreign_currency",
    help: "Replaces the exchange rate you confirmed; the verified shock is still applied on top.",
    replaces: "exchange_rate",
  },
];

/**
 * Converts percentage points ("5") to the decimal fraction ("0.05") that the
 * scenario engine expects for `exchange_rate_change_delta`. This is a unit
 * conversion of the user's own input, done on the decimal string so no
 * floating-point rounding is introduced. Returns null for invalid input.
 */
export function percentPointsToFraction(input: string): string | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(input.trim());
  if (!match) return null;
  const [, sign, integer, fraction = ""] = match;
  const padded = integer.padStart(3, "0");
  const whole = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  const decimals = (padded.slice(-2) + fraction).replace(/0+$/, "");
  const value = decimals ? `${whole}.${decimals}` : whole;
  return value === "0" ? "0" : `${sign}${value}`;
}

/** Metrics the backend can compare against a stored scenario projection. */
export const MONITOR_METRICS: { key: string; label: string; unit: string }[] = [
  { key: "revenue", label: "Revenue", unit: "PKR" },
  { key: "COGS", label: "Cost of goods sold (COGS)", unit: "PKR" },
  { key: "gross_profit", label: "Gross profit", unit: "PKR" },
  { key: "gross_margin_pct", label: "Gross margin", unit: "percent" },
  { key: "operating_profit", label: "Operating profit", unit: "PKR" },
  { key: "cash_requirement", label: "Cash requirement", unit: "PKR" },
];
