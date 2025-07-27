# SPECIFICATIONS

_Last updated: 2025-07-26_

## Overview
MVP delivers:
1) **Compile Service (HTTP):** Accepts a set of files for a project and produces a PDF.
2) **Collaboration Gateway (WebSocket):** Yjs y-websocket server for real-time editing.

No auth in MVP; anonymous, local-only development.

---

## 1) Compile Service API (HTTP, JSON)

**Base URL (dev):** `http://localhost:8080`

### Health
`GET /healthz` → `200 {"status":"ok"}`

### Start compile
`POST /compile` → `202`
```json
{
  "projectId": "doc-123",
  "entryFile": "main.tex",
  "engine": "tectonic",
  "files": [
    {"path": "main.tex", "contentBase64": "BASE64..."},
    {"path": "chapters/intro.tex", "contentBase64": "BASE64..."}
  ],
  "options": {
    "synctex": false,
    "maxSeconds": 5,
    "maxMemoryMb": 512
  }
}
```

**Response**
```json
{"jobId":"a7f0d1a0-2c3d-4f0e-9c8b-1c2d3e4f5a6b"}
```

**Validation**
- `entryFile` required; must exist in `files`.
- `files[*].path` must be relative, no `..`, no leading `/`.
- Total payload ≤ 2 MiB (MVP).
- `engine` currently only `'tectonic'`.

**Errors**
- `400` invalid JSON or failed validation (details in body).
- `413` payload too large.
- `422` LaTeX rejected for policy (e.g., `\write18`).
- `500` unexpected server error.

### Job status
`GET /jobs/{jobId}` → `200`
```json
{
  "jobId": "…",
  "status": "queued|running|done|error",
  "queuedAt": "2025-07-26T10:00:00Z",
  "startedAt": "2025-07-26T10:00:01Z",
  "finishedAt": "2025-07-26T10:00:03Z",
  "error": null
}
```

### Fetch PDF
`GET /pdf/{jobId}` → `200 application/pdf`
- Headers: `ETag`, `Cache-Control: no-store`.
- `404` if not ready or job unknown.

### Logging & tracing
- Use `X-Request-Id` if provided; otherwise generate one.
- JSON logs; include `job_id`, timing, result.

### Security policy (MVP)
- No shell escape; reject files containing `\write18` or similar patterns.
- Execute compile in a temp directory; remove after completion.
- Set CPU time limit (`5s`) and memory ceiling (`512MiB` default, max 1GiB) where supported (POSIX `resource`).
- No network during compile (dev may allow one-time cache warm-up).

---

## 2) Collaboration Gateway (WebSocket)

**Dev server**: stock `y-websocket`
**URL**: `ws://localhost:1234/<roomId>`
**Behavior**:
- Rooms are created on connect, in-memory only.
- Awareness API for cursors/presence supported by default.
- No auth in MVP; restrict to localhost CORS when you wrap it later.

**Client snippet (example)**
```ts
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
const doc = new Y.Doc()
const provider = new WebsocketProvider('ws://localhost:1234', 'room-demo', doc)
const ytext = doc.getText('content')
```

---

## 3) Non-functional requirements
- **Latency:** compile request acknowledged within 100ms (job queued).
- **Timeouts:** default soft 5s compile CPU; hard 10s wall.
- **Memory:** default 512 MiB; request may lower but not exceed 1 GiB.
- **Payload limits:** 5 MiB per request (tune later).
- **Resource use:** temp workspace ≤ 50 MiB.
- **Observability:** counters for compile success/fail; duration histograms.

---

## 4) Smoke (dev)
1. `GET /healthz` → 200.
2. `POST /compile` with the example above → `202 {jobId}`.
3. `GET /jobs/{jobId}` until `done` (stub is acceptable in early dev).
4. `GET /pdf/{jobId}` → `200` (stub may return 404 until Tectonic is wired).
