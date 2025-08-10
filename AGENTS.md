# CollaTeX — AGENTS

_Last updated: 2025-07-26_

## Global principles
- **Scope first, code second.** Collaborative text editing with MathJax preview.
- **No Docker (dev).** Local Node 20 LTS.
- **Interfaces > impl.** Every service exposes a narrow API with acceptance checks.
- **Quality gates.** Lint, typecheck, and minimal tests before adding features.

## Coding standards
- Node 20+; TypeScript strict; ESLint with `@typescript-eslint` recommended; Prettier optional.
- JSON logs only; include `request_id` where applicable.

## 1) Architect
**Goal**: Keep system coherent and small; own the contracts and acceptance criteria.

**Deliverables**
- `SPECIFICATIONS.md` up-to-date (API shapes, limits, error model, security).
- Risk register (collab security, performance, storage).
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
**Goal**: Editor + PDF export.

**Deliverables**
- CodeMirror 6 + Yjs client; presence cursors; MathJax preview.

**Acceptance**
- Type → state syncs via Yjs; Export button captures preview to PDF.

## 4) QA Agent
**Goal**: Tests.

**Deliverables**
- Jest/Vitest suites; a WS smoke test script.

**Acceptance**
- Tests run locally (`make test`) and pass.

## 5) Infra Agent (no Docker)
**Goal**: Dev ergonomics + CI.

**Deliverables**
- `Makefile` with `setup`, `dev`, `lint`, `test`.
- `.env.example`, `.editorconfig`, `.gitignore`.
- GitHub Actions.

**Acceptance**
- `make dev` runs WS + frontend; `make lint` and `make test` complete without failures.
