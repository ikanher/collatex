import React, { useEffect, useRef, useState } from 'react';
// TODO(security): replace better-xss with stricter AST-based sanitizer.
import sanitize from '../lib/better-xss';

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
      const clean = sanitize(source);
      container.innerHTML = '';
      const trimmed = clean.trim();
      if (!trimmed) {
        container.textContent =
          'Type TeX math like \\(e^{i\\pi}+1=0\\) or $$\\int_0^1 x^2\\,dx$$';
        rafRef.current = null;
        return;
      }
      try {
        const isDisplay = clean.includes('$$') || clean.includes('\\[');
        const node = doc.convert(clean, { display: isDisplay });
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
