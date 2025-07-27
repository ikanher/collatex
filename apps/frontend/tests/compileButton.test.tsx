import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditorPage, { compile as compileFn } from '../src/components/EditorPage';
import axios from 'axios';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('axios');

const mockedPost = vi.mocked(axios.post);
const mockedGet = vi.mocked(axios.get);

describe('compile flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedPost.mockResolvedValue({ data: { jobId: '1' } } as any);
    mockedGet
      .mockResolvedValueOnce({ data: { status: 'queued' } } as any)
      .mockResolvedValueOnce({ data: { status: 'running' } } as any)
      .mockResolvedValueOnce({ data: { status: 'done' } } as any)
      .mockResolvedValue({ data: new Blob(['pdf']) } as any);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:url') });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.skip('starts compile and polls job', async () => {
    render(<EditorPage />);
    fireEvent.click(screen.getByText('Compile PDF'));
    vi.advanceTimersByTime(3000);
    await waitFor(() => expect(mockedPost).toHaveBeenCalled());
  });
});
