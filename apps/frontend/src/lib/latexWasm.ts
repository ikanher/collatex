export type CompileResult = { pdf: Uint8Array; log: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let enginePromise: Promise<any> | null = null;
const ENGINE_URL = '/latexwasm/PdfTeXEngine.js';

const SPECIALS = { '#': '\\#', '%': '\\%', '&': '\\&', '_': '\\_', '{': '\\{', '}': '\\}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' };

function escapeLatexOutsideMath(src: string): string {
  // Split into math / non-math segments
  const parts = src.split(/(\$\$.*?\$\$|\$.*?\$)/gs);
  return parts.map((seg, i) => {
    if (i % 2 === 1) return seg; // math region, leave intact
    return seg.replace(/[#%&_{}~^]/g, m => SPECIALS[m as keyof typeof SPECIALS] || m);
  }).join('');
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
        // Try common globals exposed by engine builds
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g: any = window as any;
        const LaTeXEngine = g.LaTeXEngine || g.PdfTeXEngine || g.default || g.engine || null;
        if (!LaTeXEngine) {
          return reject(
            new Error(
              `PdfTeXEngine loaded but global symbol not found. Check build docs for the correct global name.`,
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
  const s = src.trim();
  if (/\\documentclass\\b/.test(s) || /\\begin\\{document\\}/.test(s)) return src;
  const safeBody = escapeLatexOutsideMath(s);
  return [
    '\\documentclass[11pt]{article}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage{amsmath,amssymb}',
    '\\usepackage{lmodern}',
    '\\pagestyle{empty}',
    '\\begin{document}',
    safeBody.length ? safeBody : '% empty body',
    '\\end{document}'
  ].join('\\n');
}

export async function compilePdfTeX(
  mainTex: string,
  files: Record<string, string> = {},
): Promise<CompileResult> {
  const engine = await loadPdfTeX();
  engine.flushCache?.();
  const doc = toLatexDocument(mainTex);
  engine.writeMemFSFile('main.tex', doc);
  for (const [name, content] of Object.entries(files)) engine.writeMemFSFile(name, content);
  engine.setEngineMainFile('main.tex');
  const r = await engine.compileLaTeX();
  if (!r || !r.pdf) throw new Error('Compilation failed: no PDF array returned');
  if (!('length' in r.pdf) || r.pdf.length === 0) {
    throw new Error(r.log && r.log.trim() ? `PDF empty. Log:\n${r.log}` : 'PDF empty and no log produced.');
  }
  return { pdf: r.pdf, log: r.log ?? '' };
}

// Optional: XeTeX entry (enable when you copy XeTeXEngine assets)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function compileXeTeX(mainTex: string, _files?: Record<string, string>): Promise<CompileResult> {
  // Same pattern as PdfTeX but load '/latexwasm/XeTeXEngine.js' and new LaTeXEngine()
  // If you need ICU data for proper CJK line breaks, mount it here with writeMemFSFile().
  throw new Error('XeTeX path not wired yet');
}
