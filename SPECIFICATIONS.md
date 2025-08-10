# SPECIFICATIONS

_Last updated: 2025-07-26_

## Overview
MVP delivers:
1) **Collaboration Gateway (WebSocket):** Yjs y-websocket server for real-time editing.

No auth in MVP; anonymous, local-only development.

---

## 1) Collaboration Gateway (WebSocket)

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

## 2) Non-functional requirements
- **Latency:** WebSocket handshake within 100ms on local dev.
- **Payload limits:** messages ≤1 MiB.
- **Resource use:** Redis memory ≤100 MiB.
- **Observability:** connection counts and message metrics.

---

## 3) Smoke (dev)
1. `GET /healthz` on gateway → 200.
2. Open two browser tabs to the same `/p/<token>` and verify edits sync.
