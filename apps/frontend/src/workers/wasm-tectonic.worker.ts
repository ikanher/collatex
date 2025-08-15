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

// Load the Tectonic engine from public assets. If loading fails, reject so the
// caller can trigger the canvas fallback in the main thread.
async function getEngine() {
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    try {
      const t = '/tectonic/tectonic_init.js';
      console.log('[Worker] Attempting to load Tectonic WASM from /tectonic/tectonic_init.js');
      const resp = await fetch(t);
      if (!resp.ok) {
        throw new Error(resp.status === 404 ? 'tectonic_assets_missing' : 'tectonic_unavailable');
      }
      const source = await resp.text();
      const type = resp.headers.get('content-type') || '';
      if (!type.includes('javascript') || source.trim().startsWith('Not Found')) {
        throw new Error('tectonic_assets_missing');
      }
      const initMod = await import(
        /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(source)}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const engine = await (initMod as any).default('/tectonic/tectonic.wasm');
      console.log('[Worker] Tectonic engine loaded successfully.');
      return engine;
    } catch (e) {
      console.error('[Worker] Failed to load Tectonic WASM:', e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Failed to fetch') || msg.includes('404') || msg === 'tectonic_assets_missing') {
        throw new Error('tectonic_assets_missing');
      }
      throw new Error('tectonic_unavailable');
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

    if ('stdout' in engine) engine.stdout = (s: string) => logs.push(s);
    if ('stderr' in engine) engine.stderr = (s: string) => logs.push(s);

    const result = await engine.compileLaTeX?.(e.data.engineOpts || {});
    const pdf: Uint8Array | undefined = result?.pdf;
    const log = [logs.join('\n'), result?.log || ''].filter(Boolean).join('\n');

    if (pdf && pdf.length) {
      self.postMessage({ ok: true, pdf, log } as CompileResponse, [pdf.buffer]);
    } else {
      self.postMessage({ ok: false, log, error: 'tectonic_unavailable' } as CompileResponse);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'tectonic_unavailable';
    self.postMessage({ ok: false, log: logs.join('\n'), error: msg } as CompileResponse);
  }
};

export default {} as unknown as Worker;

