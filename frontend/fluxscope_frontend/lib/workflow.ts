/**
 * Presentation helpers for the guided workflow.
 *
 * Nothing in this file calculates a financial result. Field names mirror the
 * backend contracts so that user input is sent exactly as the backend expects.
 */

import type { DecimalValue } from "./api";
import type { Language } from "./i18n";

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
  labelUr: string;
  helpUr: string;
};

export const BUSINESS_FIELDS: BusinessFieldDefinition[] = [
  {
    key: "sales_quantity",
    label: "Units sold",
    unit: "units",
    help: "Units you sell in the period you are analysing (for example, one month).",
    labelUr: "فروخت شدہ یونٹس",
    helpUr: "جس مدت کا تجزیہ کر رہے ہیں (مثلاً ایک ماہ)، اُس میں آپ کتنے یونٹس فروخت کرتے ہیں۔",
  },
  {
    key: "selling_price_per_unit",
    label: "Selling price per unit",
    unit: "PKR_per_unit",
    help: "Your current selling price for one unit, in PKR.",
    labelUr: "فی یونٹ فروخت قیمت",
    helpUr: "ایک یونٹ کی موجودہ فروخت قیمت، روپوں (PKR) میں۔",
  },
  {
    key: "imported_quantity",
    label: "Imported input quantity",
    unit: "units",
    help: "Units of imported input you buy in the same period.",
    labelUr: "درآمدی خام مال کی مقدار",
    helpUr: "اسی مدت میں آپ درآمدی خام مال کے کتنے یونٹس خریدتے ہیں۔",
  },
  {
    key: "imported_unit_cost",
    label: "Imported input cost per unit (foreign currency)",
    unit: "foreign_currency_per_unit",
    help: "Price of one unit of imported input in the foreign currency you pay in.",
    labelUr: "درآمدی خام مال کی فی یونٹ لاگت (غیر ملکی کرنسی)",
    helpUr: "درآمدی خام مال کے ایک یونٹ کی قیمت، اُس غیر ملکی کرنسی میں جس میں آپ ادائیگی کرتے ہیں۔",
  },
  {
    key: "exchange_rate",
    label: "Exchange rate you currently pay",
    unit: "PKR_per_foreign_currency",
    help: "PKR per one unit of that foreign currency, before the shock.",
    labelUr: "موجودہ شرحِ مبادلہ جو آپ ادا کرتے ہیں",
    helpUr: "اُس غیر ملکی کرنسی کی ایک اکائی کے بدلے کتنے روپے، جھٹکے سے پہلے۔",
  },
  {
    key: "local_input_cost",
    label: "Local input cost (total)",
    unit: "PKR",
    help: "Total locally sourced input cost in the same period, in PKR.",
    labelUr: "مقامی خام مال کی لاگت (کل)",
    helpUr: "اسی مدت میں مقامی طور پر خریدے گئے خام مال کی کل لاگت، روپوں میں۔",
  },
  {
    key: "operating_expenses",
    label: "Operating expenses (total)",
    unit: "PKR",
    help: "Total operating expenses in the same period, in PKR.",
    labelUr: "آپریٹنگ اخراجات (کل)",
    helpUr: "اسی مدت کے کل آپریٹنگ اخراجات، روپوں میں۔",
  },
];

export function fieldLabel(key: string, language: Language = "en"): string {
  const field = BUSINESS_FIELDS.find((item) => item.key === key);
  if (!field) return key;
  return language === "ur" ? field.labelUr : field.label;
}

/** Urdu display names for the unit codes sent to the backend. */
const UNIT_LABELS_UR: Record<string, string> = {
  units: "یونٹس",
  PKR_per_unit: "روپے فی یونٹ",
  foreign_currency_per_unit: "غیر ملکی کرنسی فی یونٹ",
  PKR_per_foreign_currency: "روپے فی غیر ملکی کرنسی",
  PKR: "روپے",
  percent: "فیصد",
  "%": "فیصد",
};

/** Display name of a unit code; English shows the code exactly as before. */
export function unitLabel(unit: string, language: Language = "en"): string {
  return language === "ur" ? UNIT_LABELS_UR[unit] ?? unit : unit;
}

/** Non-negative decimal accepted by the backend's Decimal parsing. */
export const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

export function isDecimal(value: string): boolean {
  return DECIMAL_PATTERN.test(value.trim());
}

/** Formats a backend-returned number for display only. */
export function formatValue(
  value: DecimalValue | null | undefined,
  digits = 2,
  language: Language = "en",
): string {
  if (value === null || value === undefined || value === "") {
    return language === "ur" ? "واپس نہیں آیا" : "Not returned";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(numeric);
  // Values that round to zero are shown as 0, never "-0".
  return formatted === "-0" ? "0" : formatted;
}

export function formatSigned(
  value: DecimalValue | null | undefined,
  digits = 2,
  language: Language = "en",
): string {
  const formatted = formatValue(value, digits, language);
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return `+${formatted}`;
  return formatted;
}

export function formatDate(value: string | null | undefined, language: Language = "en"): string {
  if (!value) return language === "ur" ? "درج نہیں" : "Not stated";
  return value.length > 10 ? new Date(value).toLocaleString() : value;
}

export function humanize(value: string): string {
  return value.replace(/_/g, " ");
}

/** Urdu names for backend vocabulary (shock types, statuses, graph nodes). */
const TERMS_UR: Record<string, string> = {
  exchange_rate: "شرحِ مبادلہ",
  fuel_price: "ایندھن کی قیمت",
  energy: "توانائی",
  interest_rate: "شرحِ سود",
  inflation: "مہنگائی (افراطِ زر)",
  input_cost: "خام مال کی لاگت",
  tax_duty: "ٹیکس / ڈیوٹی",
  trade_policy: "تجارتی پالیسی",
  increase: "اضافہ",
  decrease: "کمی",
  change: "تبدیلی",
  new_policy: "نئی پالیسی",
  unchanged: "کوئی تبدیلی نہیں",
  verified: "تصدیق شدہ",
  VERIFIED: "تصدیق شدہ",
  pending: "زیرِ التوا",
  PENDING_VERIFICATION: "تصدیق زیرِ التوا",
  unverifiable: "ناقابلِ تصدیق",
  rejected: "مسترد",
  REJECTED: "مسترد",
  draft: "مسودہ",
  confirmed: "تصدیق شدہ",
  selected: "منتخب",
  simulated: "محاکات مکمل",
  not_selected: "منتخب نہیں",
  withdrawn: "واپس لیا گیا",
  economic_shock: "معاشی جھٹکا",
  business_dependency: "کاروباری انحصار",
  operational_effect: "عملی اثر",
  financial_effect: "مالی اثر",
  ON_TRACK: "اندازے کے مطابق",
  VARIANCE_DETECTED: "فرق پایا گیا",
  REASSESSMENT_REQUIRED: "دوبارہ جائزہ درکار",
};

/** Localized display of a backend term; English output is unchanged (humanize). */
export function term(value: string, language: Language = "en"): string {
  return language === "ur" ? TERMS_UR[value] ?? humanize(value) : humanize(value);
}

/** Urdu name of a backend term, or the raw value in English (shown as-is before). */
export function rawTerm(value: string, language: Language = "en"): string {
  return language === "ur" ? TERMS_UR[value] ?? humanize(value) : value;
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

const TRADE_OFF_LABELS_UR: Record<string, string> = {
  projected_profit_increases: "آپریٹنگ منافع بڑھتا ہے",
  projected_profit_decreases: "آپریٹنگ منافع کم ہوتا ہے",
  projected_profit_unchanged: "آپریٹنگ منافع میں تبدیلی نہیں",
  cash_requirement_increases: "نقدی کی ضرورت بڑھتی ہے",
  cash_requirement_decreases: "نقدی کی ضرورت کم ہوتی ہے",
  cash_requirement_unchanged: "نقدی کی ضرورت میں تبدیلی نہیں",
  gross_margin_improves: "مجموعی مارجن بہتر ہوتا ہے",
  gross_margin_declines: "مجموعی مارجن کم ہوتا ہے",
  gross_margin_unchanged: "مجموعی مارجن میں تبدیلی نہیں",
};

export function tradeOffLabel(tag: string, language: Language = "en"): string {
  if (language === "ur") return TRADE_OFF_LABELS_UR[tag] ?? humanize(tag);
  return TRADE_OFF_LABELS[tag] ?? humanize(tag);
}

/** Scenario fields accepted by the deterministic scenario engine. */
export type ScenarioFieldDefinition = {
  key: string;
  label: string;
  unit: string;
  help: string;
  labelUr: string;
  helpUr: string;
  /** Business fact whose confirmed value this field replaces, if any. */
  replaces?: string;
};

export const SCENARIO_FIELDS: ScenarioFieldDefinition[] = [
  {
    key: "selling_price_per_unit",
    label: "New selling price per unit",
    unit: "PKR_per_unit",
    help: "Replaces your confirmed selling price.",
    labelUr: "نئی فی یونٹ فروخت قیمت",
    helpUr: "آپ کی تصدیق شدہ فروخت قیمت کی جگہ لے گی۔",
    replaces: "selling_price_per_unit",
  },
  {
    key: "imported_quantity",
    label: "New imported input quantity",
    unit: "units",
    help: "Replaces your confirmed imported quantity.",
    labelUr: "درآمدی خام مال کی نئی مقدار",
    helpUr: "آپ کی تصدیق شدہ درآمدی مقدار کی جگہ لے گی۔",
    replaces: "imported_quantity",
  },
  {
    key: "operating_expenses",
    label: "New operating expenses (total)",
    unit: "PKR",
    help: "Replaces your confirmed operating expenses.",
    labelUr: "نئے آپریٹنگ اخراجات (کل)",
    helpUr: "آپ کے تصدیق شدہ آپریٹنگ اخراجات کی جگہ لیں گے۔",
    replaces: "operating_expenses",
  },
  {
    key: "exchange_rate",
    label: "New pre-shock exchange rate",
    unit: "PKR_per_foreign_currency",
    help: "Replaces the exchange rate you confirmed; the verified shock is still applied on top.",
    labelUr: "جھٹکے سے پہلے کی نئی شرحِ مبادلہ",
    helpUr: "آپ کی تصدیق شدہ شرحِ مبادلہ کی جگہ لے گی؛ تصدیق شدہ جھٹکا اس پر بدستور لاگو ہوگا۔",
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
export const MONITOR_METRICS: { key: string; label: string; labelUr: string; unit: string }[] = [
  { key: "revenue", label: "Revenue", labelUr: "آمدنی", unit: "PKR" },
  { key: "COGS", label: "Cost of goods sold (COGS)", labelUr: "فروخت شدہ مال کی لاگت (COGS)", unit: "PKR" },
  { key: "gross_profit", label: "Gross profit", labelUr: "مجموعی منافع", unit: "PKR" },
  { key: "gross_margin_pct", label: "Gross margin", labelUr: "مجموعی منافع کا مارجن", unit: "percent" },
  { key: "operating_profit", label: "Operating profit", labelUr: "آپریٹنگ منافع", unit: "PKR" },
  { key: "cash_requirement", label: "Cash requirement", labelUr: "نقدی کی ضرورت", unit: "PKR" },
];
