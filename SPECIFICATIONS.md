# SPECIFICATIONS

_Last updated: 2025-07-26_

## Overview
MVP delivers:
1) **Collaboration Gateway (WebSocket):** Yjs y-websocket server for real-time editing.

No auth in MVP; anonymous, local-only development.

---

## Collaboration Gateway (WebSocket)

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

## Non-functional requirements
- **Latency:** operations <100ms roundtrip on localhost.
- **Payload limits:** 5 MiB per message (tune later).
- **Observability:** basic connection counters.

---

## Smoke (dev)
1. Connect two browser tabs to the same room.
2. Type text in one; it appears in the other.
