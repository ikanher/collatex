import { ENABLE_WASM_TEX } from './flags';
import { compilePdfTeX } from './latexWasm';

export interface CompileHooks {
  getSource: () => Promise<string> | string;
  listProjectFiles?: () => Promise<string[]> | string[];
  readFile?: (path: string) => Promise<Uint8Array>;
}

export async function compileLatexInWorker(hooks: CompileHooks): Promise<{ pdf: Uint8Array; log?: string }> {
  const source = await hooks.getSource();
  if (!ENABLE_WASM_TEX) {
    return compilePdfTeX(source);
  }
  const W = (await import('@/workers/wasm-tectonic.worker?worker')).default;
  const worker: Worker = new W();
  const files: Record<string, Uint8Array> = {};
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<unknown>) => {
      worker.terminate();
      resolve(e.data as { pdf: Uint8Array; log?: string });
    };
    worker.onerror = err => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage({ latex: source, files, engineOpts: {} });
  });
}
