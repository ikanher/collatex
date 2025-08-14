import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { compileLatexInWorker } from '../src/lib/tectonicClient';

vi.mock('../src/lib/flags', () => ({ ENABLE_WASM_TEX: true }));

class FakeWorker {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: string, cb: any) {
    if (type === 'message') this.onmessage = cb;
    if (type === 'error') this.onerror = cb;
  }
  postMessage() {
    setTimeout(() => {
      this.onmessage?.({ data: { ok: true, pdf: new Uint8Array([1, 2, 3]), log: '' } });
    }, 0);
  }
  terminate() {}
}

vi.mock('../src/workers/wasm-tectonic.worker?worker', () => ({ default: FakeWorker }));

describe('compileLatexInWorker', () => {
  const load = (name: string) =>
    readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

  it('compiles minimal.tex', async () => {
    const { pdf } = await compileLatexInWorker({ getSource: () => load('minimal.tex') });
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('compiles math.tex', async () => {
    const { pdf } = await compileLatexInWorker({ getSource: () => load('math.tex') });
    expect(pdf.length).toBeGreaterThan(0);
  });
});
