# FLUXSCOPE Project Context

**Document type:** Read-only inspection record (project artifact)
**Prepared:** 2026-10-04, from repository commit `3e59dbc`
**Scope:** Describes what the repository *currently contains*. It does not change, extend, or reinterpret the product definition. Where the repository is unclear or self-contradictory, this document says so rather than resolving it.

Labels used throughout:

- **Implemented**: code exists and is exercised by the API path.
- **Partially implemented**: some of the contract/doc behaviour exists.
- **Backend implemented / frontend incomplete**
- **Frontend prototype only**: UI exists with no backend wiring.
- **Contract exists / execution incomplete**
- **Not implemented**
- **Unknown / Not established by repository / Requires clarification**
- **Documentation/code mismatch**

> **Update (end-to-end demo implementation):** this document describes the
> inspected baseline `3e59dbc`. The following findings have since been
> addressed in code:
> - the frontend workflow is wired to the backend for all seven stages;
> - `/shocks` no longer accepts a caller-claimed `verified` status;
> - DETECT candidates can be registered through `POST /shocks/from-detection/{id}`;
> - QUANTIFY requires an existing matching TRACE mapping and an `exchange_rate` shock;
> - `exchange_rate_change` is no longer a required business fact;
> - unsupported scenario fields are rejected;
> - `POST /comparisons` returns and stores its result, and `GET /comparisons/{id}` exists;
> - DETECT evidence is limited to the submitted source, and magnitudes are checked against the quote.
>
> The remaining limitations listed below otherwise still apply. See `docs/DEMO_RUN.md`.

---

## 1. Repository Identity

| Item | Value |
|---|---|
| Local path | `D:\FLUXSCOPE\Flux` |
| Repository root | `D:/FLUXSCOPE/Flux` (confirmed with `git rev-parse --show-toplevel`) |
| Is a Git repository | Yes |
| Branch | `main`, tracking `origin/main`, with no ahead/behind shown at inspection time |
| Remote | `origin` (only remote) |
| Fetch URL | `https://maryamiqbal3766-eng:<REDACTED>@github.com/maryamiqbal3766-eng/Flux.git` |
| Push URL | Same as the fetch URL (`<REDACTED>` credential) |
| Remote repository | `maryamiqbal3766-eng/Flux` (matches the expected repository) |
| Current commit | `3e59dbc` "Initial FLUXSCOPE demo baseline" (the only commit) |
| Commit author (repository metadata) | `Maryam` |
| Working tree | Clean (no modified, staged, or untracked files before this document was created) |
| Tracked files | 59 |
| Local Git config | No `user.name` / `user.email` is set in the repository's local config |

### Important Git observations

- The repository has a single commit. No history of prior TADBIR development is preserved in Git.
- The local config has no commit identity. Any future commit made from this workspace would use an identity configured *outside* the repository. That configuration was not inspected and is not repository metadata. The Git author identity is separate from the GitHub authentication identity in the remote URL.
- Push permission was **not verified**. Doing so would require a network/authentication operation that has not been authorized.

### Security observations (no credential values are reproduced here)

- **The remote URL embeds a GitHub personal access token** in `.git/config`. Anyone or any tool that can run `git remote -v` or read `.git/config` in this working copy can see it. The repository owner should revoke/rotate it and replace the remote with a credential-free URL. That action is out of scope for this inspection and was not performed.
- `.gitignore` excludes `.env` and `.env.*` but keeps `.env.example`. `.env.example` contains only empty `GROQ_API_KEY=` and `GROQ_MODEL=` keys.
- No API keys or secrets were found in tracked source files.

---

## 2. Product Identity

### Current product name
**FLUXSCOPE** is used in user-facing frontend text (`frontend/fluxscope_frontend/app/layout.tsx`, `app/page.tsx`), in the frontend folder name, in the master-document *file name* (`docs/FLUXSCOPE_MASTER.md`), in the LLM system prompt (`app/services/economic_intelligence/extractor.py:22,33`), in the Word document file name (`FLUXSCOPE.docx`) and in the commit message.

### Historical name: TADBIR (تدبیر)
TADBIR remains in most technical and documentation artifacts:

| Location | TADBIR usage |
|---|---|
| `AGENTS.md` | Title, project name; references `docs/TADBIR_MASTER.md` |
| `docs/FLUXSCOPE_MASTER.md` | File is named FLUXSCOPE, but **all content is titled/written as "TADBIR — Master Product Definition"** |
| `docs/PRD.md` | "TADBIR — Product Requirements Document"; says `docs/TADBIR_MASTER.md` is authoritative |
| `docs/API_CONTRACT.md`, `docs/DATA_CONTRACT.md`, `docs/AGENT_SPEC.md` | All titled "TADBIR — …" |
| `FLUXSCOPE.docx` | File named FLUXSCOPE; content titled "TADBIR — Core Product Workflow" |
| `pyproject.toml` | `name = "tadbir-backend"`, description "TADBIR Member 1 FastAPI foundation" |
| `app/core/config.py:9` | `app_name = "TADBIR API"` (the FastAPI title) |
| `app/__init__.py`, `app/models/__init__.py`, `app/main.py:21`, `app/services/member3_integration.py:60` | Docstrings |
| `app/services/economic_intelligence/__init__.py`, `source_registry.py:15`, `monitor.py:39` | Docstrings and the runtime error message "Source is not approved for TADBIR DETECT." |
| `frontend/fluxscope_frontend/package.json`, `package-lock.json` | `"name": "tadbir-frontend"` |
| `frontend/fluxscope_frontend/README.md` | "TADBIR Frontend"; refers to `D:\Maryamm\TADBIR\frontend\TADBIR_frontend` and a "TADBIR / تدبیر" mark |

### Naming contradictions (reported, not resolved)
1. `AGENTS.md` and `docs/PRD.md` §11 name `docs/TADBIR_MASTER.md` as the authoritative workflow document. **That file does not exist.** `docs/FLUXSCOPE_MASTER.md` exists, and its content is the TADBIR master definition.
2. The LLM prompt says "FLUXSCOPE", but the error raised in the same DETECT subsystem says "TADBIR DETECT".
3. The frontend README describes a TADBIR mark and a `TADBIR_frontend` folder. The actual folder is `fluxscope_frontend` and the UI renders a FLUXSCOPE mark.

### Authoritative documentation identified
- `docs/API_CONTRACT.md`, `docs/DATA_CONTRACT.md` and `docs/AGENT_SPEC.md` each declare themselves "Authoritative implementation contract/specification", Version 1.0.
- `docs/PRD.md` (Version 1.0, "MVP / Hackathon") delegates workflow authority to the (missing) `docs/TADBIR_MASTER.md`.
- `docs/FLUXSCOPE_MASTER.md` appears to be that master document under a new file name. **The repository does not state this explicitly. Requires clarification.**
- `AGENTS.md` is **truncated**. It ends at line 46 inside an unclosed code block listing required documents. Any further rules it may have contained are not present.

---

## 3. Product Purpose (as stated by the repository)

From `docs/FLUXSCOPE_MASTER.md` and `docs/PRD.md`, the product helps a business understand how an external economic shock will affect its own operations and finances, then lets the owner test possible responses before deciding.

PRD §28 one-sentence definition: it "turns economic shocks into business-specific impact analysis and response simulations — so businesses can understand what changed, what it means for them, and what happens before they act."

Core principles stated across the docs:

- "AI informs. Human decides." The business owner is the final decision-maker (`FLUXSCOPE_MASTER.md`, PRD FR-08, §18).
- "AI interprets and coordinates. Deterministic code calculates. The human decides." (`AGENT_SPEC.md` §2)
- LLMs must not generate financial numbers (PRD FR-05).
- Missing business information must not be invented (PRD §16).

Target user (PRD §8): small and medium-sized business owners/managers with economic exposure. Frontend copy says "Pakistani SMEs". Approved sources are Pakistani institutions (SBP, PBS, Government of Pakistan).

MVP priority (PRD §20): (1) Business Impact Graph, (2) Impact Calculator, (3) What-If Scenario Simulator.

Non-goals (PRD §19): not a news site, generic chatbot, AI economist, AI CFO, autonomous decision-maker, accounting system/ERP, financial-advice replacement, or economic predictor.

---

## 4. Workflow Overview

The canonical workflow is consistent across every document:

```text
DETECT → TRACE → QUANTIFY → SIMULATE → COMPARE → RESPOND → MONITOR
```

The documented data flow (`DATA_CONTRACT.md` §2):

```text
Approved Economic Sources → DETECT → EconomicShockEvent
→ TRACE → BusinessDependency / ImpactMapping
→ QUANTIFY → deterministic ImpactResult
→ SIMULATE → ScenarioResults
→ COMPARE → comparable response options
→ RESPOND → HumanDecision
→ MONITOR → actual vs projected results
```

Stage gates (`AGENT_SPEC.md` §5):

| Transition | Required condition | If unmet |
|---|---|---|
| DETECT → TRACE | Shock has provenance and an explicit verification status (it may be pending or unverifiable) | Block only if the shock/provenance is missing or invalid |
| TRACE → QUANTIFY | Shock **verified**, required business data **confirmed**, mapping **complete** | `VERIFICATION_REQUIRED`, `CLARIFICATION_REQUIRED`, or blocker |
| QUANTIFY → SIMULATE | Deterministic baseline result complete | Blocked |
| SIMULATE → execution | Scenario explicitly owner-confirmed | `APPROVAL_REQUIRED` |
| SIMULATE → COMPARE | Compared scenarios completed and compatible | Blocked |
| COMPARE → RESPOND | Results, assumptions and trade-offs available to the owner | Decision remains `not_selected` |
| RESPOND → MONITOR | Owner explicitly confirms a response | `APPROVAL_REQUIRED` |
| MONITOR → reassessment | Actual/projected inputs and agreed trigger criteria available | Pending/blocker; do not infer a trigger |

Team ownership (PRD §24): Member 1 owns architecture, FastAPI, contracts, orchestration and approvals. Member 2 owns DETECT (economic intelligence and RAG). Member 3 owns TRACE, QUANTIFY, SIMULATE and the monitoring calculations. Member 4 owns COMPARE and RESPOND presentation, monitoring UI and integrated testing. The code uses the same "Member N" naming (`member3_integration.py`, `test_member2_*`, `test_member3_*`).

**Implementation reality, in short:** the backend exposes endpoints for every stage, and most stages run end-to-end through the API, with exceptions noted below. **No stage after DETECT is connected to the frontend, and the frontend DETECT call does not display its result.** There is **no automated hand-off** from DETECT output (`ShockCandidate`) to the TRACE input (`EconomicShockEvent`).

---

## 5. Stage-by-Stage Specification

### DETECT

- **Purpose (docs):** Identify a meaningful economic change from approved sources and convert it into a structured Economic Shock Event (exchange rate, fuel, energy, interest rate, inflation/input cost, trade policy, tax/duty).
- **Inputs, as implemented:**
  - `POST /api/v1/detect` takes a `SourceDocument` that the caller supplies: `title`, `publisher`, `content` (the full text), optional `source_url`, `source_domain`, `published_at`, `metadata`. **The system does not fetch content from the URL.** The caller provides both the text and the claimed publisher/URL.
  - `POST /api/v1/shocks` takes an `EconomicShockCreate` that the caller supplies: `shock_type`, `economic_variable`, `direction_or_change`, `observed_or_effective_date`, `provenance[]` (≥1), `verification_status` (default `pending`), optional `magnitude` (decimal string), `unit`, `period`, `source_notes`. `business_id` is rejected (`extra="forbid"`).
- **Processing (`/detect`)** in `app/services/economic_intelligence/monitor.py`:
  1. Approved-source check on the declared `publisher` and `source_url` (`ApprovedSourceRegistry.is_approved`). A failure raises `ValueError`.
  2. The document is chunked (`EconomicChunker`, 1400 characters with 180 overlap) and added to an in-process keyword retriever (`LocalEconomicRetriever`; term overlap, no embeddings).
  3. The top 5 chunks for a fixed query are each sent to the Groq LLM through `EconomicShockExtractor` with a strict no-invention system prompt. The LLM returns JSON candidates.
  4. Each candidate is checked by `EconomicEvidenceVerifier`: approved source, non-empty quote, variable tokens present in the quote, and reported value present in the quote *if `value_text` is set*. The status becomes `VERIFIED` or `REJECTED`.
  5. Candidates are de-duplicated and stored in memory (`EconomicIntelligenceService._events`).
- **Processing (`/shocks`):** The orchestrator stores the event as submitted. The only validation is the model rule that `verification_status=verified` requires at least one provenance item marked `verified`. **The approved-source registry is not consulted.** The caller's own declaration sets the verification status.
- **Outputs:** `/detect` returns `list[ShockCandidate]`. `/shocks` returns `EconomicShockEvent` (201). `GET /shocks/{id}` retrieves it.
- **Verification:** see §8. The DETECT status vocabulary (`PENDING_VERIFICATION`/`VERIFIED`/`REJECTED`) differs from the domain vocabulary (`pending`/`verified`/`unverifiable`/`rejected`).
- **Frontend:** The DETECT panel shows the backend health status and a "View information →" button. That button calls `/detect` with a **hard-coded document** (`app/page.tsx:193-208`). The document claims publisher "State Bank of Pakistan" and URL `https://www.sbp.org.pk/`, and its content is a placeholder sentence ("…Verified source content will be supplied here."). The returned candidates are stored in state (`detectedShocks`) but **never rendered**. Errors go only to `console.error`.
- **Backend status:** Implemented, but needs Groq configuration and has caveats (see Gaps).
- **Gaps:**
  - No conversion from `ShockCandidate` to `EconomicShockEvent`, so detected shocks cannot enter TRACE without a manual `POST /shocks`.
  - `/detect` has no `GET` or list endpoint.
  - The `/detect` error paths (unapproved source, Groq not configured, LLM JSON parse failure, unsupported `shock_type`) raise plain Python exceptions with no contract error handler. They are expected to surface as HTTP 500 rather than as the contract's error envelope. This was established by reading the code, not by running it.
  - The Relevance Agent (AGENT_SPEC §4.2) is not implemented.

### TRACE

- **Purpose (docs):** Map the shock to the business: Economic Shock → Business Dependency → Operational Effect → Financial Effect (the Business Impact Graph). Requires confirmed business data and must not assert undeclared dependencies.
- **Inputs:**
  - `POST /businesses/{business_id}/intake-drafts`: `submitted_fields`, a map of field name → `{value: string, unit?: string}` with at least one entry. The client generates `business_id`; there is no business registry.
  - `POST /businesses/{business_id}/intake-drafts/{draft_id}/confirm`: no body. It confirms **all** submitted fields at once.
  - `POST /impact-mappings`: `{shock_event_id, business_id}`.
- **Processing:**
  - Intake confirmation copies every draft field into a new `BusinessProfile` (`orchestrator.py:52-67`). There is no per-field confirmation, and the backend never produces `clarification_required`.
  - Mapping requires that the shock exists (any verification status is allowed, as the contract permits) and that some confirmed profile exists for the business. If none exists, it returns `422 CLARIFICATION_REQUIRED` with `required_fields: ["BusinessProfile"]`.
  - `Member3Integration.create_mapping` builds a 4-node, 3-edge graph using **deterministic string templates**, not an LLM:
    - Dependency: "Imported input exposure" if `imported_quantity` and `imported_unit_cost` are confirmed. Otherwise "Operating cost exposure" if `operating_expenses` is confirmed. Otherwise "Confirmed business cost exposure".
    - Operational and financial effect text depends only on `direction_or_change` (increase/decrease/other).
- **Output:** `ImpactGraph` (`id`, `shock_event_id`, `business_id`, `nodes[]`, `edges[]`). It is stored in `store.impact_mappings` **keyed by `shock_event_id`**, so a later mapping for the same shock (even for another business) overwrites it.
- **Verification:** Pending or unverifiable shocks are allowed, which matches the contract.
- **Frontend:** Four static nodes labelled "Awaiting verified mapping". There is no intake form and no API call. **Frontend prototype only.**
- **Backend status:** Partially implemented.
- **Gaps / mismatches against DATA_CONTRACT §4.5 and §5.2:**
  - The graph lacks node `sequence`, edge `id`/`sequence`, `business_profile_id`, `dependency_id`, `operational_effect`, `financial_effect`, `mapping_rationale` and `processing_status`.
  - Edges use `source_node_id`/`target_node_id`/`relationship` instead of `from_node_id`/`to_node_id`.
  - No `BusinessDependency` record exists.
  - The template can label a dependency ("Confirmed business cost exposure") even when no cost field is confirmed. Whether this counts as "asserting an undeclared dependency" **requires clarification**.
  - The mapping does not consider `shock_type`.

### QUANTIFY

- **Purpose (docs):** Deterministically calculate the financial impact using verified external data, confirmed business data and explicit assumptions. No LLM numbers.
- **Input:** `POST /impact-results` with `{shock_event_id, impact_mapping_id, business_input_ids[≥1], assumption_ids[]}`. `business_input_ids` must be `BusinessProfile` IDs.
- **Required confirmed business fields** (`member3_integration.py:67-76`), all numeric:
  `sales_quantity`, `selling_price_per_unit`, `imported_quantity`, `imported_unit_cost`, `exchange_rate`, `local_input_cost`, `operating_expenses`, `exchange_rate_change`.
  If any are missing the response is `422 CLARIFICATION_REQUIRED`, listing the missing fields. A non-numeric value returns `422 INVALID_INPUT`.
- **Gates enforced:**
  - The shock must be `verified` (`422 VERIFICATION_REQUIRED`).
  - The profile IDs must exist (`404 BUSINESS_INPUT_NOT_FOUND`).
  - The shock must have a `magnitude` (`422 CLARIFICATION_REQUIRED`, `["magnitude"]`).
  - The shock `unit` must contain "%" or "percent" (`422 CLARIFICATION_REQUIRED`, `["unit"]`).
- **Gates *not* enforced:**
  - **`impact_mapping_id` is not checked.** The tests pass a random UUID and get a 200, so the contract's "mapping is complete" gate for TRACE → QUANTIFY is not enforced.
  - `assumption_ids` is accepted but unused.
  - `shock_type` is not checked (see next point).
- **Processing:** Every verified percent-unit shock is converted to `exchange_rate_change = magnitude / 100`, negated if `direction_or_change == "decrease"`. It then goes to `DeterministicImpactCalculator`. **The calculator only models an exchange-rate shock on imported inputs**, so a verified non-FX shock (for example inflation, percent) would be computed as if it were an exchange-rate change. The confirmed business field `exchange_rate_change` is required but **its value is not used**; the shock magnitude replaces it.
- **Formula catalogue** (`impact_engine/calculator.py:83-107`), using `Decimal` with money/percent rounded `ROUND_HALF_UP` to 0.01:
  - Revenue = sales_quantity × selling_price_per_unit
  - Imported cost = imported_quantity × imported_unit_cost × exchange_rate
  - Shocked exchange rate = exchange_rate × (1 + exchange_rate_change)
  - COGS = imported cost + local_input_cost
  - Gross profit = revenue − COGS; gross margin % = gross profit / revenue × 100
  - Operating profit = gross profit − operating_expenses
  - Cash requirement = COGS + operating_expenses
  - Percentage change = (shocked − baseline) / |baseline| × 100. **A zero denominator returns 0**, which is a documented rule, not an observed value.
  - Validation: inputs must be non-negative, exchange_rate > 0, and exchange_rate_change > −100%. A failure raises `ImpactCalculationError`, which has no contract handler, so it is expected to surface as HTTP 500.
- **Output:** `ImpactResultRecord` (`id`, `business_id`, `shock_event_id`, `impact_mapping_id`, `inputs`, `result`). `result` holds baseline/shocked revenue, imported cost, COGS, gross profit, margin %, operating profit, cash requirement, and their deltas and percentage changes.
- **Contract mismatches (DATA_CONTRACT §3.1, §4.3, §5.3):**
  - No `metrics` list with value/unit/basis.
  - No `calculation_trace` (`engine_version`, `formula_or_method_reference`, `deterministic=true`…).
  - No `processing_status`, `created_at` or `updated_at`.
  - Monetary values serialize as JSON numbers through FastAPI's default Decimal encoding. The contract requires decimal *strings* and prohibits floats.
- **Frontend:** Four metric tiles showing "—" with "Verified inputs required" / "Calculated by engine". No API call. **Frontend prototype only.**
- **Status:** Backend implemented for a single FX/imported-input model, with gaps. Frontend incomplete.

### SIMULATE

- **Purpose (docs):** The owner changes assumptions (price, supplier mix, imported quantity, operating cost, financing, exchange rate) and every scenario is recalculated deterministically. Scenarios must be owner-confirmed before running. Results are always labelled projected.
- **Inputs:**
  - `POST /scenarios`: `{base_impact_result_id, business_id, name, changed_assumptions[{field_reference, value, unit?}]≥1}`. The base result is **not validated at creation**.
  - `PATCH /scenarios/{id}`: `{name?, changed_assumptions?}`. Any edit resets the status to `draft`.
  - `POST /scenarios/{id}/confirm`: draft → confirmed. Otherwise `409 STATE_CONFLICT`.
  - `POST /scenarios/{id}/run`: requires `confirmed` (`422 APPROVAL_REQUIRED`), an existing base impact result with the same business (`409 BUSINESS_MISMATCH`), and a profile.
- **Supported `field_reference` values** (`member3_integration.py:412-453`): `selling_price_per_unit`, `imported_quantity`, `operating_expenses`, `exchange_rate` (all **absolute replacement values**), and `exchange_rate_change_delta` (an additive decimal fraction).
  - **Unknown `field_reference` values are silently ignored.** For example, the test fixture's `"price_change"` would run as an unchanged scenario. `unit` is not checked.
- **Processing:** `DeterministicScenarioEngine` recalculates the baseline and the modified inputs, then rebases the projection against the shocked baseline (`impact_engine/scenarios.py`). Rebased deltas are not re-rounded.
- **Output:** `ScenarioResultRecord` (`id`, `scenario_id`, `business_id`, `base_impact_result_id`, `result{name, baseline, projected}`). The scenario is marked `processing_status=completed`.
- **Contract mismatches:** no `projected_metrics`, `calculation_trace` or explicit "projected" label field. Responses are not in the `{data, meta}` envelope.
- **Frontend:** Two range sliders ("Change selling price" −10…+15%, default **+4**, and "Imported material cost" −30…+10%, default **−15**). The defaults mirror the PRD's illustrative examples. A "Save draft" button only flips local state; it sends nothing and stores nothing. The UI says these controls "preview the experience". The slider semantics (**percent changes**, and imported material *cost*) **do not match** the backend fields (**absolute values**, and imported *quantity*). **Frontend prototype only.**
- **Status:** Backend implemented. Frontend incomplete.

### COMPARE

- **Purpose (docs):** Show scenarios side by side (cost impact, margin, cash requirement, risk, trade-offs) without declaring a winner. Risk levels only come from agreed deterministic rules.
- **Input:** `POST /comparisons` with `{business_id, base_impact_result_id, scenario_result_ids[≥1]}`.
- **Processing:** The orchestrator checks that the base result exists and belongs to the business, and that each scenario result exists, belongs to the business and shares the same base (`409 BUSINESS_MISMATCH` / `BASE_IMPACT_MISMATCH`). `DeterministicScenarioComparator` then produces, per scenario: `name`, `cost_impact` (COGS delta), `margin`, `cash_requirement`, `profit_impact`, and rule-based `trade_offs` tags (profit, cash and margin direction). It never picks a winner.
- **Output (actual):** **The route discards the result.** `routes.py:114-116` calls `service.request_comparison(payload)` without returning it and is annotated `-> None`, so the endpoint is expected to return `null`. Nothing is persisted, and no `ComparisonSet` ID is created.
- **Contract mismatches:** no `ComparisonSet` record, no `RiskIndicator` (risk is not implemented; the thresholds are an open decision in the docs), no `TradeOffExplanation` with rule references, no `comparison_metrics`. `GET /comparisons/{id}` (in API_CONTRACT) **does not exist**.
- **Frontend:** Three hard-coded rows ("Adjust price", "Reduce imported input", "Absorb cost") showing "Awaiting calculation". No API call. **Frontend prototype only.**
- **Status:** Contract exists / execution incomplete. The comparator logic exists, but the API does not deliver its output.

### RESPOND

- **Purpose (docs):** The owner chooses, modifies or defines a response. Only explicit owner confirmation records a decision. AI output is never a decision.
- **Inputs:**
  - `POST /decisions`: `{business_id, comparison_set_id, selected_scenario_id XOR owner_defined_response}`.
  - `POST /decisions/{id}/confirm`: `{owner_confirmation_reference}`.
- **Processing:** A decision is created as `selected` (the contract also lists `not_selected`). Confirmation moves `selected` → `confirmed` and sets `decided_at`; any other starting state returns `409 STATE_CONFLICT`. **`comparison_set_id` is not validated**, and cannot be, because comparisons are not persisted. `selected_scenario_id` is not validated at creation. `withdrawn` has no transition. There is no `GET /decisions/{id}`.
- **Output:** `HumanDecision`.
- **Frontend:** "No response recorded" card. Its "Review options →" button **calls `handleDetect`** (`page.tsx:908`), the DETECT request, not a RESPOND action. No decision UI exists. **Frontend prototype only.**
- **Status:** Backend implemented (record/confirm). Frontend incomplete. The decision Brief Agent (AGENT_SPEC §4.7) is not implemented.

### MONITOR

- **Purpose (docs):** Compare actual outcomes with projections after a confirmed decision, assign `ON_TRACK` / `VARIANCE_DETECTED` / `REASSESSMENT_REQUIRED` using agreed deterministic rules, and flag when assumptions change.
- **Inputs:**
  - `POST /monitoring-records`: `{business_id, human_decision_id, metric_name, actual_value (decimal string), unit, observed_at, provenance_or_business_input_reference}`.
  - `POST /projection-comparisons`: `{business_id, human_decision_id, monitoring_record_ids[≥1]}`.
- **Processing (`/monitoring-records`):**
  - Requires a confirmed decision (`422 APPROVAL_REQUIRED`) for the same business (`409`).
  - The decision must reference a `selected_scenario_id`. An owner-defined response gets `422 CLARIFICATION_REQUIRED`.
  - The selected scenario must have a stored result (`404`).
  - `metric_name` must be one of `revenue`, `COGS`, `gross_profit`, `gross_margin_pct`, `operating_profit`, `cash_requirement` (note the mixed case). Otherwise the response is `422 CLARIFICATION_REQUIRED` listing them.
  - The actual value is compared with the scenario's projected "shocked_*" value by `DeterministicMonitoringEngine`.
- **Tolerance rule:** `member3_integration.py:455-470` uses **a temporary MVP default of 5% of |projected|** (0.01 if projected is 0). Status rules: |variance| ≤ tolerance → ON_TRACK; ≤ 2× tolerance → VARIANCE_DETECTED; otherwise REASSESSMENT_REQUIRED. The code itself labels these "transparent MVP rules", to be replaced by an approved rule. DATA_CONTRACT §7 lists the monitoring thresholds as an **open, unselected** team decision. **Documentation/code mismatch; requires clarification.**
- **Output:** `MonitoringResult` (`metric_name`, `projected_value`, `actual_value`, `variance`, `variance_pct`, `status`). **It is not persisted and has no ID**, so it cannot be referenced later.
- **`/projection-comparisons`:** After checking the decision, it **always returns `424 UPSTREAM_UNAVAILABLE`** ("Projection comparison logic is not connected"). `Member3Integration.compare_projection` exists but is not wired in.
- **Contract mismatches:** no persisted `MonitoringRecord` or `ProjectionComparison`, no `rule_version`. Monitoring compares against the scenario projection only; there is no tracking of external-variable change or reassessment triggers.
- **Frontend:** A static card showing "NOT_STARTED", "Awaiting data", "—", and **"Reassessment: Not required"**. The last is a hard-coded status claim; no calculation produced it. **Frontend prototype only.**
- **Status:** Partially implemented (backend single-metric evaluation). Projection comparison is not implemented. Frontend incomplete.

---

## 6. User Inputs

Information the system expects from the user or business owner, as implemented:

| Stage | Input | Where | Notes |
|---|---|---|---|
| DETECT | Source document: title, publisher, full text content, URL/domain | `POST /detect` body | The caller supplies the text. The system does not retrieve it. |
| DETECT | Shock event fields and provenance | `POST /shocks` body | The caller supplies these, including `verification_status` |
| TRACE | Business ID | URL path | Generated by the client; no registry |
| TRACE | Business facts: any `field → {value, unit}` | Intake draft | Values are strings. Numbers are only parsed at QUANTIFY. |
| TRACE | Confirmation of the whole draft | Confirm endpoint | No per-field confirmation and no evidence of confirmation |
| QUANTIFY | The 8 required business fields listed in §5 | Confirmed profile | Includes `exchange_rate_change`, which is required but unused |
| QUANTIFY | Selection of shock, mapping and profile IDs | `POST /impact-results` | |
| SIMULATE | Scenario name and changed assumptions (5 supported fields) | `POST`/`PATCH /scenarios` | Absolute values except `exchange_rate_change_delta` |
| SIMULATE | Owner confirmation of the scenario | Confirm endpoint | No owner identity is captured |
| COMPARE | Which scenario results to compare | `POST /comparisons` | |
| RESPOND | Selected scenario or free-text owner response | `POST /decisions` | |
| RESPOND | Owner confirmation reference (free text) | Confirm endpoint | |
| MONITOR | Actual metric value, unit, date, and source/business reference | `POST /monitoring-records` | |

**Frontend input today:** only the language toggle (EN/UR), the two UI-only sliders, and buttons. **No form in the frontend collects any business fact, shock, scenario, decision or actual value.**

---

## 7. Data Sources

### Approved-source registry (`app/services/economic_intelligence/source_registry.py`)

| Publisher (must match exactly, case-insensitive, if given) | Domain (exact or subdomain) | Role |
|---|---|---|
| State Bank of Pakistan | `sbp.org.pk` | approved economic and monetary evidence |
| Pakistan Bureau of Statistics | `pbs.gov.pk` | approved official statistics |
| Government of Pakistan | `gov.pk` | approved government publications |

- A source is approved only if the URL host matches a domain **and** the declared publisher matches that entry's publisher. A missing URL is never approved.
- The registry stores domains, not individual URLs (by design, per its docstring).
- The docs list "approved economic publications" (PRD FR-01) as a possible source class. **No such entry exists in the registry.** API_CONTRACT §7, DATA_CONTRACT §7 and AGENT_SPEC §7 all list the exact approved-source policy as an **open team decision**.

### Provenance

- `ProvenanceRecord` (domain): `source_name`, `source_url_or_reference`, `retrieved_at`, `published_at?`, `source_excerpt_or_locator?`, `verification_status`. At least one is required on every shock.
- `SourceEvidence` (DETECT): `source_id`, `title`, `publisher`, `source_url`, `quote` (the chunk text), `variable_text`, `value_text?`, `evidence_locator?`.
- Data categories that must stay distinct (PRD §15, DATA_CONTRACT §3.1): **External fact**, **Business fact**, **Assumption**, **Calculation**, **Decision**.

### Other data sources in the stack
- There is no database. `InMemoryStore` holds everything and is lost on restart.
- PRD §22 lists Supabase/PostgreSQL, pgvector and LlamaIndex. **None are present.** The retriever docstring says it "can later be replaced by pgvector/LlamaIndex".

---

## 8. Verification Rules

### Status vocabularies

| Record | Values | Source |
|---|---|---|
| Domain `verification_status` | `pending`, `verified`, `unverifiable`, `rejected` | `app/models/domain.py`, DATA_CONTRACT §3.2 |
| DETECT `ShockCandidate.verification_status` | `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED` | `economic_intelligence/schemas.py` |
| DETECT `ShockCandidate.status` | `CANDIDATE`, `VERIFIED`, `REJECTED` | same |
| Intake | `draft`, `clarification_required`, `confirmed`, `rejected` | domain. The backend only produces `draft` and `confirmed`. |
| Scenario assumptions | `draft`, `confirmed`, `rejected` | domain. `rejected` has no transition. |
| Decision | `not_selected`, `selected`, `confirmed`, `withdrawn` | domain. Only `selected` and `confirmed` are used. |
| Processing | `ready`, `blocked`, `completed`, `failed` | domain |
| Monitoring | `ON_TRACK`, `VARIANCE_DETECTED`, `REASSESSMENT_REQUIRED` | engine and contract (matching) |

These states are independent (DATA_CONTRACT §3.2). For example, a verified shock does not confirm business data.

### Rules as documented
- Pending or unverifiable shocks may go through TRACE only. QUANTIFY and every financial calculation require `verified` (API_CONTRACT §6.1, DATA_CONTRACT §5.1).
- `verified` requires an approved-source verification outcome (DATA_CONTRACT §5.1).
- Missing or unverifiable required input produces `clarification_required` or `blocked` with the missing fields named. A blocked result contains no substitute output (DATA_CONTRACT §3.1, §4.2).

### Rules as implemented
- **DETECT (`/detect`)**: The source-level allowlist is checked before extraction. Each candidate is checked for allowlist, non-empty quote, variable tokens (≥3 characters) present in the quote, and reported value tokens present in the quote *only when `value_text` is set*. In the live extractor path, `value_text` comes from an LLM field (`reported_value`) that the system prompt never asks for, so **in practice the magnitude is not checked against the quote**. This is from reading the code; the unit test sets `value_text` manually. The result is `VERIFIED` or `REJECTED`. `unverifiable` is never produced.
- **Registration (`/shocks`)**: The verification status is **taken from the caller**. The only rule is that `verified` requires at least one provenance item that is also self-labelled `verified`. The registry is not consulted.
- **QUANTIFY gate**: `shock.verification_status == verified` is enforced.
- **Blocker shape**: `{"error": {"code", "message", "stage"?, "required_fields"?}}`. The contract's `Blocker` also includes `related_record_ids`, which the implementation does not have.

---

## 9. No-Invention Rules

What the repository says must **never** be invented:

- Missing business information: identify it, ask or require confirmation, never silently assume (PRD §16).
- Financial numbers by an LLM (PRD FR-05; AGENT_SPEC §3 rule 3; DATA_CONTRACT §5.3).
- Economic facts without a source. An unapproved or unverifiable fact must not be marked verified (AGENT_SPEC §4.1).
- Statistics, dates, sources, variables, dependencies or magnitudes in DETECT extraction. The LLM must not calculate a change between two reported values (`extractor.py` SYSTEM_PROMPT rules 1–3, 6, 13).
- Undeclared business dependencies in TRACE (DATA_CONTRACT §5.2; AGENT_SPEC §4.3).
- Risk levels without an agreed deterministic rule and threshold (DATA_CONTRACT §5.5).
- Financial claims or figures in trade-off explanations (DATA_CONTRACT §5.5).
- Actual data in MONITOR. Actuals must not be treated as projections, and reassessment triggers must not be inferred (AGENT_SPEC §4.8, §5).
- Frontend substitute data or calculations. A pending choice must not be turned into a decision (API_CONTRACT §6.6; DATA_CONTRACT §1.7).
- `null` means intentionally unavailable, never a default (DATA_CONTRACT §3.1).
- A projection must never be presented as an observed fact (PRD §17).

Where the current code is **in tension** with these rules (reported, not judged):

1. The frontend DETECT request attributes placeholder text to "State Bank of Pakistan" / `sbp.org.pk` (`page.tsx:196-201`). That is a hard-coded claim of an approved source for content that did not come from it.
2. `/shocks` accepts a caller-asserted `verified` status without the approved-source registry.
3. QUANTIFY treats any verified percent-unit shock as an exchange-rate change, whatever its `shock_type`. The extractor prompt tells the LLM to copy a reported *level* (for example "inflation increased to 11.1 percent" → magnitude 11.1), which QUANTIFY would then treat as a percent *change*.
4. SIMULATE silently ignores unsupported assumption fields instead of returning a blocker.
5. MONITOR uses a 5% tolerance that the contract lists as not yet agreed.
6. The calculator returns 0% for any percentage change with a zero denominator. This is a documented rule, but the output does not mark it as "not computable".
7. The frontend shows "Reassessment: Not required" and "Ready to simulate" as static text. Nothing computed these states.
8. The frontend's SIMULATE slider defaults (+4%, −15%) are pre-filled assumptions taken from the PRD examples. They are not user-entered values.

---

## 10. Backend Architecture

- **Stack:** Python ≥3.11 (`pyproject.toml`), FastAPI (≥0.115, <1.0), Pydantic v2 (pulled in by FastAPI), Uvicorn, and the Groq SDK. Test extras: pytest and httpx.
- **Entry point:** `app/main.py`. This file:
  - creates the `FastAPI(title="TADBIR API")` app;
  - sets up CORS for `http://localhost:3000` and `:3001`;
  - registers the `ContractError` and validation handlers;
  - creates module-level singletons: `InMemoryStore`, `WorkflowOrchestrator`, `GroqService` and the DETECT pipeline objects;
  - mounts the router at `/api/v1`;
  - exposes `GET /health`.
- **Routers:** `app/api/routes.py`. Dependencies resolve to the singletons in `app.main` through lazy imports.
- **Config:** `app/core/config.py`, a frozen `Settings` dataclass. It reads `GROQ_API_KEY` and `GROQ_MODEL` from the process environment, and the key is excluded from `repr`. **The app does not load `.env` files itself**; there is no dotenv dependency.
- **Errors:** `app/core/errors.py`.
  - `ContractError(status, code, message, stage?, required_fields?)` → `{"error": {...}}`.
  - Pydantic validation → `400 INVALID_REQUEST` with field paths.
  - Other exceptions (`ValueError`, `ImpactCalculationError`, `GroqConfigurationError`, JSON errors) have no handler.
- **Models:** `app/models/domain.py`. These are contract models (`extra="forbid"`; `DecimalString` regex `^-?\d+(\.\d+)?$`) for shocks, intake, profiles, mapping/impact requests, scenarios, decisions, comparisons and monitoring.
- **Orchestration:** `app/services/orchestrator.py` (`WorkflowOrchestrator`, "Member 1"). It handles state, confirmations and gates, and contains no financial calculation. It delegates to `Member3Integration`.
- **Deterministic engine:** `app/services/impact_engine/` ("Member 3"):
  - `calculator.py`: QUANTIFY formulas.
  - `scenarios.py`: SIMULATE.
  - `comparison.py`: COMPARE.
  - `graph.py` and `schemas.py`: TRACE graph.
  - `monitoring.py`: MONITOR status rules.
  - `member3_integration.py`: the adapter from domain records to engine inputs. It enforces required fields, units and the temporary tolerance.
- **Economic intelligence:** `app/services/economic_intelligence/` ("Member 2"): `source_registry`, `chunker`, `retrieval` (keyword overlap), `extractor` (Groq LLM, JSON), `verifier`, `monitor` (pipeline) and `service`.
- **LLM boundary:** `app/services/groq.py`. `GroqService` is the single place a Groq client is constructed. It is created lazily and fails only when used without configuration. `app/services/interfaces.py` declares Protocol ports (`ImpactMappingPort`, `DeterministicImpactPort`, `EconomicIntelligencePort`, `LLMServicePort`). **These ports are not used by the orchestrator**, which calls `Member3Integration` directly, and their signatures differ from the actual adapter methods.
- **Persistence:** `app/services/store.py` (`InMemoryStore`). It is process-local, non-persistent and not thread-safe. Its docstring calls it a "replaceable development repository".
- **Response envelope:** API_CONTRACT §3 specifies `{"data": …, "meta": {"processing_status": …}}`. **Not implemented**: endpoints return raw objects.
- **Not present:** CrewAI, LlamaIndex, pgvector, Supabase, authentication (stated as out of MVP scope), Relevance Agent, Decision Brief Agent, Scenario Agent (as an LLM agent), and the economic Monitoring Agent for re-detecting change.

---

## 11. Frontend Architecture

- **Location:** `frontend/fluxscope_frontend/`.
- **Stack:** Next.js 15.5.27 (App Router), React 19.1.0, TypeScript 5 (strict). No other runtime dependencies.
- **PRD §22 also lists Tailwind CSS, shadcn/ui, Recharts and React Flow. None are installed.** Styling is a hand-written `app/globals.css` (853 lines).
- **Files:**
  - `app/layout.tsx`: FLUXSCOPE metadata and a root layout that imports `globals.css`.
  - `app/page.tsx`: a single client component, `Home`, of about 980 lines, holding the whole UI.
  - `lib/api.ts`: the API client.
- **API client (`lib/api.ts`):**
  - `API_BASE_URL` is **hard-coded** to `http://localhost:8000`. There is no environment variable.
  - It has two functions: `checkBackendHealth()` → `GET /health`, and `detectEconomicShocks()` → `POST /api/v1/detect`.
  - It defines one type: `ShockCandidate`, where `magnitude` is typed as `number | null`. The backend emits a `Decimal`.
- **UI structure:**
  - top bar with an EN/Urdu toggle (sets `lang`/`dir="rtl"`);
  - hero section with a decorative "product shell" mock;
  - stage rail;
  - method band;
  - seven stage sections (`#stage-detect` … `#stage-monitor`) whose active state is tracked by an `IntersectionObserver` on scroll;
  - closing section and footer ("Product prototype").
- **Workflow model:** The seven stages are **scroll sections of a single landing page**, not a stateful, step-gated flow. No workflow state (business ID, shock ID, profile ID, result IDs) is held anywhere in the frontend.
- **Per-stage implementation:** see §5. Only DETECT makes a backend call, and its result is not displayed.
- **Tests and tooling:** No frontend tests and no lint configuration file. `node_modules` is not installed in the workspace.

---

## 12. API Contract Summary

Base path `/api/v1` (except `/health`). "Contract" = `docs/API_CONTRACT.md` §4.

| Method | Path | Stage | Request model | Response (actual) | In contract? | Notes |
|---|---|---|---|---|---|---|
| GET | `/health` | n/a | — | `{"status":"ok"}` | No | Used by the frontend |
| POST | `/detect` | DETECT | `SourceDocument` | `list[ShockCandidate]` | **No** | The only backend endpoint the frontend calls; needs Groq |
| POST | `/shocks` | DETECT | `EconomicShockCreate` | `EconomicShockEvent` (201) | Yes | Self-declared verification |
| GET | `/shocks/{shock_id}` | DETECT | — | `EconomicShockEvent` | Yes | |
| POST | `/businesses/{business_id}/intake-drafts` | TRACE | `IntakeDraftCreate` | `BusinessIntakeDraft` (201) | Yes | |
| POST | `/businesses/{business_id}/intake-drafts/{draft_id}/confirm` | TRACE | — | `BusinessProfile` | Yes | |
| POST | `/impact-mappings` | TRACE | `ImpactMappingRequest` | `ImpactGraph` | Yes | Shape differs from `ImpactMapping` |
| POST | `/impact-results` | QUANTIFY | `ImpactResultRequest` | `ImpactResultRecord` | Yes | Mapping not validated; no trace |
| POST | `/scenarios` | SIMULATE | `ScenarioCreate` | `ScenarioDefinition` (201) | Yes | |
| PATCH | `/scenarios/{scenario_id}` | SIMULATE | `ScenarioUpdate` | `ScenarioDefinition` | **No** (contract describes edits only in prose) | Resets to draft |
| POST | `/scenarios/{scenario_id}/confirm` | SIMULATE | — | `ScenarioDefinition` | Yes | |
| POST | `/scenarios/{scenario_id}/run` | SIMULATE | — | `ScenarioResultRecord` | Yes | |
| POST | `/comparisons` | COMPARE | `ComparisonCreate` | **`null`** (result discarded) | Yes | Route bug: missing `return` |
| GET | `/comparisons/{comparison_id}` | COMPARE | — | — | Yes | **Not implemented** |
| POST | `/decisions` | RESPOND | `DecisionCreate` | `HumanDecision` (201) | Yes | Comparison ID not validated |
| POST | `/decisions/{decision_id}/confirm` | RESPOND | `DecisionConfirmation` | `HumanDecision` | Yes | |
| POST | `/monitoring-records` | MONITOR | `MonitoringRecordCreate` | `MonitoringResult` (not persisted) | Yes | Contract expects a `MonitoringRecord` |
| POST | `/projection-comparisons` | MONITOR | `ProjectionComparisonRequest` | always **424** after the decision check | Yes | Not connected |

**Error codes in use:**
- From the contract: `INVALID_REQUEST`, `RESOURCE_NOT_FOUND`, `STATE_CONFLICT`, `CLARIFICATION_REQUIRED`, `VERIFICATION_REQUIRED`, `APPROVAL_REQUIRED`, `UPSTREAM_UNAVAILABLE`.
- **Not in the contract:** `BUSINESS_INPUT_REQUIRED`, `BUSINESS_INPUT_NOT_FOUND`, `BUSINESS_MISMATCH`, `BASE_IMPACT_MISMATCH`, `INVALID_INPUT`. AGENT_SPEC §6 says new codes need team agreement.
- **Not used:** `PROCESSING_FAILED`. Unhandled exceptions are expected to produce a framework 500 instead.

---

## 13. Data Flow

### As supported by the backend API (a client must carry the IDs between calls)

```text
[caller-supplied SourceDocument] --POST /detect--> ShockCandidate[] (in-memory, not linked onward)
                                                          ┆  (no code path; client must re-post)
[caller-supplied shock + provenance] --POST /shocks--> EconomicShockEvent(id)
[client business_id + fields] --POST intake-drafts--> draft(id) --confirm--> BusinessProfile(id)
(shock_id, business_id) --POST /impact-mappings--> ImpactGraph(id)   [stored by shock_id]
(shock_id[verified], any mapping_id, [profile_id]) --POST /impact-results--> ImpactResultRecord(id)
(impact_result_id, business_id, assumptions) --POST /scenarios--> Scenario(id) --confirm--> --run--> ScenarioResultRecord(id)
(business_id, impact_result_id, [scenario_result_id]) --POST /comparisons--> null   ✗ (result not returned/stored)
(business_id, comparison_set_id[unvalidated], selected_scenario_id | text) --POST /decisions--> HumanDecision(id) --confirm-->
(decision_id[confirmed, with selected scenario], metric, actual) --POST /monitoring-records--> MonitoringResult (not stored)
(decision_id, record_ids) --POST /projection-comparisons--> 424 ✗
```

**End-to-end path exercised by the tests** (`tests/test_api.py::test_monitoring_evaluates_confirmed_selected_scenario`): shock (`verified`, self-declared) → intake → confirm → impact result (random mapping ID) → scenario → confirm → run → decision (random comparison ID) → confirm → monitoring record. The test does **not** go through `/detect`, `/impact-mappings` or `/comparisons`.

### As supported by the frontend
`GET /health` on load, and `POST /api/v1/detect` with a hard-coded placeholder on button click. Nothing flows to any later stage.

---

## 14. Current Implementation Matrix

| Stage | Backend | Frontend | Integration | Status |
|---|---|---|---|---|
| DETECT | `/detect` pipeline (allowlist → chunk → keyword retrieve → Groq extract → verify); `/shocks` registration | Health badge; button posts a **hard-coded placeholder** document; result not shown | Called but output discarded; no hand-off to `/shocks` | Partially implemented |
| TRACE | Intake draft/confirm; template-based 4-node graph | Static "Awaiting verified mapping" nodes; no intake form | None | Backend implemented / frontend incomplete (graph shape is a contract mismatch) |
| QUANTIFY | Deterministic FX/imported-input calculator with field and verification gates | Static "—" tiles | None | Backend implemented / frontend incomplete (mapping gate and trace missing; FX-only) |
| SIMULATE | Scenario draft/confirm/run, 5 supported fields | UI-only sliders, local "Save draft" | None | Backend implemented / frontend incomplete (frontend semantics differ) |
| COMPARE | Comparator logic exists; route returns `null`; no persistence; no risk | Static "Awaiting calculation" rows | None | Contract exists / execution incomplete |
| RESPOND | Decision create/confirm | Static card; button wired to DETECT | None | Backend implemented / frontend incomplete |
| MONITOR | Single-metric evaluation with temporary 5% tolerance; projection-comparison returns 424 | Static card incl. hard-coded "Not required" | None | Partially implemented |

---

## 15. Current Gaps

### Frontend / UX (per stage: where the user is, what is missing, what proceeds)

| Stage | What the user sees | What the user can enter | What proceeds | API called | Result shown | Missing-data / failure handling |
|---|---|---|---|---|---|---|
| DETECT | "Waiting for a verified economic event" + backend status | Nothing | "View information →" | `POST /detect` (hard-coded placeholder) | **No** (state never rendered) | `console.error` only |
| TRACE | 4 labelled empty nodes | Nothing (no business intake form) | Nothing | None | — | None |
| QUANTIFY | 4 metric tiles "—" | Nothing | Nothing | None | — | None |
| SIMULATE | 2 sliders (+4%, −15% defaults) | Slider values (local only) | "Save draft" (local toggle) | None | Local summary string | None |
| COMPARE | 3 hard-coded options "Awaiting calculation" | Nothing | Nothing | None | — | None |
| RESPOND | "No response recorded" | Nothing | "Review options →" (**calls DETECT**) | `POST /detect` | — | None |
| MONITOR | "NOT_STARTED", "Reassessment: Not required" | Nothing | Nothing | None | Static text | None |

Further frontend observations:
- No stage tells the user what information is required, why it is waiting, or what to do next. The waiting states are generic.
- No stage advances based on backend state. Stage "activity" only reflects scroll position.
- The hero "product shell" shows static statuses ("Awaiting verified data", "Profile not connected", "Ready to simulate").
- The API base URL is hard-coded to `localhost:8000`.
- Backend `422` blocker bodies (`required_fields`) are never parsed or shown.

### Backend
1. No `ShockCandidate` → `EconomicShockEvent` hand-off, and no endpoint to list or get detected candidates.
2. `/shocks` does not apply the approved-source registry. Verification is self-declared.
3. The TRACE → QUANTIFY "mapping complete" gate is not enforced (`impact_mapping_id` unchecked).
4. Mappings are stored by `shock_event_id`, so different businesses collide.
5. QUANTIFY supports only an exchange-rate/imported-input model and does not check `shock_type`.
6. `exchange_rate_change` is a required business field but its value is unused.
7. Unknown scenario assumption fields are silently ignored. Units are not validated.
8. `POST /comparisons` discards its result (missing `return`). There is no `GET /comparisons/{id}` and no ComparisonSet persistence. RiskIndicator and TradeOffExplanation are not implemented.
9. Decisions cannot reference a real comparison (`comparison_set_id` unvalidated).
10. Monitoring results are not persisted. `/projection-comparisons` is not connected (always 424).
11. The `{data, meta}` success envelope is not implemented. There is no `calculation_trace`. Decimal values are serialized as JSON numbers, not strings.
12. Several error paths lack contract handling and are expected to return 500: DETECT `ValueError`, Groq not configured, LLM JSON errors, `ImpactCalculationError`, `ScenarioValidationError`.
13. DETECT retriever state is shared across requests. `EconomicMonitor.detect_from_source` labels every retrieved chunk with the *current* request's source metadata, even though the retriever may return chunks from earlier documents. This is a **possible provenance mis-attribution**: established by reading the code, not tested.
14. DETECT magnitude is not checked against the evidence in the live path (`value_text` is effectively never set).
15. Intake confirmation is all-or-nothing, with no `clarification_required` path and no `BusinessDependency` record.
16. `interfaces.py` ports are unused and inconsistent with the adapter signatures.
17. Unimplemented agents: Relevance Agent, Decision Brief Agent, and change-triggered reassessment.

---

## 16. Known Limitations (explicitly stated in code or docs)

- `InMemoryStore`: "Replaceable development repository; no persistence behavior is assumed." (`store.py`)
- `LocalEconomicRetriever`: "Dependency-light retrieval… can later be replaced by pgvector/LlamaIndex." (`retrieval.py`)
- `EconomicChunker`: "Simple deterministic chunker for the MVP/local RAG path."
- Monitoring thresholds: "Temporary explicit MVP tolerance" (`member3_integration.py`) and "transparent MVP rules… can later be replaced by an approved product rule" (`monitoring.py`).
- `/projection-comparisons`: "Projection comparison logic is not connected. Member 3 integration is required."
- Frontend: "These controls preview the experience; final calculations come from the deterministic scenario engine." "© 2026 FLUXSCOPE. Product prototype."
- Frontend README: "UI-only scenario controls until the backend deterministic engine is connected".
- Authentication and authorization are outside the MVP contract (API_CONTRACT §3).
- Open MVP decisions that the docs explicitly leave unselected (API_CONTRACT §7, DATA_CONTRACT §7, AGENT_SPEC §7):
  - approved-source policy and verification procedure;
  - whether `/shocks` is internal-only;
  - required business fields per analysis;
  - dependency/graph vocabulary;
  - deterministic formula catalogue;
  - risk thresholds and formulas;
  - monitoring variance and reassessment rules;
  - record versioning and retention;
  - the boundary between relevance and mapping;
  - what counts as evidence of business-data confirmation;
  - the user-facing explanation content.
- PRD status: "MVP / Hackathon".

---

## 17. Testing Status

**Test files (`tests/`):** 34 test functions.

| File | Tests | Covers |
|---|---|---|
| `test_api.py` | 10 | Shock provenance and business-scope rejection; intake draft/confirm; invalid intake → 400; TRACE accepts a pending shock but QUANTIFY blocks it (`VERIFICATION_REQUIRED`); verified QUANTIFY returns result fields; scenario confirm/edit resets to draft and run blocked before confirm; full SIMULATE run; decision confirmation; monitoring requires a confirmed decision and a selected scenario; monitoring evaluates a selected scenario |
| `test_groq.py` | 4 | Env config read without key in `repr`; missing key fails only on use; fake client (no network); `/health` does not leak the key |
| `test_member2_economic_intelligence.py` | 6 | Registry accepts SBP and rejects a foreign domain; value-in-quote rejection; no-value verification; non-finite magnitude rejected; unchanged policy rate dropped by the extractor (fake LLM) |
| `test_member3_trace.py` | 1 | Graph has 4 node types, 4 nodes and 3 edges |
| `test_member3_quantify.py` | 3 | Calculator figures for a +10% FX case; negative input and −100% change rejected |
| `test_member3_simulate.py` | 4 | Price change, imported quantity, FX delta, empty-name rejection |
| `test_member3_compare.py` | 2 | Side-by-side outputs and trade-off tags; no winner attribute |
| `test_member3_monitoring.py` | 4 | ON_TRACK, VARIANCE_DETECTED and REASSESSMENT_REQUIRED thresholds; negative tolerance |

**Execution status: not run in this inspection.** The workspace has Python 3.14.6 but **FastAPI, pytest, httpx and groq are not installed**, and there is no `.venv`. Installing them would modify the environment or create files, which this phase does not authorize. Whether the suite currently passes is **Unknown**. The tests use `TestClient`, the in-memory store and fake LLM clients, so they are designed to need no network access.

**Not covered by tests:**
- `POST /detect` endpoint and `EconomicMonitor` / `LocalEconomicRetriever` / `EconomicChunker`;
- `GET /shocks/{id}`;
- `POST /comparisons` (whose `null` return would go undetected);
- `/projection-comparisons`;
- the mapping-before-QUANTIFY gate;
- unknown scenario fields;
- non-FX shock types in QUANTIFY;
- error handling for unhandled exceptions;
- CORS;
- the frontend (no frontend tests or test tooling exist);
- frontend–backend integration.

Test fixtures use placeholder provenance (`"Approved source placeholder"`, `"source-reference"`) marked `verified`, plus illustrative business values. These are test data, not product data.

---

## 18. Deployment Considerations (what is actually present)

- **Backend run command:** not documented anywhere in the repository. There is no root README, Dockerfile, Procfile or deployment manifest. The ASGI app object is `app.main:app`, and the frontend expects the backend on port 8000. `pyproject.toml` has no `[build-system]` table, and the install procedure is not documented.
- **Environment variables:** `GROQ_API_KEY` and `GROQ_MODEL` (`.env.example`). Both are optional at startup and required for `/detect`. They are read from the process environment only.
- **CORS:** `http://localhost:3000` and `http://localhost:3001` only, with credentials allowed.
- **Frontend:** `npm run dev` / `build` / `start` / `lint` (`package.json`). The README says to deploy only the frontend folder "with Vercel Drop". A deployed frontend would still call `http://localhost:8000` (hard-coded) and would not be an allowed CORS origin. **Production deployment of the full stack is not established by the repository.**
- The frontend README contains instructions referring to paths that do not match this workspace (`D:\Maryamm\TADBIR\…`) and tells the reader to delete an old frontend folder. These are historical instructions. They were not followed and should not be followed without clarification.
- **State:** in-memory only. A backend restart loses all records, and running multiple workers would split the state.
- **Local tooling observed:** Python 3.14.6 and Node v22.15.0 are on PATH. No Python dependencies and no `node_modules` are installed in the workspace.

---

## 19. Security Considerations

- **A GitHub personal access token is embedded in the `origin` remote URL** (`.git/config`). It is not reproduced in this document. It should be treated as exposed and revoked/rotated by its owner, and the remote should be replaced with a credential-free URL. Not actioned in this phase.
- `.env` files are git-ignored. `GroqService` never logs or returns the key, and `Settings.repr` hides it. Tests assert that `/health` does not leak it.
- There is no authentication or authorization. Any caller can register a `verified` shock, confirm business data, confirm scenarios or confirm decisions (`owner_confirmation_reference` is free text). Authentication is documented as out of MVP scope.
- `/detect` sends caller-supplied text to an external LLM provider (Groq) when configured.
- CORS is limited to localhost origins.
- No input size limits on `/detect` `content` were observed.

---

## 20. Contradictions / Uncertainties

1. **Master document name:** `AGENTS.md` and `PRD.md` §11 reference `docs/TADBIR_MASTER.md` (missing). `docs/FLUXSCOPE_MASTER.md` exists with TADBIR content. *Requires clarification* whether FLUXSCOPE_MASTER.md is the intended authority.
2. **Product name:** FLUXSCOPE in the UI and file names; TADBIR in every document body, the package names, the API title and some runtime messages.
3. **AGENTS.md is truncated** (ends mid-list at line 46). Its full intended content is unknown.
4. **Approved sources:** the PRD includes "approved economic publications". The registry has only SBP, PBS and gov.pk. The contracts say the policy is an open decision, yet a fixed allowlist is implemented.
5. **Verification vocabulary:** DETECT uses `PENDING_VERIFICATION`/`VERIFIED`/`REJECTED`; the domain and contract use `pending`/`verified`/`unverifiable`/`rejected`.
6. **`/detect` endpoint** is not in API_CONTRACT. The contract only has `POST /shocks` for DETECT.
7. **Response envelope:** the contract specifies `{data, meta}`; the code returns raw objects. The frontend consumes the raw form.
8. **Decimal encoding:** the contract requires decimal strings and prohibits floats; the API emits JSON numbers for engine outputs.
9. **Impact graph schema:** the contract and the code use different field names, and several required fields are missing (§5 TRACE).
10. **Monitoring thresholds and formula catalogue:** the contract says they are unselected open decisions; the code implements specific rules (5% / 2× tolerance; FX-only formula set).
11. **Error codes:** the code uses five codes not in the contract table.
12. **`HumanDecision`:** the contract's required fields do not include `business_id`; the code requires it. The contract lists `not_selected` as a status, but creation starts at `selected`.
13. **Frontend tech stack:** the PRD lists Tailwind, shadcn/ui, Recharts and React Flow. None are used.
14. **Backend/RAG stack:** the PRD lists LlamaIndex, pgvector, Supabase and CrewAI. None are used.
15. **SIMULATE semantics:** the frontend uses % sliders and "imported material cost"; the backend uses absolute replacement values and "imported quantity".
16. **QUANTIFY input:** `exchange_rate_change` is required as a *business* fact but is an *external* variable, and its value is overridden by the shock magnitude. This mixes data categories, which PRD §15 says must not be silently mixed.
17. **Ownership:** PRD §24 assigns COMPARE to Member 4 for presentation; DATA_CONTRACT/AGENT_SPEC assign comparison/risk *logic* to Member 3. These are consistent if read as logic vs. presentation, but the PRD wording alone is ambiguous.
18. **Frontend README paths and folder names** (`D:\Maryamm\TADBIR\…`, `TADBIR_frontend`) do not match this workspace.
19. **Test status** is unknown because the tests were not run.

---

## 21. Evidence / Source Files

**Documentation:** `AGENTS.md`, `docs/FLUXSCOPE_MASTER.md`, `docs/PRD.md`, `docs/API_CONTRACT.md`, `docs/DATA_CONTRACT.md`, `docs/AGENT_SPEC.md`, `FLUXSCOPE.docx` (text extracted read-only), `frontend/fluxscope_frontend/README.md`.

**Configuration:** `pyproject.toml`, `.gitignore`, `.env.example`, `frontend/fluxscope_frontend/package.json`, `next.config.ts`, `tsconfig.json`, local `.git/config` (read with credentials redacted).

**Backend:**
- Core: `app/main.py`, `app/api/routes.py`, `app/core/config.py`, `app/core/errors.py`, `app/models/domain.py`.
- Services: `app/services/orchestrator.py`, `store.py`, `interfaces.py`, `member3_integration.py`, `groq.py`.
- Impact engine: `app/services/impact_engine/{calculator,scenarios,comparison,graph,monitoring,schemas}.py`.
- Economic intelligence: `app/services/economic_intelligence/{__init__,service,schemas,source_registry,verifier,extractor,monitor,retrieval,chunker}.py`.

**Frontend:** `frontend/fluxscope_frontend/app/page.tsx`, `app/layout.tsx`, `lib/api.ts`. `app/globals.css` was checked only for size and naming comments.

**Tests:** `tests/test_api.py`, `test_groq.py`, `test_member2_economic_intelligence.py`, `test_member3_trace.py`, `test_member3_quantify.py`, `test_member3_simulate.py`, `test_member3_compare.py`, `test_member3_monitoring.py`.

**Not inspected:** `frontend/fluxscope_frontend/package-lock.json` (apart from its package name), `next-env.d.ts`, and anything outside the repository.
