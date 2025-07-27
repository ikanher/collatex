import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import App from '../src/App';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
const aw = new Awareness(new Y.Doc());
vi.mock('y-websocket', () => ({ WebsocketProvider: vi.fn(() => ({ awareness: aw, disconnect: vi.fn() })) }));
process.env.VITE_WS_URL = 'ws://test:1234';

vi.mock('axios');
const mockedPost = vi.mocked(axios.post);
const mockedGet = vi.mocked(axios.get);

describe('compile flow', () => {
  beforeEach(() => {
    mockedPost.mockResolvedValue({ data: { jobId: 'abc' } } as any);
    mockedGet
      .mockResolvedValueOnce({ data: { status: 'running' } } as any)
      .mockResolvedValueOnce({ data: { status: 'done' } } as any)
      .mockResolvedValue({ data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) } as any);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:url') });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('compiles latex and shows pdf', async () => {
    render(<App />);
    const btn = screen.getByRole('button', { name: /compile/i });
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    await waitFor(() => expect(mockedPost).toHaveBeenCalled());
  }, 10000);
});
