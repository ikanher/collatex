import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';

process.env.VITE_WS_URL = 'ws://collab:1234';
process.env.VITE_API_TOKEN = 'tkn';
import { Awareness } from 'y-protocols/awareness';
const aw = new Awareness(new Y.Doc());
vi.mock('y-websocket', () => ({ WebsocketProvider: vi.fn(() => ({ awareness: aw, disconnect: vi.fn() })) }));
import { WebsocketProvider } from 'y-websocket';
import { useCollabDoc } from '../src/hooks/useCollabDoc';

describe('useCollabDoc', () => {
  it('connects to env url and room', () => {
    const { result } = renderHook(() => useCollabDoc('room1'));
    expect(WebsocketProvider).toHaveBeenCalledWith(
      'ws://collab:1234',
      'room1',
      expect.any(Y.Doc),
      { params: { token: 'tkn' } }
    );
    act(() => {
      result.current.ytext.insert(0, 'hi');
    });
    expect(result.current.ytext.toString()).toBe('hi');
  });
});
