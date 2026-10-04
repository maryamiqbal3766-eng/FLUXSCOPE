# TADBIR — Product Requirements Document

## AI-Powered Economic Shock & Business Decision-Support System

Version: 1.0
Status: MVP / Hackathon
Product: TADBIR — تدبیر

---

# 1. Executive Summary

Businesses do not operate in a stable economic environment.

Exchange rates change.

Fuel prices change.

Electricity costs change.

Interest rates move.

Inflation changes input costs.

Taxes, duties and trade policies can change.

The problem is not simply knowing that an economic change occurred.

The difficult question is:

> "What does this change actually mean for MY business?"

A business owner may see:

> USD/PKR increased.

But the decision-relevant questions are:

- How exposed is my business?
- Which of my costs are affected?
- How much could my costs increase?
- What happens to my margin?
- How much additional cash could I need?
- What happens if I increase prices?
- What happens if I reduce imported inputs?
- What happens if I absorb the additional cost?
- Which trade-offs does each response create?

TADBIR is designed to bridge this gap.

TADBIR converts an external economic shock into a business-specific impact analysis, calculates the potential financial effect, and allows the business owner to simulate different responses before deciding.

---

# 2. The Problem

## The visible problem

Businesses receive economic information continuously.

They hear about:

- exchange-rate movements
- inflation
- fuel prices
- electricity prices
- interest rates
- tax changes
- import/export policy
- changing input costs

But economic information is usually presented at the macro level.

A business owner is left to manually translate:

> "The economy changed."

into:

> "What does this mean for my business?"

That translation is difficult.

---

# 3. The Decision Gap

The real problem is therefore not lack of economic news.

It is the gap between:

### EXTERNAL ECONOMIC CHANGE

and

### BUSINESS-SPECIFIC DECISION

The missing layer is:

**Economic Change → Business Exposure → Financial Impact → Response Scenario**

TADBIR is designed to provide that layer.

---

# 4. Why This Problem Matters

Recent business evidence shows that cost and economic pressures are material concerns for businesses.

A 2026 Gallup Pakistan survey reported inflation/input costs as a major business challenge, while many businesses also reported pressure from fuel and energy costs and broader cost increases. :contentReference[oaicite:1]{index=1}

The Pakistan Economic Survey 2025–26 also describes how external commodity and energy disruptions can transmit into domestic fuel, electricity, transport, food and industrial raw-material costs, with implications for inflation, imports and exchange-rate stability. :contentReference[oaicite:2]{index=2}

The challenge, therefore, is not merely identifying that a shock exists.

The challenge is translating that shock into the economics of an individual business.

---

# 5. Product Hook

## "Something changed in the economy. What does it mean for MY business?"

This is the central TADBIR hook.

A generic economic information system can tell a business owner:

> "USD/PKR increased 7%."

TADBIR goes further:

> "Your business depends on imported raw material."

Then:

> "This dependency exposes approximately X% of your cost structure."

Then:

> "Under the current assumptions, the shock could increase your monthly cost by approximately Rs. X."

Then:

> "What happens if you increase your price by 4%?"

TADBIR calculates it.

> "What happens if you reduce imported material by 15%?"

TADBIR calculates it.

The product therefore moves from:

**NEWS**

to

**IMPACT**

to

**SIMULATION**

to

**DECISION SUPPORT**

---

# 6. Product Vision

TADBIR aims to become a decision-support layer between economic change and business action.

Its purpose is not to predict the economy.

Its purpose is to help a business understand its exposure to economic change.

---

# 7. Product Definition

TADBIR is an AI-powered economic shock and business decision-support system.

It:

1. Detects relevant economic changes.
2. Identifies whether those changes may affect a business.
3. Maps the shock through the business's dependencies.
4. Quantifies the potential financial effect.
5. Simulates alternative responses.
6. Compares the resulting trade-offs.
7. Allows the business owner to decide.
8. Monitors actual outcomes against projections.

---

# 8. Target User

## Primary User

Small and medium-sized business owners/managers who face meaningful exposure to economic changes.

Particularly relevant businesses may include those with:

- imported inputs
- significant energy costs
- variable operating costs
- financing exposure
- price-sensitive customers
- supply-chain dependencies

The initial MVP does not attempt to serve every business type.

The business model should be structured enough for TADBIR to identify relevant dependencies.

---

# 9. User Problem Statement

A business owner knows that an economic event has occurred but cannot easily determine:

> where it enters the business,

> how it propagates through operations,

> how much it could affect finances,

> and what could happen under different responses.

Today, this translation often requires manually combining economic information, business data, spreadsheets, assumptions and judgment.

TADBIR brings these steps into one decision-support workflow.

---

# 10. Core Value Proposition

### Before TADBIR

Economic shock

↓

Search for information

↓

Interpret relevance

↓

Check business costs

↓

Build calculations manually

↓

Create spreadsheet scenarios

↓

Compare options

↓

Make decision

### With TADBIR

Economic shock

↓

**TADBIR**

↓

Business impact

↓

Financial effect

↓

Scenario simulation

↓

Transparent comparison

↓

**Human decision**

---

# 11. Core Workflow

DETECT
→ TRACE
→ QUANTIFY
→ SIMULATE
→ COMPARE
→ RESPOND
→ MONITOR

The complete workflow is defined in:

`docs/TADBIR_MASTER.md`

That document is the authoritative product workflow.

---

# 12. Functional Requirements

## FR-01 — Economic Shock Detection

TADBIR shall retrieve relevant economic information from trusted/approved sources.

Examples:

- SBP
- PBS
- Government of Pakistan
- approved economic publications

TADBIR shall identify relevant changes such as:

- exchange rates
- fuel prices
- electricity/energy prices
- interest rates
- inflation/input costs
- import/export policies
- taxes/duties

---

## FR-02 — Economic Shock Event

TADBIR shall convert relevant external information into a structured Economic Shock Event.

The event should contain appropriate information such as:

- shock type
- variable
- change
- date
- source
- relevant business dependencies

---

# FR-03 — Business Impact Mapping

TADBIR shall map an economic shock to the structured business model.

The mapping shall represent:

Economic Shock
→ Business Dependency
→ Operational Effect
→ Financial Effect

---

# FR-04 — Business Impact Graph

TADBIR shall provide a visual representation of the propagation path of the economic shock.

Example:

USD/PKR ↑
→ Imported Material
→ Material Cost ↑
→ COGS ↑
→ Margin ↓
→ Cash Requirement ↑

---

# FR-05 — Deterministic Impact Calculation

TADBIR shall calculate financial effects using deterministic code.

The system may calculate:

- input-cost impact
- COGS
- gross margin
- profit impact
- cash requirement
- percentage changes
- other explicitly defined financial effects

LLMs must not generate financial numbers.

---

# FR-06 — Scenario Simulation

TADBIR shall allow users to modify relevant assumptions.

Examples:

- price
- supplier mix
- imported quantity
- operating cost
- financing
- exchange-rate assumption
- other relevant business assumptions

Each scenario shall be recalculated using the deterministic calculation engine.

---

# FR-07 — Scenario Comparison

TADBIR shall display alternative responses side-by-side.

The comparison may include:

- cost impact
- margin
- cash requirement
- risk/trade-offs
- other relevant calculated outcomes

TADBIR shall not automatically declare one response universally superior.

---

# FR-08 — Human Decision

The business owner shall remain the final decision-maker.

The system may provide:

- decision summaries
- scenario results
- trade-off information
- relevant explanations

The system shall not make the final business decision autonomously.

---

# FR-09 — Monitoring

TADBIR shall support comparison between:

Projected impact

and

Actual impact

Relevant changes may include:

- actual costs
- sales
- margins
- exchange rate
- energy prices
- other tracked variables

---

# 13. AI Requirements

AI should be used where interpretation, retrieval, mapping, explanation and orchestration are valuable.

AI components may include:

1. Economic Monitor Agent
2. Relevance Agent
3. Impact Mapping Agent
4. Scenario Agent
5. Decision Brief Agent
6. Monitoring Agent

The financial calculation engine remains deterministic.

---

# 14. RAG Requirements

RAG is a supporting intelligence layer.

It shall:

1. Identify the information requirement.
2. Retrieve relevant information.
3. Ground responses in retrieved sources.
4. Separate retrieved facts from calculations.
5. Identify assumptions where applicable.
6. Provide source/context where appropriate.

RAG is not the core product.

The core product is business-specific impact analysis and scenario simulation.

---

# 15. Data Integrity Principles

TADBIR shall distinguish between:

### External Data

Information retrieved from approved sources.

### Business Data

Information supplied by the business.

### Calculations

Results generated by deterministic formulas.

### Assumptions

Values introduced specifically for scenario analysis.

These categories must not be silently mixed.

---

# 16. No-Invention Rule

TADBIR must not invent missing business information.

If a required value is unavailable or unclear:

1. Identify the missing information.
2. Ask the user for it or require confirmation.
3. Do not silently assume a value.

---

# 17. Scenario Integrity

Every scenario must clearly distinguish:

### Current Situation

What the business currently reports.

### Scenario Assumptions

What the user changes for the hypothetical scenario.

### Projected Outcome

What the deterministic engine calculates under those assumptions.

A projection must never be presented as an observed fact.

---

# 18. Human-in-the-Loop Principle

TADBIR is decision support.

The system:

**Informs → Calculates → Simulates → Compares**

The business owner:

**Decides**

---

# 19. Non-Goals

The MVP is NOT:

- an economic news website
- a generic chatbot
- an AI economist
- a generic AI CFO
- an autonomous business decision-maker
- a general accounting system
- a complete ERP
- a replacement for professional financial advice
- a system that predicts the economy with certainty

---

# 20. MVP Scope

The MVP must prioritize three capabilities:

## 1. Business Impact Graph

Show where an economic shock enters the business and how it propagates.

## 2. Impact Calculator

Quantify the estimated business-specific financial effect.

## 3. What-If Scenario Simulator

Allow the user to change assumptions and calculate alternative outcomes.

These three capabilities must work reliably before adding secondary functionality.

---

# 21. MVP Demonstration Flow

The ideal demonstration should follow one complete economic shock through the system.

Example:

### Step 1 — Detect

USD/PKR changes significantly.

↓

### Step 2 — Trace

TADBIR identifies imported raw materials as a business dependency.

↓

### Step 3 — Quantify

The deterministic engine calculates the estimated cost and margin effect.

↓

### Step 4 — Simulate

The owner tests:

- price +4%
- imported material -15%
- absorb cost

↓

### Step 5 — Compare

TADBIR presents the resulting trade-offs.

↓

### Step 6 — Respond

The owner chooses or modifies a response.

↓

### Step 7 — Monitor

The system can compare projected and actual results.

---

# 22. Technical Architecture

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts
- React Flow

## Backend

- Python
- FastAPI
- Pydantic

## AI

- Groq
- CrewAI where appropriate

## RAG

- LlamaIndex
- PostgreSQL/pgvector

## Database

- Supabase PostgreSQL

## Financial / Impact Engine

- Python
- Decimal
- Pandas/NumPy where required

---

# 23. Agent Architecture

Economic Monitor Agent
→ Relevance Agent
→ Impact Mapping Agent
→ Deterministic Impact Engine
→ Scenario Agent
→ Decision Brief Agent
→ Monitoring Agent

Each component has a bounded responsibility.

Agents must not duplicate responsibilities unnecessarily.

---

# 24. Team Ownership

## Member 1 — Product / AI Architecture / Integration

Owns:

- architecture
- FastAPI foundation
- API contracts
- orchestration
- structured business state
- human approval layer
- integration
- fallback/error handling

## Member 2 — Economic Intelligence + RAG

Owns:

DETECT

## Member 3 — Financial Impact + Scenario Engine

Owns:

TRACE → QUANTIFY → SIMULATE

- monitoring calculations
- variance logic
- reassessment triggers

## Member 4 — Frontend + UX

Owns:

COMPARE → RESPOND

- monitoring presentation/UI
- integrated testing

Each member develops only their assigned subsystem.

---

# 25. Integration Principle

TADBIR is one application.

Team members must not independently create competing architectures.

All modules must communicate through agreed data structures and API contracts.

---

# 26. Success Criteria

The MVP is successful if a user can:

1. Identify an economic shock.
2. Understand why it may affect their business.
3. See where the shock propagates through the business.
4. See a calculated financial impact.
5. Change an assumption.
6. See a recalculated scenario.
7. Compare multiple responses.
8. Understand the trade-offs.
9. Make their own decision.

---

# 27. Product Success Question

The core test for TADBIR is:

> Can TADBIR take an external economic change and turn it into a business-specific answer to:

> "What changed?"

> "Where does it affect me?"

> "How much could it affect me?"

> "What happens if I respond differently?"

> "What are the trade-offs?"

The final decision remains with the business owner.

---

# 28. One-Sentence Product Definition

TADBIR turns economic shocks into business-specific impact analysis and response simulations — so businesses can understand what changed, what it means for them, and what happens before they act.

---

# 29. Product Boundary

The product should remain centered on one fundamental transformation:

EXTERNAL ECONOMIC CHANGE

↓

BUSINESS-SPECIFIC IMPACT

↓

FINANCIAL EFFECT

↓

RESPONSE SIMULATION

↓

HUMAN DECISION

Any future feature must strengthen this transformation rather than distract from it.
