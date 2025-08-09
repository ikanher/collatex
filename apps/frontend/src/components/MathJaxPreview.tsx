import React, { useEffect, useRef, useState } from 'react';

function tokenize(
  src: string,
): Array<{ kind: 'text' | 'math'; value: string; display?: boolean }> {
  const parts: Array<{ kind: 'text' | 'math'; value: string; display?: boolean }> = [];
  // Order matters: display forms before inline to avoid greedy $...$ swallowing $$...$$
  const patterns = [
    { re: /\$\$([\s\S]*?)\$\$/g, display: true },
    { re: /\\\[([\s\S]*?)\\\]/g, display: true },
    { re: /\\\(([\s\S]*?)\\\)/g, display: false },
    // single $...$ (not $$), exclude $$ by negative lookahead/lookbehind
    { re: /(?<!\$)\$([^$\n]+)\$(?!\$)/g, display: false },
  ];
  let idx = 0;
  // Build a merged list of matches across all patterns without losing order
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
  for (const m of matches) {
    if (m.start > idx) {
      parts.push({ kind: 'text', value: src.slice(idx, m.start) });
    }
    parts.push({ kind: 'math', value: m.math, display: m.display });
    idx = m.end;
  }
  if (idx < src.length) {
    parts.push({ kind: 'text', value: src.slice(idx) });
  }
  return parts;
}

interface Props {
  source: string;
  containerRefExternal?: React.RefObject<HTMLDivElement>;
}

const MathJaxPreview: React.FC<Props> = ({ source, containerRefExternal }) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = containerRefExternal ?? internalRef;
  const mjRef = useRef<unknown>(null);
  const rafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  // Lazy-load MathJax core on first mount to avoid bloating the bundle.
  useEffect(() => {
    let cancelled = false;
    async function init() {
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
        mjRef.current = { doc, adaptor };
        setReady(true);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  function scheduleRender() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const { doc } = mjRef.current as {
        doc: { convert: (s: string, o?: unknown) => unknown };
      };
      const container = containerRef.current!;
      container.innerHTML = '';
      const trimmed = source.trim();
      if (!trimmed) {
        container.textContent =
          'Type TeX math like \\(e^{i\\pi}+1=0\\) or $$\\int_0^1 x^2\\,dx$$';
        rafRef.current = null;
        return;
      }
      try {
        const parts = tokenize(source);
        if (parts.length === 0) {
          container.textContent = 'No math delimiters found. Use \\(...\\) or $$ ... $$';
        } else {
          for (const p of parts) {
            if (p.kind === 'text') {
              container.appendChild(document.createTextNode(p.value));
            } else {
              const node = doc.convert(p.value, { display: p.display });
              container.appendChild(node as unknown as Node);
            }
          }
        }
      } catch (e) {
        container.textContent = 'TeX error: ' + (e as Error).message;
      } finally {
        rafRef.current = null;
      }
    });
  }

  useEffect(() => {
    if (!mjRef.current || !ready) {
      return;
    }
    scheduleRender();
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [source, ready]);

  return (
    <div
      ref={containerRef}
      className="p-2 overflow-auto h-full whitespace-pre-wrap"
    />
  );
};

export default MathJaxPreview;

