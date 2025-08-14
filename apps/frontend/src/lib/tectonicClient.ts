import { ENABLE_WASM_TEX } from './flags';
import { compilePdfTeX } from './latexWasm';

export interface CompileHooks {
  getSource: () => Promise<string> | string;
  listProjectFiles?: () => Promise<string[]> | string[];
  readFile?: (path: string) => Promise<Uint8Array>;
}

export interface WorkerCompileResult {
  ok: boolean;
  pdf?: Uint8Array;
  log?: string;
}

let workerPromise: Promise<Worker> | null = null;
async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = import('@/workers/wasm-tectonic.worker?worker').then(W => new W());
  }
  return workerPromise;
}

export async function compileLatexInWorker(hooks: CompileHooks): Promise<WorkerCompileResult> {
  const source = await hooks.getSource();
  if (!ENABLE_WASM_TEX) {
    const r = await compilePdfTeX(source);
    return { ok: true, pdf: r.pdf, log: r.log };
  }
  const worker = await getWorker();
  const files: Record<string, Uint8Array> = {};
  return new Promise(resolve => {
    const messageHandler = (e: MessageEvent<WorkerCompileResult>) => {
      resolve(e.data);
    };
    const errorHandler = (err: ErrorEvent) => {
      resolve({ ok: false, log: String(err.message) });
    };
    worker.addEventListener('message', messageHandler, { once: true });
    worker.addEventListener('error', errorHandler, { once: true });
    worker.postMessage({ latex: source, files, engineOpts: {} });
  });
}
