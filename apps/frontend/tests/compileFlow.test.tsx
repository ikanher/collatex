import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EditorPage from '../src/pages/EditorPage';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
const aw = new Awareness(new Y.Doc());
vi.mock('y-websocket', () => ({ WebsocketProvider: vi.fn(() => ({ awareness: aw, disconnect: vi.fn() })) }));
process.env.VITE_WS_URL = 'ws://test:1234';
process.env.VITE_API_TOKEN = 'tkn';


describe('compile flow', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:url') });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ json: () => ({ jobId: 'abc' }) } as any)
        .mockResolvedValueOnce({ json: () => ({ status: 'RUNNING' }) } as any)
        .mockResolvedValueOnce({ blob: () => new Blob() } as any),
    );
    class ES {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      close = vi.fn();
      constructor() {
        setTimeout(() => {
          this.onmessage?.({ data: JSON.stringify({ status: 'SUCCEEDED' }) } as any);
        }, 0);
      }
    }
    vi.stubGlobal('EventSource', ES as any);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('compiles latex and shows pdf', async () => {
    render(
      <MemoryRouter initialEntries={['/p/tkn']}>
        <Routes>
          <Route path="/p/:token" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>
    );
    const btn = screen.getByRole('button', { name: /compile/i });
    fireEvent.click(btn);
    await vi.runAllTimersAsync();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(btn).not.toBeDisabled());
    const iframe = screen.getByTitle('pdf') as HTMLIFrameElement;
    await waitFor(() => expect(iframe.src).toBe('blob:url'));
  }, 10000);

});
