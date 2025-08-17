import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('wasmTex', () => {
  it('returns a PDF blob', async () => {
    const pdf = new Uint8Array([1, 2, 3]);
    class MockWorker {
      onmessage: ((ev: any) => void) | null = null;
      postMessage(msg: any) {
        if (!msg.id) {
          setTimeout(() => this.onmessage?.({ data: { type: 'ready' } }));
        } else {
          setTimeout(() => this.onmessage?.({ data: { id: msg.id, pdf } }));
        }
      }
      addEventListener(type: string, cb: any) {
        if (type === 'message') this.onmessage = cb;
      }
      removeEventListener() {}
      terminate() {}
    }
    vi.stubGlobal('Worker', MockWorker as any);
    const { compileToPdf } = await import('../src/lib/wasmTex');
    const blob = await compileToPdf('hi');
    expect(blob.type).toBe('application/pdf');
  });

  it('surfaces compile errors', async () => {
    class MockWorker {
      onmessage: ((ev: any) => void) | null = null;
      postMessage(msg: any) {
        if (!msg.id) {
          setTimeout(() => this.onmessage?.({ data: { type: 'ready' } }));
        } else {
          setTimeout(() => this.onmessage?.({ data: { id: msg.id, error: 'bad', log: 'line1\nline2' } }));
        }
      }
      addEventListener(type: string, cb: any) {
        if (type === 'message') this.onmessage = cb;
      }
      removeEventListener() {}
      terminate() {}
    }
    vi.stubGlobal('Worker', MockWorker as any);
    const { compileToPdf } = await import('../src/lib/wasmTex');
    await expect(compileToPdf('hi')).rejects.toMatchObject({ stage: 'compile' });
  });

  it('times out when worker does not respond', async () => {
    vi.useFakeTimers();
    class MockWorker {
      onmessage: ((ev: any) => void) | null = null;
      postMessage(msg: any) {
        if (!msg.id) {
          setTimeout(() => this.onmessage?.({ data: { type: 'ready' } }), 0);
        }
      }
      addEventListener(type: string, cb: any) {
        if (type === 'message') this.onmessage = cb;
      }
      removeEventListener() {}
      terminate() {}
    }
    vi.stubGlobal('Worker', MockWorker as any);
    const { compileToPdf } = await import('../src/lib/wasmTex');
    const promise = compileToPdf('hi', { timeoutMs: 5 });
    vi.runAllTimers();
    await expect(promise).rejects.toMatchObject({ stage: 'compile', message: 'timeout' });
    vi.useRealTimers();
  });
});
