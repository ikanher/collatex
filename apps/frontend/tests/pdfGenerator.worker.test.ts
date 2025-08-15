import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePdf } from '../src/lib/pdfGenerator';

vi.mock('../src/lib/flags', () => ({ ENABLE_WASM_TEX: true }));
vi.mock('../src/lib/compileAdapter', () => ({ compile: vi.fn(), isServerCompileEnabled: false }));

let workerOk = true;
class FakeWorker {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: string, cb: any) {
    if (type === 'message') this.onmessage = cb;
    if (type === 'error') this.onerror = cb;
  }
  postMessage() {
    setTimeout(() => {
      if (workerOk) {
        this.onmessage?.({ data: { ok: true, pdf: new Uint8Array([1]), log: '' } });
      } else {
        this.onmessage?.({ data: { ok: false, error: 'tectonic_unavailable', log: '' } });
      }
    }, 0);
  }
  terminate() {}
}

vi.mock('../src/workers/wasm-tectonic.worker?worker', () => ({ default: FakeWorker }));

beforeEach(() => {
  workerOk = true;
});

describe('generatePdf', () => {
  it('returns pdf when worker succeeds', async () => {
    const res = await generatePdf({ source: 'hi', wasmEnabled: true });
    expect(res.via).toBe('wasm');
  });

  it('returns error when worker fails', async () => {
    workerOk = false;
    const res = await generatePdf({ source: 'hi', wasmEnabled: true });
    expect(res.error).toBeDefined();
    expect(res.via).toBeUndefined();
  });
});

