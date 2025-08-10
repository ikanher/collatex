export type CompileResult = { pdf: Uint8Array; log?: string };

let enginePromise: Promise<any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
const ENGINE_URL = '/latexwasm/PdfTeXEngine.js';

const SPECIALS: Record<string, string> = {
  '#': '\\#',
  '%': '\\%',
  '&': '\\&',
  '_': '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

export function escapeLatexOutsideMath(src: string): string {
  const parts = src.split(/(\$\$.*?\$\$|\$.*?\$)/gs);
  return parts
    .map((seg, i) => (i % 2 ? seg : seg.replace(/[#%&_{}~^]/g, m => SPECIALS[m] || m)))
    .join('');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPdfTeX(): Promise<any> {
  if (enginePromise) return enginePromise;
  enginePromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = ENGINE_URL;
    s.async = true;
    s.onload = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g: any = window as any;
        const LaTeXEngine = g.LaTeXEngine || g.PdfTeXEngine || g.default || g.engine || null;
        if (!LaTeXEngine) {
          return reject(
            new Error(
              'PdfTeXEngine loaded but global symbol not found. Check build docs for the correct global name.',
            ),
          );
        }
        const engine = new LaTeXEngine();
        await engine.loadEngine();
        resolve(engine);
      } catch (e) {
        reject(e);
      }
    };
    s.onerror = () => reject(new Error(`Failed to load ${ENGINE_URL}. Is the file in /public/latexwasm/?`));
    document.head.appendChild(s);
  });
  return enginePromise;
}

export function toLatexDocument(src: string): string {
  const s = (src ?? '').trim();
  if (/\\documentclass\\b/.test(s) || /\\begin\\{document\\}/.test(s)) return src;
  const body = escapeLatexOutsideMath(s);
  return [
    '\\documentclass[11pt]{article}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage{amsmath,amssymb}',
    '\\usepackage{lmodern}',
    '\\pagestyle{empty}',
    '\\begin{document}',
    body.length ? body : '% empty',
    '\\end{document}',
  ].join('\\n');
}

// compile via browser PdfTeX if available
export async function tryCompilePdfWasm(source: string): Promise<CompileResult> {
  const engine = await loadPdfTeX();
  engine.flushCache?.();
  const doc = toLatexDocument(source);
  engine.writeMemFSFile('main.tex', doc);
  engine.setEngineMainFile('main.tex');
  const r = await engine.compileLaTeX();
  return { pdf: r?.pdf ?? new Uint8Array(), log: r?.log };
}

// fallback: server compile endpoint
export async function compilePdfServer(source: string, apiOrigin: string): Promise<Uint8Array> {
  const doc = toLatexDocument(source);
  const res = await fetch(`${apiOrigin}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tex: doc }),
  });
  if (!res.ok) throw new Error(`server compile failed ${res.status}`);
  const blob = await res.blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  return buf;
}

