import { ENABLE_WASM_TEX } from './flags';
import type { CompileResponse } from '@/workers/wasm-tectonic.worker';

export interface CompileHooks {
  getSource: () => Promise<string> | string;
  listProjectFiles?: () => Promise<string[]> | string[];
  readFile?: (path: string) => Promise<Uint8Array>;
}

export interface WorkerCompileResult {
  pdf: Uint8Array;
  log: string;
}

export async function compileLatexInWorker(hooks: CompileHooks): Promise<WorkerCompileResult> {
  const source = await hooks.getSource();
  if (!ENABLE_WASM_TEX) {
    const err = new Error('wasm_tex_disabled');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).log = '';
    throw err;
  }

  const WorkerCtor = (await import('@/workers/wasm-tectonic.worker?worker')).default;
  const worker: Worker = new WorkerCtor();
  const files: Record<string, Uint8Array> = {};

  try {
    const res = await new Promise<CompileResponse>((resolve, reject) => {
      const messageHandler = (e: MessageEvent<CompileResponse>) => resolve(e.data);
      const errorHandler = (err: ErrorEvent) => reject(new Error(err.message));
      worker.addEventListener('message', messageHandler, { once: true });
      worker.addEventListener('error', errorHandler, { once: true });
      worker.postMessage({ latex: source, files, engineOpts: {} });
    });

    if (!res.ok || !res.pdf || res.pdf.length === 0) {
      const err = new Error(res.error || 'WASM compile failed');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).log = res.log;
      throw err;
    }

    return { pdf: res.pdf, log: res.log };
  } finally {
    worker.terminate();
  }
}
