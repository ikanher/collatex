import { toLatexDocument } from '@/lib/latexWasm';

interface CompileRequest {
  latex: string;
  engineOpts?: Record<string, unknown>;
}

export interface CompileResponse {
  ok: boolean;
  pdf?: Uint8Array;
  log: string;
  error?: string;
}

// Cache the WASM engine inside the worker so subsequent compiles avoid reloading.
let enginePromise: Promise<unknown> | null = null;

// Load the SwiftLaTeX engine from public assets. If loading fails, reject so the
// caller can trigger the canvas fallback in the main thread.
async function getEngine() {
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    try {
      const mod = await import(/* @vite-ignore */ '/swiftlatex/XeTeXEngine.js');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const engine: any = new (mod.XeTeXEngine ?? mod.default ?? mod)();
      await engine.loadEngine?.();
      console.log('[Worker] SwiftLaTeX engine loaded successfully.');
      return engine;
    } catch (e) {
      console.error('[Worker] Failed to load SwiftLaTeX WASM:', e);
      throw new Error('swiftlatex_assets_missing');
    }
  })();

  return enginePromise;
}

self.onmessage = async (e: MessageEvent<CompileRequest>) => {
  const logs: string[] = [];
  console.log('[Worker] Received compile request. Latex length:', e.data.latex.length);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine: any = await getEngine();

    const src = toLatexDocument(e.data.latex);
    engine.writeMemFSFile?.('main.tex', src);
    engine.setEngineMainFile?.('main.tex');

    const result = await engine.compileLaTeX?.(e.data.engineOpts || {});
    const pdf: Uint8Array | undefined = result?.pdf;
    const log = [logs.join('\n'), result?.log || ''].filter(Boolean).join('\n');

    if (pdf && pdf.length) {
      self.postMessage({ ok: true, pdf, log } as CompileResponse, [pdf.buffer]);
    } else {
      self.postMessage({ ok: false, log, error: 'swiftlatex_unavailable' } as CompileResponse);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'swiftlatex_unavailable';
    self.postMessage({ ok: false, log: logs.join('\n'), error: msg } as CompileResponse);
  }
};

export default {} as unknown as Worker;

