// Tectonic is loaded at runtime from the public assets folder.
// @ts-expect-error - provided by runtime bundle, no type declarations
const loadTectonic = async () => {
  const modulePath = '/tectonic/tectonic_init.js';
  return (await import(/* @vite-ignore */ modulePath)).default;
};

let enginePromise: Promise<unknown> | null = null;
async function getEngine() {
  if (!enginePromise) {
    enginePromise = loadTectonic().then(init => (init as any)('/tectonic/tectonic.wasm')); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  return enginePromise;
}

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

self.onmessage = async (e: MessageEvent<CompileRequest>) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine: any = await getEngine();
    const fs = engine.fs || engine.FS; // eslint-disable-line @typescript-eslint/no-explicit-any
    const enc = new TextEncoder();
    fs.writeFile('/main.tex', enc.encode(e.data.latex));
    for (const [name, data] of Object.entries(e.data.files || {})) {
      fs.writeFile(`/${name}`, data);
    }
    const logs: string[] = [];
    if (engine.stderr) engine.stderr = (s: string) => logs.push(s);
    if (engine.stdout) engine.stdout = (s: string) => logs.push(s);
    await engine.compile('/main.tex', e.data.engineOpts || {});
    const pdf: Uint8Array = fs.readFile('/main.pdf');
    self.postMessage({ ok: true, pdf, log: logs.join('\n') } as CompileResponse);
  } catch (err) {
    self.postMessage({ ok: false, log: String(err) } as CompileResponse);
  }
};

export default {} as unknown as Worker;
