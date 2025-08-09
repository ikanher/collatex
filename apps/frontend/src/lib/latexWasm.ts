export type CompileResult = { pdf: Uint8Array; log: string };

let enginePromise: Promise<unknown> | null = null;

function loadPdfTeX(): Promise<unknown> {
  if (enginePromise) return enginePromise;
  enginePromise = new Promise((resolve, reject) => {
    // Dynamically insert the engine script served from /public
    const s = document.createElement('script');
    s.src = '/latexwasm/PdfTeXEngine.js';
    s.async = true;
    s.onload = async () => {
      try {
        // global provided by the engine script
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const LaTeXEngine = (window as any).LaTeXEngine;
        if (!LaTeXEngine) return reject(new Error('LaTeXEngine not found on window'));
        const engine = new LaTeXEngine();
        await engine.loadEngine(); // per docs
        resolve(engine);
      } catch (e) {
        reject(e);
      }
    };
    s.onerror = () => reject(new Error('Failed to load PdfTeXEngine.js'));
    document.head.appendChild(s);
  });
  return enginePromise;
}

export async function compilePdfTeX(mainTex: string, files: Record<string, string> = {}): Promise<CompileResult> {
  const engine = (await loadPdfTeX()) as any;
  // reset memfs to avoid leftovers
  engine.flushCache?.();
  // write main file and any extras
  engine.writeMemFSFile('main.tex', mainTex);
  for (const [name, content] of Object.entries(files)) {
    engine.writeMemFSFile(name, content);
  }
  engine.setEngineMainFile('main.tex');
  const r = await engine.compileLaTeX(); // returns { pdf (Uint8Array), log (string) }
  if (!r || !r.pdf) throw new Error('Compilation failed: no PDF produced');
  return { pdf: r.pdf, log: r.log ?? '' };
}

// Optional: XeTeX entry (enable when you copy XeTeXEngine assets)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function compileXeTeX(mainTex: string, _files?: Record<string, string>): Promise<CompileResult> {
  // Same pattern as PdfTeX but load '/latexwasm/XeTeXEngine.js' and new LaTeXEngine()
  // If you need ICU data for proper CJK line breaks, mount it here with writeMemFSFile().
  throw new Error('XeTeX path not wired yet');
}

