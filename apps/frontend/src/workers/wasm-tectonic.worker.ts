import initTectonic from '/tectonic/tectonic_init.js';

export interface CompileRequest {
  latex: string;
  files: Record<string, Uint8Array>;
  engineOpts?: Record<string, unknown>;
}

export interface CompileResponse {
  ok: boolean;
  pdf?: Uint8Array;
  log: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
self.onmessage = async (_e: MessageEvent<CompileRequest>) => {
  try {
    const engine = await initTectonic('/tectonic/tectonic.wasm');
    // TODO: wire file system and actual compilation
    engine; // silence unused
      self.postMessage({ ok: false, log: 'Tectonic WASM compilation not implemented yet' } as CompileResponse);
  } catch (err) {
    self.postMessage({ ok: false, log: String(err) } as CompileResponse);
  }
};

export default {} as unknown as Worker;
