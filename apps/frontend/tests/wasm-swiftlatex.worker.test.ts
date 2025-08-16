import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompileResponse } from '../src/workers/wasm-swiftlatex.worker';

vi.mock('../src/lib/flags', () => ({ ENABLE_WASM_TEX: true }));

describe('wasm-swiftlatex worker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns pdf bytes from engine', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          "class PdfTeXEngine { async loadEngine(){} writeMemFSFile(){} setEngineMainFile(){} async compileLaTeX(){ return { pdf: new Uint8Array([1]), log: '' }; }}",
        headers: { get: () => 'application/javascript' },
      }))
    );
    const messages: CompileResponse[] = [];
    const selfRef: any = { postMessage: (msg: CompileResponse) => messages.push(msg) };
    vi.stubGlobal('self', selfRef);
    await import('../src/workers/wasm-swiftlatex.worker');
    await selfRef.onmessage({ data: { latex: 'hi', engineOpts: {} } });
    expect(messages[0].ok).toBe(true);
    expect(messages[0].pdf?.length).toBeGreaterThan(0);
  });

  it('reports missing assets on unexpected response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => 'Not Found',
        headers: { get: () => 'text/html' },
      }))
    );
    const messages: CompileResponse[] = [];
    const selfRef: any = { postMessage: (msg: CompileResponse) => messages.push(msg) };
    vi.stubGlobal('self', selfRef);
    await import('../src/workers/wasm-swiftlatex.worker');
    await selfRef.onmessage({ data: { latex: 'hi', engineOpts: {} } });
    expect(messages[0].ok).toBe(false);
    expect(messages[0].error).toBe('swiftlatex_assets_missing');
  });
});
