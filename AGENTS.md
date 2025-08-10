# CollaTeX — AGENTS

_Last updated: 2025-07-26_

## Global principles
- **Scope first, code second.** Keep the MVP tiny: collaborative text editing with client-side PDF export.
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

## 2) Collab Gateway Agent (Node/TS)
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

## 3) Frontend Agent (React/TS)
**Goal**: Editor + PDF preview.

**Deliverables** (later)
- CodeMirror 6 + Yjs client; presence cursors; PDF.js viewer.

**Acceptance**
- Type → state syncs via Yjs; Export button generates a client-side PDF.

## 4) QA Agent
**Goal**: Tests.

**Deliverables**
- Pytest for API validation paths; a WS smoke test script.

**Acceptance**
- Tests run locally (`make test`) and pass.

## 5) Infra Agent (no Docker)
**Goal**: Dev ergonomics + CI.

**Deliverables**
- `Makefile` with `setup`, `dev`, `lint`, `test`.
- `.env.example`, `.editorconfig`, `.gitignore`.
- GitHub Actions (optional until MVP compiles TeX).

**Acceptance**
- `make dev` runs services; `make lint` and `make test` complete without failures.
