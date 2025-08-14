import { toLatexDocument } from '@/lib/latexWasm';

interface CompileRequest {
  latex: string;
  files: Record<string, Uint8Array>;
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

// Try to load the Tectonic engine. If it fails, fall back to the PdfTeXEngine
// shipped under /public/latexwasm/.
async function getEngine() {
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    try {
      // @ts-expect-error - loaded from public assets at runtime
      const initMod = await import(/* @vite-ignore */ '/tectonic/tectonic_init.js');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (initMod as any).default('/tectonic/tectonic.wasm');
    } catch {
      // PdfTeXEngine is a non-module script; load via importScripts.
      await new Promise<void>((resolve, reject) => {
        try {
          // eslint-disable-next-line no-restricted-globals
          importScripts('/latexwasm/PdfTeXEngine.js');
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g: any = self as any;
      const Ctor = g.PdfTeXEngine || g.LaTeXEngine || g.default;
      if (!Ctor) throw new Error('PdfTeXEngine not found');
      const engine = new Ctor();
      await engine.loadEngine?.();
      return engine;
    }
  })();

  return enginePromise;
}

self.onmessage = async (e: MessageEvent<CompileRequest>) => {
  const logs: string[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine: any = await getEngine();

    engine.flushCache?.();

    const src = toLatexDocument(e.data.latex);
    engine.writeMemFSFile?.('main.tex', src);
    engine.setEngineMainFile?.('main.tex');

    for (const [name, data] of Object.entries(e.data.files || {})) {
      engine.writeMemFSFile?.(name, data);
    }

    if ('stdout' in engine) engine.stdout = (s: string) => logs.push(s);
    if ('stderr' in engine) engine.stderr = (s: string) => logs.push(s);

    const result = await engine.compileLaTeX?.(e.data.engineOpts || {});

    let pdf: Uint8Array | undefined = result?.pdf;
    let log = result?.log || '';

    // Some engines (e.g. Tectonic) write the output file to a virtual FS.
    if (!pdf && (engine.readMemFSFile || engine.readFile)) {
      pdf = engine.readMemFSFile?.('main.pdf') || engine.readFile?.('main.pdf');
    }

    log = [logs.join('\n'), log].filter(Boolean).join('\n');

    if (pdf && pdf.length > 0) {
      self.postMessage({ ok: true, pdf, log } as CompileResponse, [pdf.buffer]);
    } else {
      self.postMessage({ ok: false, log } as CompileResponse);
    }
  } catch (err) {
    self.postMessage({
      ok: false,
      log: logs.join('\n'),
      error: String(err),
    } as CompileResponse);
  }
};

export default {} as unknown as Worker;

