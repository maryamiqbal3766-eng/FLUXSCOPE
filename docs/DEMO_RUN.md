# FLUXSCOPE — Running the Demo Locally

## Backend (FastAPI, port 8000)

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install "fastapi>=0.115,<1.0" "groq>=0.13,<1.0" "uvicorn>=0.30,<1.0" "httpx>=0.27,<1.0" "pytest>=8.0,<9.0"
```

DETECT uses the Groq LLM to extract shock candidates. Put the configuration in
the git-ignored `.env` at the repository root (never in the tracked
`.env.example`); real environment variables override it:

```bash
GROQ_API_KEY=<your key>
GROQ_MODEL=<a Groq chat model name>
```

```bash
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

Do not use `--reload` during a demo: all state is in memory and a reload
clears it.

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

## Deployment configuration

Backend environment variables (set on the hosting platform, never committed):

- `GROQ_API_KEY`, `GROQ_MODEL`
- `FRONTEND_ORIGIN`: the deployed frontend origin, e.g. `https://fluxscope.example.com`
  (comma-separated for several; `*` is ignored). Localhost origins stay allowed.

Run one worker (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`): state is in memory.

Frontend build-time variable (Next.js inlines it during `npm run build`):

- `NEXT_PUBLIC_API_BASE_URL`: the deployed backend URL, e.g. `https://api.fluxscope.example.com`

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
