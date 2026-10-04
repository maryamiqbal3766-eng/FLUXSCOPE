# FLUXSCOPE — Running the Demo Locally

## Backend (FastAPI, port 8000)

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install "fastapi>=0.115,<1.0" "groq>=0.13,<1.0" "uvicorn>=0.30,<1.0" "httpx>=0.27,<1.0" "pytest>=8.0,<9.0"
```

DETECT uses the Groq LLM to extract shock candidates. The app reads the
configuration from the process environment only (it does not load `.env`):

```bash
export GROQ_API_KEY=<your key>
export GROQ_MODEL=<a Groq chat model name>
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

On macOS/Linux use `.venv/bin/python`. Without these variables every stage
except DETECT still works, and DETECT returns `424 UPSTREAM_UNAVAILABLE` with
an explanation.

Tests: `.venv/Scripts/python.exe -m pytest`

## Frontend (Next.js, port 3000)

```bash
cd frontend/fluxscope_frontend
npm ci
npm run dev
```

The API base URL defaults to `http://localhost:8000`; override it with
`NEXT_PUBLIC_API_BASE_URL`. Backend CORS allows `localhost`/`127.0.0.1` on
ports 3000 and 3001 only.

## Demo path

1. **DETECT**: choose an approved publisher (SBP, PBS, Government of Pakistan),
   give a URL on that publisher's domain, the title, optionally the
   publication date, and paste the source text. Select a detected shock.
2. **TRACE**: enter your business facts, submit, review, confirm, then create
   the impact mapping.
3. **QUANTIFY**: run the deterministic calculation. Only `exchange_rate`
   shocks are supported by the current engine; others show a blocker.
4. **SIMULATE**: create scenarios (replacement values, or an additional
   exchange-rate change in percentage points), confirm, and run them.
5. **COMPARE**, **RESPOND** and **MONITOR** use the real comparison, decision
   and monitoring endpoints.

All state is in memory: restarting the backend clears it.
