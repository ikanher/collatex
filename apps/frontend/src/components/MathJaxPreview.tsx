import React, { useEffect, useRef, useState } from 'react';

function extractFirstMath(src: string): { math: string; display: boolean } | null {
  // $$ ... $$
  let m = src.match(/\$\$([\s\S]*?)\$\$/);
  if (m) return { math: m[1], display: true };
  // \[ ... \]
  m = src.match(/\\\[([\s\S]*?)\\\]/);
  if (m) return { math: m[1], display: true };
  // \( ... \)
  m = src.match(/\\\(([\s\S]*?)\\\)/);
  if (m) return { math: m[1], display: false };
  // $ ... $
  m = src.match(/\$([^$]+)\$/);
  if (m) return { math: m[1], display: false };
  // Fallback: if the string has TeX-like commands, treat the whole thing as math
  if (/\\[a-zA-Z]+|[_^{}]/.test(src.trim())) {
    return { math: src.trim(), display: false };
  }
  return null;
}

interface Props {
  source: string;
}

const MathJaxPreview: React.FC<Props> = ({ source }) => {
  const containerRef = useRef<HTMLDivElement>(null);
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
        const seg = extractFirstMath(trimmed);
        if (!seg) {
          container.textContent = 'No math delimiters found. Use \\(...\\) or $$ ... $$';
          rafRef.current = null;
          return;
        }
        // IMPORTANT: do not sanitize TeX before convert()
        const node = doc.convert(seg.math, { display: seg.display });
        container.appendChild(node as unknown as Node);
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

  return <div ref={containerRef} className="p-2 overflow-auto h-full" />;
};

export default MathJaxPreview;
