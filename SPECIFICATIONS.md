SPECIFICATIONS

## 1. Problem
Enable anonymous, collaborative LaTeX editing with instant PDF preview via shareable links.

## 2. Scope (MVP)
- Real-time text editing
- On-demand PDF compilation
- Anonymous access via shareable URLs
- Upload assets (.bib, images)

## 3. Non-Goals
- User auth
- Version control
- Rich roles/permissions

## 4. Architecture
- Frontend: React + CodeMirror + pdf.js
- Collab Gateway: Node + y-websocket
- Compile Service: FastAPI + Tectonic
- Storage: Local for dev, S3-compatible for prod
- Workspace: Python managed with uv

## 5. Interfaces

### WebSocket
- URL: `ws://localhost:6060/room/:id`
- Protocol: y-websocket default

### HTTP (Compile Service)
- `GET /healthz` → 200 OK
- `POST /compile` → Start job
  ```json
  {
    "main": "main.tex",
    "files": [
      { "path": "main.tex", "content": "..." },
      { "path": "refs.bib", "content": "..." }
    ]
  }
  ```
- `GET /jobs/{id}` → job status
- `GET /pdf/{id}` → returns PDF

## 6. Data Models

### Room
- id: string
- createdAt: timestamp

### Job
- id
- status: queued | running | done | error
- outputPath, logPath
- error (optional)

## 7. Compile Pipeline
1. Validate input
2. Save files to temp dir
3. Run Tectonic
4. Save artifacts
5. Return status + PDF URL

## 8. Security
- Unguessable IDs
- No shell-escape
- File type and size checks
- Memory/time limits for compile

## 9. Performance
- Collab latency <100ms
- Compile <3s for small doc
- 10 users/room supported

## 10. Monitoring
- Logs per request
- Compile duration metrics
- WS connection count
- Health endpoints

## 11. Local Dev
- Frontend: 5173
- Gateway: 6060
- Backend: 8080

## 12. Milestones
- M0: Collab sync working
- M1: Compile job end-to-end
- M2: Anonymous share links
- M3: Basic persistence

## 13. Tests
- Two users sync text
- Upload .bib, compile succeeds
- Invalid file → error log
