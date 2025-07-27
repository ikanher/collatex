import { vi, describe, it, expect } from 'vitest';
import * as Y from 'yjs';

process.env.VITE_WS_URL = 'ws://test:1234';
vi.mock('y-websocket', () => ({ WebsocketProvider: vi.fn() }));

import { connectWs } from '../src/ws';
import { WebsocketProvider } from 'y-websocket';

describe('ws connection', () => {
  it('uses env var', () => {
    const doc = new Y.Doc();
    connectWs(doc, process.env.VITE_WS_URL as string);
    expect(WebsocketProvider).toHaveBeenCalledWith('ws://test:1234', 'main', doc);
  });
});
