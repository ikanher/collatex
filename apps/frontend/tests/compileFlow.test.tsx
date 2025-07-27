import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import App from '../src/App';
import BuildLog from '../src/components/BuildLog';
vi.mock('react-pdf', () => ({
  Document: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Page: () => <canvas data-testid="pdf-canvas" />,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } }
}));
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
const aw = new Awareness(new Y.Doc());
vi.mock('y-websocket', () => ({ WebsocketProvider: vi.fn(() => ({ awareness: aw, disconnect: vi.fn() })) }));
process.env.VITE_WS_URL = 'ws://test:1234';
process.env.VITE_API_TOKEN = 'tkn';

vi.mock('../src/api/client', () => ({
  default: { post: vi.fn(), get: vi.fn() }
}));
import api from '../src/api/client';
const mockedPost = vi.mocked(api.post);
const mockedGet = vi.mocked(api.get);

describe('compile flow', () => {
  beforeEach(() => {
    mockedPost.mockResolvedValue({ data: { jobId: 'abc' } } as any);
    mockedGet
      .mockResolvedValueOnce({ data: { status: 'running' } } as any)
      .mockResolvedValueOnce({ data: { status: 'done' } } as any)
      .mockResolvedValue({ data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) } as any);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:url') });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('compiles latex and shows pdf', async () => {
    render(<App />);
    const btn = screen.getAllByRole('button', { name: /compile/i })[0];
    fireEvent.click(btn);
    await vi.runAllTimersAsync();
    await waitFor(() => expect(mockedPost).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('pdf-canvas')).toBeInTheDocument());
  }, 10000);

  it('shows log panel', () => {
    render(<BuildLog log="error: oops" status="error" open={true} onToggle={() => {}} />);
    expect(screen.getByText(/error: oops/i)).toBeInTheDocument();
  });
});
