# CollaTeX — AGENTS

_Last updated: 2025-07-26_

## Global principles
- **Scope first, code second.** Keep the MVP tiny: compile LaTeX to PDF + collaborative text editing.
- **Security-first compile.** No shell escape; bounded CPU/RAM; per-job temp dirs; path traversal blocked.
- **No Docker (dev).** Local venv + Node 20 LTS. Dockerization can come later.
- **Interfaces > impl.** Every service exposes a narrow API with acceptance checks.
- **Quality gates.** Lint, typecheck, and minimal tests before adding features.

## Coding standards
- Python 3.11+; FastAPI + Pydantic v2; `ruff` for lint (enable flake8-quotes single-quote rules); mypy strict.
- Node 20+; TypeScript strict; ESLint with `@typescript-eslint` recommended; Prettier optional.
- JSON logs only; include `request_id`/`job_id` where applicable.

## 1) Architect
**Goal**: Keep system coherent and small; own the contracts and acceptance criteria.

**Deliverables**
- `SPECIFICATIONS.md` up-to-date (API shapes, limits, error model, security).
- Risk register (compile security, performance, storage).
- Test strategy outline.

**Acceptance**
- Endpoints, payloads, and error codes are explicit.
- Non-functional requirements: latency, timeouts, memory ceilings, payload limits are stated.
- Verification steps exist and can be executed locally.

**How to verify**
- Run the “Smoke” steps in `SPECIFICATIONS.md` and confirm outputs match.

## 2) Python Backend Agent (Compile Service)
**Goal**: FastAPI app exposing `/healthz`, `/compile`, `/jobs/{id}`, `/pdf/{id}`.

**Constraints**
- No shell escape; reject suspicious TeX (`\write18`, etc.).
- Timeouts: soft 5s CPU for MVP; memory ceiling ~256–512MB where OS supports it.
- Network off by default (dev may allow one-time cache warm-up).
- Per-job temp workspace; validate file paths (no `..`, no leading `/`).
- Structured JSON logs.

**Deliverables**
- backend/compile-service/src/compile_service/app/
- Request/response models; in-memory job table; simple background worker.
- Unit tests for validation and a stub compile path (Tectonic wiring can come next).

**Acceptance**
- `GET /healthz` → `200 {'status':'ok'}`
- `POST /compile` → `202 {'jobId': '...'}` for valid input; 4xx on invalid.
- `GET /jobs/{id}` returns `queued|running|done|error`.
- `GET /pdf/{id}` returns `application/pdf` when `done`, 404 otherwise.
- Logs include `job_id`, duration, result status.

**How to verify**
- `curl localhost:8000/healthz`
- Post the example request in `SPECIFICATIONS.md`, poll job status, fetch PDF (stub ok).

## 3) Collab Gateway Agent (Node/TS)
**Goal**: Real-time editing with Yjs via y-websocket (dev uses the stock server).

**Constraints**
- Default ephemeral in-memory rooms.
- CORS: allow localhost dev origins only.
- Health check endpoint.

**Deliverables**
- For dev: run `y-websocket` server (no custom code required).
- Later: wrap/extend with a small TS server if needed.

**Acceptance**
- WS server listens on `localhost:1234`.
- A smoke script can connect to a room and exchange updates.

**How to verify**
- `npm --prefix apps/collab_gateway run ws` starts a server and logs connections.

## 4) Frontend Agent (React/TS) — later
**Goal**: Editor + PDF preview.

**Deliverables** (later)
- CodeMirror 6 + Yjs client; presence cursors; PDF.js viewer.

**Acceptance**
- Type → state syncs via Yjs; Compile button triggers `/compile`.

## 5) QA Agent
**Goal**: Tests.

**Deliverables**
- Pytest for API validation paths; a WS smoke test script.

**Acceptance**
- Tests run locally (`make test`) and pass.

## 6) Infra Agent (no Docker)
**Goal**: Dev ergonomics + CI.

**Deliverables**
- `Makefile` with `setup`, `dev`, `lint`, `test`.
- `.env.example`, `.editorconfig`, `.gitignore`.
- GitHub Actions (optional until MVP compiles TeX).

**Acceptance**
- `make dev` runs API + WS; `make lint` and `make test` complete without failures.
