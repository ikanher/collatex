import React, { useEffect, useRef, useState } from 'react';

interface Props {
  source: string;
  containerRefExternal?: React.RefObject<HTMLDivElement>;
}

interface MathJaxApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  html: any; // MathJax MathDocument
  adaptor: unknown;
}

const MathJaxPreview: React.FC<Props> = ({ source, containerRefExternal }) => {
  const containerRef = containerRefExternal ?? useRef<HTMLDivElement>(null);
  const mjRef = useRef<MathJaxApi | null>(null);
  const [ready, setReady] = useState(false);
  const versionRef = useRef(0); // bump per source change to cancel stale renders
  const timerRef = useRef<number | null>(null); // debounce timer

  // Init MathJax once
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
      const tex = new TeX({
        packages: ['base', 'ams'],
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true,
        processEnvironments: true,
      });
      const svg = new SVG({ fontCache: 'none' });
      // Bind to window.document; we'll scope findMath/typeset to our container
      const html = mathjax.document(window.document, { InputJax: tex, OutputJax: svg });
      if (!cancelled) {
        mjRef.current = { html, adaptor };
        setReady(true);
      }
    })().catch(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Render with debounce and stale-cancel
  useEffect(() => {
    if (!ready) return;
    const v = ++versionRef.current;
    const container = containerRef.current!;

    // Clear any pending debounce
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // If empty, show hint and skip typeset
    const trimmed = source.trim();
    if (!trimmed) {
      container.textContent = 'Type TeX math like \\(e^{i\\pi}+1=0\\) or $$\\int_0^1 x^2\\,dx$$';
      return;
    }

    // Debounce a bit to avoid hammering MathJax while typing
    timerRef.current = window.setTimeout(async () => {
      // If another render started, drop this one
      if (v !== versionRef.current) return;
      const mj = mjRef.current;
      if (!mj) {
        container.textContent = 'MathJax failed to initialize.';
        return;
      }
      // Write text content (no HTML), then typeset only this container
      container.textContent = source;
      try {
        mj.html.clear();
        mj.html.findMath({ elements: [container] });
        await mj.html.typesetPromise([container]);
      } catch (e) {
        container.textContent = 'TeX error: ' + (e as Error).message;
      }
    }, 60); // 60–100ms feels good

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [source, ready]);

  return <div ref={containerRef} className="p-2 overflow-auto h-full whitespace-pre-wrap" />;
};

export default MathJaxPreview;

