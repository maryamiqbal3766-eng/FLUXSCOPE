# TADBIR — Data Contract

**Product:** TADBIR — تدبیر  
**Purpose:** AI-powered economic shock analysis and business decision-support system  
**Document:** Data Contract  
**Status:** Authoritative implementation contract  
**Version:** 1.0

---

## 1. Purpose

This document defines the structured data exchanged between TADBIR's major components.

It exists to ensure that:

1. Every module knows exactly what data it receives.
2. Every module knows exactly what data it must produce.
3. AI agents do not invent missing business or financial information.
4. Financial calculations are performed by deterministic code.
5. Economic information is traceable to approved sources.
6. Assumptions are explicitly identified.
7. Frontend components do not invent backend results.
8. Different team members can develop independently without changing the meaning of shared data.
9. Coding agents cannot freely redesign the data model while implementing features.

This document must be treated as an implementation contract.

---

# 2. Authoritative Product Workflow

TADBIR's canonical workflow is:

DETECT → TRACE → QUANTIFY → SIMULATE → COMPARE → RESPOND → MONITOR

The data flow follows the same sequence.

```text
Approved Economic Sources
        ↓
     DETECT
        ↓
Economic Shock Event
        ↓
      TRACE
        ↓
Business Dependency / Impact Mapping
        ↓
    QUANTIFY
        ↓
Deterministic Impact Result
        ↓
    SIMULATE
        ↓
Scenario Results
        ↓
    COMPARE
        ↓
Comparable Response Options
        ↓
    RESPOND
        ↓
Human Decision
        ↓
    MONITOR
        ↓
Actual vs Projected Results
```

---

# 3. Shared Record Rules

Every business-scoped persisted or exchanged record MUST include `id`, `business_id`, `created_at`, `updated_at`, and `workflow_stage`. `EconomicShockEvent` is a global record and MUST NOT contain `business_id`; business-specific records reference it by `shock_event_id`. IDs and timestamps are system-generated.

## 3.1 Canonical Types

| Value | Contract type | Rule |
|---|---|---|
| IDs | UUID string | RFC 4122 textual UUID; required unless a field is explicitly nullable. |
| Timestamp | RFC 3339 UTC datetime string | Required for created/updated/observed/retrieved/calculated times. |
| Date | ISO 8601 date string | Used where the source provides a date without a time. |
| Money or rate | decimal string | Decimal representation only; JSON floating-point values are prohibited. |
| Percentage/ratio | decimal string | Unit identifies whether the value is percent or ratio. |
| Unit | non-empty string | A metric and every compared value must state its unit. Canonical unit vocabulary remains an open parameter. |
| Free text | string | May explain a source or rule, but cannot substitute for a required structured fact or calculated metric. |

All fields are required unless marked optional or nullable. `null` means a field is intentionally unavailable; it never means a defaulted value.

All values belong to exactly one category:

| Category | Meaning | Rule |
|---|---|---|
| External fact | Retrieved economic information | Must carry provenance and verification status. |
| Business fact | Information supplied by the business | Must carry business-data confirmation status. |
| Assumption | A hypothetical scenario input | Must be explicit and separately confirmed where required. |
| Calculation | Deterministic engine output | Must reference its input and assumption IDs; it is not an observed fact. |
| Decision | Owner-selected response | Must be recorded only after owner confirmation. |

Records MUST NOT silently substitute, infer, or default a required value. Missing or unverifiable required input produces a `clarification_required` or `blocked` state with the missing fields named.

## 3.2 Status Values

`verification_status`: `pending`, `verified`, `unverifiable`, `rejected`.

`business_confirmation_status`: `pending`, `confirmed`, `clarification_required`.

`intake_status`: `draft`, `clarification_required`, `confirmed`, `rejected`.

`assumption_confirmation_status`: `draft`, `confirmed`, `rejected`.

`decision_status`: `not_selected`, `selected`, `confirmed`, `withdrawn`.

`processing_status`: `ready`, `blocked`, `completed`, `failed`.

`risk_status`: `not_assessed`, `calculated`, `blocked`.

`monitoring_status`: `ON_TRACK`, `VARIANCE_DETECTED`, `REASSESSMENT_REQUIRED`.

Verification, intake/business confirmation, scenario-assumption confirmation, and owner-decision confirmation are independent. For example, a verified external shock does not confirm business data, scenario assumptions, or an owner decision.

---

# 4. Common Structures

## 4.1 Provenance

`ProvenanceRecord` contains `source_name`, `source_url_or_reference`, `retrieved_at`, `published_at` when available, `source_excerpt_or_locator`, and `verification_status`. It MAY contain an approval-list reference once the team defines that list. A provenance record is required for every external fact.

## 4.2 Blocked or Clarification State

`Blocker` contains `code`, `stage`, `message`, `required_fields`, and `related_record_ids`. A blocked result contains one or more blockers and no fabricated substitute output.

## 4.3 Calculation Trace

Every `ImpactResult` and `ScenarioResult` contains a `calculation_trace` with `engine_version`, `formula_or_method_reference`, `input_record_ids`, `assumption_ids`, `calculated_at`, and `deterministic=true`. This trace makes projections reproducible and distinct from observed values.

## 4.4 BusinessIntakeDraft

`BusinessIntakeDraft` is the only record for unconfirmed business input. Required: `id`, `business_id`, `submitted_fields`, `intake_status`, `created_at`, `updated_at`, and `workflow_stage=TRACE`. `submitted_fields` contains supplied values and their field names; it does not become part of `BusinessProfile` while `intake_status` is `draft`, `clarification_required`, or `rejected`.

On explicit user verification, confirmed fields are copied into `BusinessProfile` with `source_intake_draft_id`. A rejected or unconfirmed draft MUST NOT be used in calculations.

## 4.5 Impact Graph Structures

`ImpactGraphNode` contains required `id` (UUID), `node_type`, `label`, and `sequence`. `node_type` is one of `economic_shock`, `business_dependency`, `operational_effect`, or `financial_effect`.

`ImpactGraphEdge` contains required `id` (UUID), `from_node_id`, `to_node_id`, and `sequence`. Edge endpoints MUST reference nodes in the same mapping, and the graph MUST contain the ordered path `economic_shock → business_dependency → operational_effect → financial_effect`. The exact controlled vocabulary for labels remains open; labels cannot assert an undeclared business dependency.

---

# 5. Stage Contracts

## 5.1 DETECT — EconomicShockEvent

Required: `id`, `shock_type`, `economic_variable`, `direction_or_change`, `observed_or_effective_date`, `provenance`, `verification_status`, `processing_status`, `created_at`, and `updated_at`. `business_id` is prohibited.

Optional only when supplied by a source: `magnitude`, `unit`, `period`, and `source_notes`.

Validation: the event MUST have at least one provenance record; `verified` requires an approved-source verification outcome. Pending or unverifiable shocks MAY proceed through TRACE only; QUANTIFY and every deterministic financial calculation require `verification_status=verified`. The shock representation must retain the source value rather than replace it with an AI estimate.

## 5.2 TRACE — BusinessProfile, BusinessDependency, ImpactMapping

`BusinessProfile` contains only business-provided, confirmed structured data required for analysis. Required: `id`, `business_id`, `confirmed_fields`, `source_intake_draft_ids`, `business_confirmation_status=confirmed`, `created_at`, `updated_at`, and `workflow_stage=TRACE`. `BusinessDependency` identifies a business input, cost, supplier exposure, operating dependency, or other declared dependency and references its supporting confirmed business-data fields.

`ImpactMapping` contains required `id`, `business_id`, `shock_event_id`, `business_profile_id`, `dependency_id`, `nodes`, `edges`, `operational_effect`, `financial_effect`, `mapping_rationale`, `processing_status`, `created_at`, and `updated_at`. `nodes` is a non-empty list of `ImpactGraphNode`; `edges` is a non-empty list of `ImpactGraphEdge`.

Validation: each graph edge MUST connect the shock to a declared business dependency and an operational/financial effect. A mapping MUST NOT assert an undeclared dependency. Missing required business fields produce `clarification_required` or `blocked`.

## 5.3 QUANTIFY — ImpactResult

Required: `id`, `business_id`, `shock_event_id`, `impact_mapping_id`, `business_input_ids`, `assumption_ids`, `metrics`, `calculation_trace`, `processing_status`, `created_at`, and `updated_at`.

`metrics` may contain only outputs supported by agreed deterministic formulas, such as input-cost impact, COGS, gross margin, profit impact, or cash requirement. Each metric includes value, unit, and calculation basis.

Validation: QUANTIFY requires verified external facts, confirmed required business facts, a completed mapping, and explicit assumptions. No LLM may generate metric values.

## 5.4 SIMULATE — ScenarioDefinition and ScenarioResult

`ScenarioDefinition` contains required `id`, `business_id`, `base_impact_result_id`, `name`, `changed_assumptions`, `assumption_confirmation_status`, `processing_status`, `created_at`, and `updated_at`. Each changed assumption contains a field reference, supplied decimal/string value, unit where applicable, and no calculated metric.

`ScenarioResult` contains required `id`, `business_id`, `scenario_id`, `projected_metrics`, `calculation_trace`, `processing_status`, `created_at`, and `updated_at`.

Validation: a scenario changes only explicitly listed assumptions; it retains its base result reference. Users may create and modify a `draft` scenario freely. The owner must explicitly move it to `confirmed` before execution; a confirmed scenario may run without confirming each individual edit. Any edit after confirmation returns it to `draft`. A result is always labelled projected, not actual.

## 5.5 COMPARE — ComparisonSet

Required: `id`, `business_id`, `base_impact_result_id`, `scenario_result_ids`, `comparison_metrics`, `risk_indicators`, `trade_off_explanations`, `processing_status`, `created_at`, and `updated_at`.

Each `RiskIndicator` contains `scenario_result_id`, `risk_status`, `factor_references`, `rule_version`, and nullable `risk_level`. Factors are limited to cost exposure, cash requirement, margin deterioration, and dependency exposure. `risk_level` is populated only when the agreed deterministic rule and thresholds support it; an LLM may not assign it.

Each `TradeOffExplanation` contains `scenario_result_id`, `rule_reference`, `supporting_metric_references`, and `text`. It MUST derive only from verified/calculated outputs and defined rules; it MUST NOT introduce financial claims or figures.

Validation: every compared result MUST share a compatible base context and metric units. Comparison presents outcomes; it MUST NOT label one response universally best or create a decision.

## 5.6 RESPOND — HumanDecision

Required: `id`, `comparison_set_id`, `selected_scenario_id` or `owner_defined_response`, `decision_status`, `decided_at` when confirmed, and `owner_confirmation_reference`.

Validation: only the business owner may move a decision to `confirmed`. AI output, a comparison result, or a UI default is not a decision.

## 5.7 MONITOR — MonitoringRecord and ProjectionComparison

`MonitoringRecord` contains required `id`, `business_id`, `human_decision_id`, `metric_name`, `actual_value`, `unit`, `observed_at`, `provenance_or_business_input_reference`, applicable confirmation/verification status, `created_at`, and `updated_at`.

`ProjectionComparison` contains required `id`, `business_id`, `monitoring_record_ids`, `projected_metric_reference`, `actual_metric_reference`, `variance`, `variance_unit`, `monitoring_status`, `rule_version`, `created_at`, and `updated_at`. `monitoring_status` is exactly `ON_TRACK`, `VARIANCE_DETECTED`, or `REASSESSMENT_REQUIRED`.

Validation: actuals remain separate from projections. Monitoring logic belongs to Member 3; presentation consumes these records without inventing values.

---

# 6. Handoffs and Ownership

Member 2 produces global `EconomicShockEvent` records with explicit verification status for DETECT. Member 3 owns `ImpactMapping`, deterministic `ImpactResult`, scenario execution, numerical/rule-based comparison output and risk logic, and monitoring logic. Member 4 owns frontend presentation and integrated testing, consuming contract outputs without recalculating or inventing them. Member 1 owns contract governance, shared state orchestration, intake/validation gates, human approval handling, integration, and fallback/error coordination.

---

# 7. Open MVP Decisions Requiring Team Agreement

| Decision | Options / trade-off |
|---|---|
| Approved-source policy | A fixed allowlist is auditable but narrower; a reviewable policy is more flexible but needs a verifier. |
| Required business fields by analysis | A minimal per-shock set speeds intake; a common full profile improves consistency but asks more of owners. |
| Dependency/graph vocabulary | A controlled taxonomy improves comparability; extensible labels support more businesses but require validation rules. |
| Deterministic formula catalogue | The supported shock/dependency calculations and required inputs must be agreed before Member 3 implements them. |
| Risk thresholds/formulas | Risk factors are fixed for MVP, but their rule formula and any level thresholds must be agreed rather than invented. |
| Monitoring variance/reassessment rules | The status values are fixed, but measurement cadence and rule thresholds must be agreed rather than invented. |
| Record versioning and retention | Immutable versions improve auditability; overwrite simplifies MVP storage but weakens reproducibility. |

No option in this table is selected by this contract.
