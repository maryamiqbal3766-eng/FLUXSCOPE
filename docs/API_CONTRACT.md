# TADBIR — API Contract

**Product:** TADBIR — تدبیر  
**Purpose:** AI-powered economic shock analysis and business decision-support system  
**Document:** API Contract  
**Status:** Authoritative implementation contract  
**Version:** 1.0

---

# 1. Purpose

This document defines the API interfaces through which TADBIR's frontend, backend services, AI agents, RAG layer, deterministic financial engine, scenario engine, and monitoring components communicate.

The API contract exists to ensure that:

1. Every component knows what it can send.
2. Every component knows what it can receive.
3. Team members can develop independently.
4. AI coding agents do not invent incompatible interfaces.
5. Backend calculations remain separate from frontend presentation.
6. Economic intelligence remains separate from financial calculation.
7. Financial calculations remain deterministic.
8. Human decision-making remains separate from AI-generated analysis.
9. Changes to shared interfaces are controlled.

This document is an implementation contract.

---

# 2. Authoritative Workflow

TADBIR's canonical workflow is:

```text
DETECT
   ↓
TRACE
   ↓
QUANTIFY
   ↓
SIMULATE
   ↓
COMPARE
   ↓
RESPOND
   ↓
MONITOR
```

---

# 3. API Conventions

The API serves the locked sequence `DETECT → TRACE → QUANTIFY → SIMULATE → COMPARE → RESPOND → MONITOR`. It coordinates components; it does not change their ownership.

All endpoints use a versioned base path: `/api/v1`. Authentication/authorization is outside this MVP contract. `business_id` scopes business records; global economic shocks are addressed only by `shock_id`.

Successful responses use:

```json
{"data": {}, "meta": {"processing_status": "completed"}}
```

Blocked/clarification responses use HTTP `422` and:

```json
{"error": {"code": "CLARIFICATION_REQUIRED", "message": "Required inputs need confirmation.", "stage": "TRACE", "required_fields": ["..."]}}
```

Every resource response exposes its applicable provenance, verification, confirmation, and processing statuses defined in the Data Contract. Requests and responses MUST keep external facts, business facts, assumptions, calculations, and decisions distinct.

## 3.1 Error Conventions

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | Malformed request or unsupported field/value. |
| 404 | `RESOURCE_NOT_FOUND` | The scoped record does not exist. |
| 409 | `STATE_CONFLICT` | The requested transition conflicts with current state. |
| 422 | `CLARIFICATION_REQUIRED` | Required input is absent, unclear, or unconfirmed. |
| 422 | `VERIFICATION_REQUIRED` | Required external fact is pending, rejected, or unverifiable. |
| 422 | `APPROVAL_REQUIRED` | A required scenario or owner approval has not occurred. |
| 424 | `UPSTREAM_UNAVAILABLE` | Required member-owned service or approved source is unavailable. |
| 500 | `PROCESSING_FAILED` | Processing failed without a valid result; no result is invented. |

---

# 4. Stage Endpoints

| Stage | Endpoint | Request | Response | Owner / boundary |
|---|---|---|---|---|
| DETECT | `POST /shocks` | Global `EconomicShockEvent` candidate with provenance; no `business_id` | Registered global shock and verification state | Member 2 supplies economic intelligence; Member 1 validates/orchestrates. |
| DETECT | `GET /shocks/{shock_id}` | Path ID | `EconomicShockEvent` | No new economic facts are created by this API. |
| TRACE | `POST /businesses/{business_id}/intake-drafts` | Unconfirmed business facts | `BusinessIntakeDraft` | Member 1 intake/validation; draft values cannot be calculated. |
| TRACE | `POST /businesses/{business_id}/intake-drafts/{draft_id}/confirm` | Explicit user verification | Confirmed `BusinessProfile` | Only confirmed draft fields enter the profile. |
| TRACE | `POST /impact-mappings` | `shock_event_id`, `business_id` | `ImpactMapping` or blocker | Member 3 owns mapping logic. |
| QUANTIFY | `POST /impact-results` | `shock_event_id`, `impact_mapping_id`, required input references, explicit assumptions | `ImpactResult` or blocker | Member 3 deterministic engine only. |
| SIMULATE | `POST /scenarios` | `base_impact_result_id`, changed assumptions | `ScenarioDefinition` | Creates an explicit hypothetical record. |
| SIMULATE | `POST /scenarios/{scenario_id}/confirm` | Explicit owner scenario confirmation | Confirmed `ScenarioDefinition` | Any later edit returns the scenario to draft. |
| SIMULATE | `POST /scenarios/{scenario_id}/run` | No calculated metric values | `ScenarioResult` or `APPROVAL_REQUIRED` | Executes only when scenario status is confirmed; Member 3 owns it. |
| COMPARE | `POST /comparisons` | compatible `scenario_result_ids` and base result reference | `ComparisonSet` | Member 3 calculates numerical/rule-based comparison and risk outputs; Member 4 presents. |
| COMPARE | `GET /comparisons/{comparison_id}` | Path ID | `ComparisonSet` | Does not select a response. |
| RESPOND | `POST /decisions` | comparison reference plus owner selection/owner-defined response | pending `HumanDecision` | Records choice, never an AI recommendation as a decision. |
| RESPOND | `POST /decisions/{decision_id}/confirm` | owner confirmation reference | confirmed `HumanDecision` | Requires explicit owner confirmation. |
| MONITOR | `POST /monitoring-records` | actual observed/business value with source/input reference | `MonitoringRecord` | Member 3 owns monitoring logic. |
| MONITOR | `POST /projection-comparisons` | decision and monitoring record references | `ProjectionComparison` or blocker | Calculates/reports actual vs projected; Member 4 presents. |

`POST` endpoints MUST return `422` rather than fabricate output when prerequisite statuses are not satisfied.

---

# 5. Required Request and Response Shapes

Field-level models are authoritative in `DATA_CONTRACT.md`. API payloads use those models directly:

- `POST /shocks`: global `shock_type`, `economic_variable`, source-supplied change/date fields, and `provenance`; `business_id` is invalid.
- Business intake draft: only declared business facts; confirmation uses the dedicated draft-confirmation endpoint and creates the confirmed profile.
- Mapping/calculation/run requests: record IDs and explicit assumption records, not free-text financial outputs.
- Comparison requests: IDs of completed, compatible deterministic results; comparison/risk fields are server-produced by Member 3's deterministic rules.
- Decision confirmation: selected response reference and owner confirmation reference.
- Monitoring input: actual value, unit, observed date, and its business/source reference.

Any request containing a claimed calculated result for the calculation or scenario endpoints is invalid. The deterministic engine is the sole producer of calculated metric values.

---

# 6. Approval, Provenance, and Failure Rules

1. TRACE may use a pending, verified, or unverifiable shock. A verified shock is required before QUANTIFY and any financial calculation.
2. Required business facts must be independently confirmed before they are used in a calculation.
3. Changed scenario assumptions are distinct from business facts. They may be edited as drafts, but the owner must explicitly confirm the scenario before it runs; a subsequent edit returns it to draft.
4. Only explicit owner confirmation records a final response decision.
5. An unavailable source or member-owned processing service returns an explicit failure/blocker status; callers may retry after the dependency is available.
6. Frontend clients display returned statuses and blockers. They do not supply substitute data, perform financial calculations, or turn a pending choice into a final decision.

---

# 7. Open MVP Decisions Requiring Team Agreement

- The exact approved-source registry and verification procedure.
- Whether `POST /shocks` is internal-only or exposed to an administrative workflow.
- Deterministic formula/risk-rule references and monitoring variance/reassessment rule parameters supplied by Member 3.

These remain documented choices; this contract does not implement or select them.
