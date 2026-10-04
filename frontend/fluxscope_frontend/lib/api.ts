/**
 * FLUXSCOPE API client.
 *
 * Every backend call used by the workflow lives here. Types mirror the
 * FastAPI/Pydantic models in `app/models/domain.py`,
 * `app/services/economic_intelligence/schemas.py` and the Member 3 engine
 * dataclasses. The frontend never calculates financial values: it sends
 * user input and displays what the backend returns.
 */

// Set NEXT_PUBLIC_API_BASE_URL at build time for deployment; it is inlined by Next.js.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "") || "http://localhost:8000";

const API_PREFIX = "/api/v1";

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** Contract error body: {"error": {code, message, stage?, required_fields?}} */
export type ApiErrorBody = {
  code: string;
  message: string;
  stage?: string;
  required_fields?: string[];
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly stage?: string;
  readonly requiredFields: string[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.stage = body.stage;
    this.requiredFields = body.required_fields ?? [];
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, {
    code: "CLIENT_ERROR",
    message: error instanceof Error ? error.message : String(error),
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, {
      code: "BACKEND_UNREACHABLE",
      message: `No readable response from the FLUXSCOPE API at ${API_BASE_URL}. The backend may be stopped, or it failed while processing this request (check the backend log), or this page's origin is not allowed by CORS (use localhost:3000 or 3001).`,
    });
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    if (body && typeof body === "object" && "error" in body) {
      throw new ApiError(response.status, (body as { error: ApiErrorBody }).error);
    }
    throw new ApiError(response.status, {
      code: `HTTP_${response.status}`,
      message:
        typeof body === "string" && body
          ? body
          : `The backend returned HTTP ${response.status} without a contract error body.`,
    });
  }

  return body as T;
}

function post<T>(path: string, payload?: unknown): Promise<T> {
  return request<T>(`${API_PREFIX}${path}`, {
    method: "POST",
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

function get<T>(path: string): Promise<T> {
  return request<T>(`${API_PREFIX}${path}`);
}

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

/** Backend Decimals arrive as JSON numbers (engine results) or strings (Pydantic models). */
export type DecimalValue = number | string;

export type VerificationStatus = "pending" | "verified" | "unverifiable" | "rejected";

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

export type HealthResponse = { status: string };

export function checkBackendHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

/* ------------------------------------------------------------------ */
/* DETECT                                                              */
/* ------------------------------------------------------------------ */

export type ApprovedSource = {
  publisher: string;
  domains: string[];
  role: string;
};

export type SourceDocumentInput = {
  title: string;
  publisher: string;
  content: string;
  source_url: string;
  published_at?: string;
};

export type SourceEvidence = {
  source_id: string;
  title: string;
  publisher: string;
  source_url: string | null;
  quote: string;
  variable_text: string;
  value_text: string | null;
  evidence_locator: string | null;
};

export type ShockCandidate = {
  shock_id: string;
  shock_type: string;
  variable: string;
  direction_or_change: string;
  magnitude: DecimalValue | null;
  unit: string | null;
  effective_date: string | null;
  source_evidence: SourceEvidence[];
  potential_dependencies: string[];
  status: "CANDIDATE" | "VERIFIED" | "REJECTED";
  verification_status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  verification_notes: string[];
  detected_at: string;
};

export type ProvenanceRecord = {
  source_name: string;
  source_url_or_reference: string;
  retrieved_at: string;
  published_at: string | null;
  source_excerpt_or_locator: string | null;
  verification_status: VerificationStatus;
};

export type EconomicShockEvent = {
  id: string;
  shock_type: string;
  economic_variable: string;
  direction_or_change: string;
  observed_or_effective_date: string;
  provenance: ProvenanceRecord[];
  verification_status: VerificationStatus;
  magnitude: string | null;
  unit: string | null;
  period: string | null;
  source_notes: string | null;
  processing_status: string;
  created_at: string;
  updated_at: string;
};

export function listApprovedSources(): Promise<ApprovedSource[]> {
  return get<ApprovedSource[]>("/detect/approved-sources");
}

export function detectEconomicShocks(payload: SourceDocumentInput): Promise<ShockCandidate[]> {
  return post<ShockCandidate[]>("/detect", payload);
}

/** Hands a server-side DETECT candidate to the workflow (keeps its ID and verifier status). */
export function registerDetectedShock(shockId: string): Promise<EconomicShockEvent> {
  return post<EconomicShockEvent>(`/shocks/from-detection/${shockId}`);
}

/* ------------------------------------------------------------------ */
/* TRACE                                                               */
/* ------------------------------------------------------------------ */

export type BusinessFact = { value: string; unit?: string | null };

export type BusinessIntakeDraft = {
  id: string;
  business_id: string;
  submitted_fields: Record<string, BusinessFact>;
  intake_status: "draft" | "clarification_required" | "confirmed" | "rejected";
  created_at: string;
  updated_at: string;
};

export type BusinessProfile = {
  id: string;
  business_id: string;
  confirmed_fields: Record<string, BusinessFact>;
  source_intake_draft_ids: string[];
  business_confirmation_status: "confirmed";
  created_at: string;
  updated_at: string;
};

export type ImpactNode = {
  id: string;
  node_type: "economic_shock" | "business_dependency" | "operational_effect" | "financial_effect";
  label: string;
  source_reference: string | null;
};

export type ImpactEdge = {
  source_node_id: string;
  target_node_id: string;
  relationship: string;
};

export type ImpactGraph = {
  id: string;
  shock_event_id: string;
  business_id: string;
  nodes: ImpactNode[];
  edges: ImpactEdge[];
};

export function createIntakeDraft(
  businessId: string,
  submittedFields: Record<string, BusinessFact>,
): Promise<BusinessIntakeDraft> {
  return post<BusinessIntakeDraft>(`/businesses/${businessId}/intake-drafts`, {
    submitted_fields: submittedFields,
  });
}

export function confirmIntakeDraft(businessId: string, draftId: string): Promise<BusinessProfile> {
  return post<BusinessProfile>(`/businesses/${businessId}/intake-drafts/${draftId}/confirm`);
}

export function createImpactMapping(shockEventId: string, businessId: string): Promise<ImpactGraph> {
  return post<ImpactGraph>("/impact-mappings", {
    shock_event_id: shockEventId,
    business_id: businessId,
  });
}

/* ------------------------------------------------------------------ */
/* QUANTIFY                                                            */
/* ------------------------------------------------------------------ */

/** Mirrors `ImpactResult` in app/services/impact_engine/calculator.py. */
export type ImpactMetrics = {
  baseline_revenue: DecimalValue;
  shocked_revenue: DecimalValue;
  baseline_imported_cost: DecimalValue;
  shocked_imported_cost: DecimalValue;
  imported_cost_impact: DecimalValue;
  baseline_cogs: DecimalValue;
  shocked_cogs: DecimalValue;
  cogs_impact: DecimalValue;
  baseline_gross_profit: DecimalValue;
  shocked_gross_profit: DecimalValue;
  baseline_gross_margin_pct: DecimalValue;
  shocked_gross_margin_pct: DecimalValue;
  gross_margin_change_pct_points: DecimalValue;
  baseline_operating_profit: DecimalValue;
  shocked_operating_profit: DecimalValue;
  profit_impact: DecimalValue;
  baseline_cash_requirement: DecimalValue;
  shocked_cash_requirement: DecimalValue;
  cash_requirement_change: DecimalValue;
  revenue_change_pct: DecimalValue;
  cogs_change_pct: DecimalValue;
  profit_change_pct: DecimalValue;
};

/** Mirrors `ImpactInputs` (the confirmed facts plus the shock-derived change). */
export type ImpactInputs = {
  sales_quantity: DecimalValue;
  selling_price_per_unit: DecimalValue;
  imported_quantity: DecimalValue;
  imported_unit_cost: DecimalValue;
  exchange_rate: DecimalValue;
  local_input_cost: DecimalValue;
  operating_expenses: DecimalValue;
  exchange_rate_change: DecimalValue;
};

export type ImpactResultRecord = {
  id: string;
  business_id: string;
  shock_event_id: string;
  impact_mapping_id: string;
  inputs: ImpactInputs;
  result: ImpactMetrics;
};

export function calculateImpact(payload: {
  shock_event_id: string;
  impact_mapping_id: string;
  business_input_ids: string[];
}): Promise<ImpactResultRecord> {
  return post<ImpactResultRecord>("/impact-results", { ...payload, assumption_ids: [] });
}

/* ------------------------------------------------------------------ */
/* SIMULATE                                                            */
/* ------------------------------------------------------------------ */

export type ScenarioAssumption = {
  field_reference: string;
  value: string;
  unit?: string | null;
};

export type ScenarioDefinition = {
  id: string;
  business_id: string;
  base_impact_result_id: string;
  name: string;
  changed_assumptions: ScenarioAssumption[];
  assumption_confirmation_status: "draft" | "confirmed" | "rejected";
  processing_status: string;
  created_at: string;
  updated_at: string;
};

export type ScenarioResultRecord = {
  id: string;
  scenario_id: string;
  business_id: string;
  base_impact_result_id: string;
  result: {
    name: string;
    baseline: ImpactMetrics;
    projected: ImpactMetrics;
  };
};

export function createScenario(payload: {
  business_id: string;
  base_impact_result_id: string;
  name: string;
  changed_assumptions: ScenarioAssumption[];
}): Promise<ScenarioDefinition> {
  return post<ScenarioDefinition>("/scenarios", payload);
}

export function confirmScenario(scenarioId: string): Promise<ScenarioDefinition> {
  return post<ScenarioDefinition>(`/scenarios/${scenarioId}/confirm`);
}

export function runScenario(scenarioId: string): Promise<ScenarioResultRecord> {
  return post<ScenarioResultRecord>(`/scenarios/${scenarioId}/run`);
}

/* ------------------------------------------------------------------ */
/* COMPARE                                                             */
/* ------------------------------------------------------------------ */

/** Mirrors `ScenarioComparison` in app/services/impact_engine/comparison.py. */
export type ScenarioComparison = {
  name: string;
  cost_impact: DecimalValue;
  margin: DecimalValue;
  cash_requirement: DecimalValue;
  profit_impact: DecimalValue;
  trade_offs: string[];
};

export type ComparisonSet = {
  id: string;
  business_id: string;
  base_impact_result_id: string;
  scenario_result_ids: string[];
  comparisons: ScenarioComparison[];
  created_at: string;
};

export function createComparison(payload: {
  business_id: string;
  base_impact_result_id: string;
  scenario_result_ids: string[];
}): Promise<ComparisonSet> {
  return post<ComparisonSet>("/comparisons", payload);
}

/* ------------------------------------------------------------------ */
/* RESPOND                                                             */
/* ------------------------------------------------------------------ */

export type HumanDecision = {
  id: string;
  business_id: string;
  comparison_set_id: string;
  selected_scenario_id: string | null;
  owner_defined_response: string | null;
  decision_status: "not_selected" | "selected" | "confirmed" | "withdrawn";
  owner_confirmation_reference: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export function createDecision(payload: {
  business_id: string;
  comparison_set_id: string;
  selected_scenario_id?: string;
  owner_defined_response?: string;
}): Promise<HumanDecision> {
  return post<HumanDecision>("/decisions", payload);
}

export function confirmDecision(
  decisionId: string,
  ownerConfirmationReference: string,
): Promise<HumanDecision> {
  return post<HumanDecision>(`/decisions/${decisionId}/confirm`, {
    owner_confirmation_reference: ownerConfirmationReference,
  });
}

/* ------------------------------------------------------------------ */
/* MONITOR                                                             */
/* ------------------------------------------------------------------ */

export type MonitoringStatus = "ON_TRACK" | "VARIANCE_DETECTED" | "REASSESSMENT_REQUIRED";

/** Mirrors `MonitoringResult` in app/services/impact_engine/monitoring.py. */
export type MonitoringResult = {
  metric_name: string;
  projected_value: DecimalValue;
  actual_value: DecimalValue;
  variance: DecimalValue;
  variance_pct: DecimalValue;
  status: MonitoringStatus;
};

export function recordMonitoringInput(payload: {
  business_id: string;
  human_decision_id: string;
  metric_name: string;
  actual_value: string;
  unit: string;
  observed_at: string;
  provenance_or_business_input_reference: string;
}): Promise<MonitoringResult> {
  return post<MonitoringResult>("/monitoring-records", payload);
}
