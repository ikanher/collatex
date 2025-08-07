import React, { useEffect, useRef, useState } from 'react';
// TODO(security): replace better-xss with stricter AST-based sanitizer.
import sanitize from '../lib/better-xss';

interface Props {
  source: string;
}

const MathJaxPreview: React.FC<Props> = ({ source }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mjRef = useRef<any>();
  const timeoutRef = useRef<number>();
  const [ready, setReady] = useState(false);

  // Lazy-load MathJax core on first mount to avoid bloating the bundle.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }] = await Promise.all([
        import('mathjax-full/js/mathjax.js'),
        import('mathjax-full/js/input/tex.js'),
        import('mathjax-full/js/output/svg.js'),
        import('mathjax-full/js/adaptors/liteAdaptor.js'),
        import('mathjax-full/js/handlers/html.js'),
      ]);
      const adaptor = liteAdaptor();
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

  useEffect(() => {
    if (!mjRef.current || !ready) {
      return;
    }
    const clean = sanitize(source);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      const { doc } = mjRef.current!;
      const container = containerRef.current!;
      container.innerHTML = '';
      if (!clean.trim()) {
        container.textContent = 'Start typing…';
        return;
      }
      const node = doc.convert(clean, { display: false });
      container.appendChild(node as unknown as Node);
    }, 100);
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, [source, ready]);

  return <div ref={containerRef} className="p-2 overflow-auto h-full" />;
};

export default MathJaxPreview;
