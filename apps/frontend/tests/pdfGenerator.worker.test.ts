import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePdf } from '../src/lib/pdfGenerator';

vi.mock('../src/lib/flags', () => ({ ENABLE_WASM_TEX: true }));
vi.mock('../src/lib/compileAdapter', () => ({ compile: vi.fn(), isServerCompileEnabled: false }));

vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('jspdf', () => {
  const ctor = vi
    .fn()
    .mockImplementation(() => ({
      internal: { pageSize: { getWidth: () => 100 } },
      addImage: vi.fn(),
      output: vi.fn(() => new ArrayBuffer(0)),
    }));
  return { default: ctor };
});

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
const html2canvasMock = vi.mocked(html2canvas);
const jsPDFMock = vi.mocked(jsPDF);

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
        this.onmessage?.({ data: { ok: false, log: '' } });
      }
    }, 0);
  }
  terminate() {}
}

vi.mock('../src/workers/wasm-tectonic.worker?worker', () => ({ default: FakeWorker }));

beforeEach(() => {
  workerOk = true;
  html2canvasMock.mockReset();
  jsPDFMock.mockClear();
});

describe('generatePdf', () => {
  it('skips fallback when worker returns pdf', async () => {
    const res = await generatePdf({ source: 'hi', previewEl: document.createElement('div') });
    expect(res.via).toBe('wasm');
    expect(html2canvasMock).not.toHaveBeenCalled();
  });

  it('falls back to canvas when worker fails', async () => {
    workerOk = false;
    html2canvasMock.mockResolvedValue({
      width: 100,
      height: 50,
      toDataURL: () => 'data:image/png;base64,'
    } as unknown as HTMLCanvasElement);
    const res = await generatePdf({ source: 'hi', previewEl: document.createElement('div') });
    expect(res.via).toBe('canvas');
    expect(html2canvasMock).toHaveBeenCalled();
  });
});

