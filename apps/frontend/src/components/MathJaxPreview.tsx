import React, { useEffect, useRef, useState } from 'react';
interface Props {
  source: string;
  containerRefExternal?: React.RefObject<HTMLDivElement>;
}

// Tokenize into plain text and TeX blocks
function tokenize(src: string): Array<{ kind: 'text' | 'math'; value: string; display?: boolean }> {
  const parts: Array<{ kind: 'text' | 'math'; value: string; display?: boolean }> = [];
  const patterns = [
    { re: /\$\$([\s\S]*?)\$\$/g, display: true },
    { re: /\\\[([\s\S]*?)\\\]/g, display: true },
    { re: /\\\(([\s\S]*?)\\\)/g, display: false },
    { re: /(?<!\$)\$([^$\n]+)\$(?!\$)/g, display: false },
  ];
  type M = { start: number; end: number; math: string; display: boolean };
  const matches: M[] = [];
  for (const p of patterns) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(src)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, math: m[1], display: p.display });
    }
  }
  matches.sort((a, b) => a.start - b.start);
  let idx = 0;
  for (const m of matches) {
    if (m.start > idx) parts.push({ kind: 'text', value: src.slice(idx, m.start) });
    parts.push({ kind: 'math', value: m.math, display: m.display });
    idx = m.end;
  }
  if (idx < src.length) parts.push({ kind: 'text', value: src.slice(idx) });
  return parts;
}

const MathJaxPreview: React.FC<Props> = ({ source, containerRefExternal }) => {
  const containerRef = containerRefExternal ?? useRef<HTMLDivElement>(null);
  const mjRef = useRef<unknown>(null);
  const rafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ mathjax }, { TeX }, { SVG }, { browserAdaptor }, { RegisterHTMLHandler }] = await Promise.all([
        import('mathjax-full/js/mathjax.js'),
        import('mathjax-full/js/input/tex.js'),
        import('mathjax-full/js/output/svg.js'),
        import('mathjax-full/js/adaptors/browserAdaptor.js'),
        import('mathjax-full/js/handlers/html.js'),
      ]);
      const adaptor = browserAdaptor();
      RegisterHTMLHandler(adaptor);
      const tex = new TeX({ packages: ['base', 'ams'] });
      const svg = new SVG({ fontCache: 'none' });
      const doc = mathjax.document('', { InputJax: tex, OutputJax: svg });
      if (!cancelled) {
        mjRef.current = { doc };
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function scheduleRender() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      try {
        const { doc } = mjRef.current as { doc: { convert: (s: string, o?: unknown) => unknown } };
        const container = containerRef.current!;
        const trimmed = source.trim();
        container.innerHTML = '';
        if (!trimmed) {
          container.textContent = 'Type TeX math like \\(e^{i\\pi}+1=0\\) or $$\\int_0^1 x^2\\,dx$$';
          return;
        }
        const parts = tokenize(source);
        if (parts.length === 0) {
          container.textContent = 'No math delimiters found. Use \\(...\\) or $$ ... $$';
          return;
        }
        for (const p of parts) {
          if (p.kind === 'text') {
            container.appendChild(document.createTextNode(p.value));
          } else {
            const node = doc.convert(p.value, { display: p.display });
            container.appendChild(node as unknown as Node);
          }
        }
      } catch (e) {
        const container = containerRef.current!;
        container.textContent = 'TeX error: ' + (e as Error).message;
      } finally {
        rafRef.current = null;
      }
    });
  }

  useEffect(() => {
    if (!ready || !mjRef.current) return;
    scheduleRender();
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [source, ready]);

  return <div ref={containerRef} className="p-2 overflow-auto h-full whitespace-pre-wrap" />;
};

export default MathJaxPreview;
