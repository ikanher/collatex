import { describe, it, expect, vi } from 'vitest';
import type { CompileResponse } from '../src/workers/wasm-tectonic.worker';

vi.mock('../src/lib/flags', () => ({ ENABLE_WASM_TEX: true }));
vi.mock('/tectonic/tectonic_init.js', () => ({
  default: vi.fn(async () => ({
    compileLaTeX: () => ({ pdf: new Uint8Array([1]), log: '' }),
    writeMemFSFile: vi.fn(),
    setEngineMainFile: vi.fn(),
    flushCache: vi.fn(),
  })),
}));

describe('wasm-tectonic worker', () => {
  it('returns pdf bytes from engine', async () => {
    const messages: CompileResponse[] = [];
    const selfRef: any = { postMessage: (msg: CompileResponse) => messages.push(msg) };
    vi.stubGlobal('self', selfRef);
    await import('../src/workers/wasm-tectonic.worker');
    await selfRef.onmessage({ data: { latex: 'hi', files: {}, engineOpts: {} } });
    expect(messages[0].ok).toBe(true);
    expect(messages[0].pdf?.length).toBeGreaterThan(0);
  });
});
