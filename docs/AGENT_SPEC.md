# TADBIR — Agent Specification

**Product:** TADBIR — تدبیر  
**Purpose:** AI-powered economic shock analysis and business decision-support system  
**Document:** Agent Specification  
**Status:** Authoritative implementation specification  
**Version:** 1.0

---

# 1. Purpose

This document defines the AI agents used within TADBIR.

It specifies:

- why each agent exists
- what each agent is responsible for
- what information it may receive
- what information it must produce
- which tools it may use
- what it must not do
- where deterministic code is required
- where human approval is required
- how agents interact with the rest of the system

The purpose is to prevent AI agents from overlapping responsibilities, inventing information, performing unauthorized calculations, or making decisions outside their assigned role.

---

# 2. Core Agent Principle

TADBIR follows this principle:

> **AI interprets and coordinates. Deterministic code calculates. The human decides.**

Therefore:

```text
AI Agent
    ↓
Interpret / Retrieve / Map / Explain
    ↓
Structured Data
    ↓
Deterministic Engine
    ↓
Calculated Result
    ↓
Human Review
    ↓
Human Decision
```

---

# 3. Non-Negotiable Operating Rules

1. Agents preserve the exact workflow: `DETECT → TRACE → QUANTIFY → SIMULATE → COMPARE → RESPOND → MONITOR`.
2. Agents may interpret, retrieve, map, explain, and coordinate only within their assigned responsibility.
3. Financial metric values and rule-based comparison, risk, variance, and reassessment outputs are produced only by Member 3's deterministic logic, never by an LLM.
4. Missing, unclear, or unverifiable required data produces a structured blocker or clarification request. No agent may silently default or invent it.
5. Source verification, business-data confirmation, scenario-assumption confirmation, and owner decision confirmation are separate states.
6. No agent selects, confirms, or implies a final business response on behalf of the owner.

---

# 4. Agents, Responsibilities, and Handoffs

## 4.1 Economic Monitor Agent — DETECT

**Owner:** Member 2.

**Inputs:** approved-source retrieval results and the agreed source-verification policy.

**Outputs:** `EconomicShockEvent` candidates with provenance, source values, retrieval time, and verification status.

**Must not:** create economic facts without a source, mark an unapproved/unverifiable fact as verified, calculate business financial impact, or select a response.

**Handoff:** sends global shocks with an explicit verification status, or verification blockers, to Member 1 orchestration. Pending/unverifiable shocks may be traced but may not enter QUANTIFY.

## 4.2 Relevance Agent — DETECT-to-TRACE Handoff

**Owner:** Member 2.

**Inputs:** shock with an explicit verification status and confirmed available business dependency data.

**Outputs:** structured relevance rationale and referenced dependency candidates; it does not create dependencies.

**Must not:** claim relevance when the required business data is absent, modify financial values, or bypass business confirmation.

**Handoff:** sends candidates/blockers through Member 1 to Member 3's impact-mapping logic.

## 4.3 Impact Mapping Logic — TRACE

**Owner:** Member 3.

**Inputs:** global `EconomicShockEvent` with an explicit verification status, confirmed business facts/dependencies, and relevance output where available.

**Outputs:** `ImpactMapping` with the ordered shock → dependency → operational effect → financial effect path.

**Must not:** add undeclared dependencies, invent missing inputs, or calculate a financial result outside deterministic logic.

**Handoff:** returns mapping or a structured clarification/blocker to Member 1 orchestration.

## 4.4 Deterministic Impact Engine — QUANTIFY

**Owner:** Member 3.

**Inputs:** completed mapping, verified external inputs, confirmed required business data, and explicit assumptions.

**Outputs:** reproducible `ImpactResult` and calculation trace.

**Must not:** use LLM-generated numbers, fill gaps with defaults, present a calculation as an observed fact, or make a decision.

**Handoff:** returns result/blocker to Member 1; Member 4 consumes completed results for presentation.

## 4.5 Scenario Logic — SIMULATE

**Owner:** Member 3.

**Inputs:** base impact result and explicit changed assumptions, including the appropriate assumption-confirmation state.

**Outputs:** `ScenarioDefinition` and deterministic, projected `ScenarioResult`.

**Must not:** alter baseline business facts, hide assumptions, or call a projection actual.

**Handoff:** returns scenario result/blocker for comparison.

## 4.6 Comparison and Risk Logic — COMPARE

**Owner:** Member 3.

**Inputs:** compatible completed scenario results and their deterministic traces.

**Outputs:** numerical/rule-based `ComparisonSet`, including calculated comparison metrics, `RiskIndicator` records, and rule-grounded trade-off explanations.

**Must not:** use an LLM to calculate risk or financial values, create a risk level without an agreed rule/threshold, or declare a universally superior response.

**Handoff:** returns completed comparison output to Member 1 orchestration and Member 4 presentation.

## 4.7 Decision Brief / Comparison Presentation — COMPARE and RESPOND

**Owner:** Member 4 for frontend presentation and integrated testing. Member 1 provides orchestration/API contracts.

**Inputs:** completed comparison and scenario results, statuses, provenance, assumptions, and blockers.

**Outputs:** a transparent user presentation and an owner-submitted response selection for the backend to record.

**Must not:** recalculate outputs, hide material blockers/assumptions, declare a universally best response, or confirm a decision without the owner.

**Handoff:** sends owner selection/confirmation to Member 1's approval layer.

## 4.8 Monitoring Logic — MONITOR

**Owner:** Member 3.

**Inputs:** confirmed human decision, actual records, projected metric references, and verified/confirmed source or business-input references.

**Outputs:** `MonitoringRecord`, `ProjectionComparison`, and one MVP monitoring status: `ON_TRACK`, `VARIANCE_DETECTED`, or `REASSESSMENT_REQUIRED`. Status assignment is deterministic and uses agreed variance/reassessment rules.

**Must not:** treat actuals as projections, invent actual data, modify a decision, or choose a revised response.

**Handoff:** Member 1 orchestrates status/error handling; Member 4 presents monitoring results and integrated tests the flow.

## 4.9 Orchestration and Approval Layer

**Owner:** Member 1.

**Inputs:** contract-valid records and handoffs from Members 2–4.

**Outputs:** validated shared state, stage transitions, API responses, approval/clarification gates, and explicit integration failures.

**Must not:** take ownership of Member 2 retrieval, Member 3 mapping/calculation/scenario/monitoring logic, or Member 4 presentation/integrated testing; it also must not override a blocker or owner decision.

---

# 5. Stage Gate Matrix

| Transition | Required condition | If unmet |
|---|---|---|
| DETECT → TRACE | Shock has provenance and an explicit verification status; it may be pending or unverifiable | Block only if the shock/provenance is missing or invalid. |
| TRACE → QUANTIFY | Shock is verified, required business data is confirmed, and mapping is complete | `VERIFICATION_REQUIRED`, `CLARIFICATION_REQUIRED`, or blocker. |
| QUANTIFY → SIMULATE | Deterministic baseline result is complete | Blocked; no scenario output. |
| SIMULATE → execution | Scenario is explicitly owner-confirmed | `APPROVAL_REQUIRED`; no scenario result. |
| SIMULATE → COMPARE | Compared scenarios are completed and compatible | Blocked; no comparison set. |
| COMPARE → RESPOND | Results, assumptions, and trade-offs are available to the owner | Decision remains `not_selected`. |
| RESPOND → MONITOR | Owner explicitly confirms a response | `APPROVAL_REQUIRED`; monitoring is not tied to an unconfirmed decision. |
| MONITOR → reassessment | Actual/projected inputs and agreed trigger criteria are available | Return pending/blocker; do not infer a trigger. |

---

# 6. Failure Handling

Every agent/logic component returns a contract-valid success result or a structured failure with stage, code, explanation, required fields or unavailable dependency, and related record IDs. Member 1 exposes this state through the API. Members 3 and 4 must preserve it through their engine outputs and presentation respectively.

Suggested common codes are defined in `API_CONTRACT.md`; implementation must not add incompatible codes without team agreement.

---

# 7. Open MVP Decisions Requiring Team Agreement

- The exact boundary between relevance interpretation and deterministic impact mapping when a dependency is ambiguous.
- The approved-source verification policy and whether human review is required for some source classes.
- The business-data confirmation interaction and what evidence constitutes confirmation.
- The deterministic formula catalogue and required input set for each supported shock/dependency relation.
- Deterministic risk formulas/thresholds and monitoring variance/reassessment parameters.
- The exact user-facing explanation content Member 4 may derive from results without changing their meaning.

No open decision above is silently resolved by this specification.
