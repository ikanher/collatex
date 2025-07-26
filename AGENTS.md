CollaTeX — AGENTS

## 1) Architect
**Goal:** Keep the system coherent and small; enforce interfaces and constraints.
**When:** Before new features/refactors; when contracts change.
**Deliverables:** Updated SPECIFICATIONS.md sections; acceptance criteria; task breakdown.
**Acceptance:** Interfaces listed; risks called out; test strategy noted.

## 2) Python Backend Agent (Compile Service)
**Goal:** FastAPI app exposing `/compile`, `/jobs/{id}`, `/pdf/{id}` that shells out to Tectonic safely.
**Constraints:** No shell-escape; timeouts; memory/process limits (where possible); path traversal blocked; file size/type checks.
**Tech:** FastAPI, Pydantic v2, Uvicorn, subprocess.
**Deliverables:** `app/main.py`, `app/models.py`, `app/jobs.py`, `app/storage.py`, unit tests, typed.
**Acceptance:**
- `GET /healthz` → 200 `{status:'ok'}`
- `POST /compile` → 202 `{jobId}` for valid request; 4xx on invalid
- `GET /jobs/{id}` reports `queued|running|done|error`
- `GET /pdf/{id}` returns `application/pdf`
- Example doc compiles in ≤3s locally (if Tectonic is installed)

## 3) Collab Gateway Agent (Node/TS)
**Goal:** Real-time editing with Yjs via y-websocket.
**Constraints:** In-memory rooms; CORS; simple rate limiting; Redis persistence toggle later.
**Deliverables:** `collab-gateway/src/server.ts`, `package.json`, `README.md`, smoke test script.

## 4) Frontend Agent (React/TS)
**Goal:** Editor + PDF preview with anonymous link share.
**Deliverables:** `EditorPage` with CodeMirror 6 + y-codemirror, awareness cursors, “Compile” button, pdf.js viewer, error states.

## 5) QA Agent
**Goal:** Tests.
**Deliverables:** Pytest API tests; minimal WS load test; E2E smoke (later).

## 6) Infra Agent
**Goal:** Dev ergonomics and CI.
**Deliverables:** Makefile, `.env.example`, `.editorconfig`, `.gitignore`, CI workflow (lint, typecheck, test); optional Docker later.
