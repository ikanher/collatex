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
