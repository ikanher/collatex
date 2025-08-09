import React, { useEffect, useRef, useState } from 'react';
import type { MathDocument } from 'mathjax-full/js/core/MathDocument.js';
interface Props {
  source: string;
  containerRefExternal?: React.RefObject<HTMLDivElement>;
}

// Lookbehind-free tokenizer for $$...$$, \[...\], \(...\), $...$
function tokenize(src: string): Array<{ kind: 'text' | 'math'; value: string; display?: boolean }> {
  const parts: Array<{ kind: 'text' | 'math'; value: string; display?: boolean }> = [];
  // Build a merged match list without using lookbehind
  type M = { start: number; end: number; math: string; display: boolean };
  const matches: M[] = [];

  function pushAll(re: RegExp, display: boolean) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, math: m[1], display });
    }
  }

  // Order matters: handle display before inline
  pushAll(/\$\$([\s\S]*?)\$\$/g, true);           // $$...$$
  pushAll(/\\\[([\s\S]*?)\\\]/g, true);           // \[...\]
  pushAll(/\\\(([\s\S]*?)\\\)/g, false);          // \(...\)

  // Inline $...$ without lookbehind: manually exclude $$...$$ by post-filtering
  // We match $...$ and later drop those that are part of $$...$$ matches
  const inlineMatches: M[] = [];
  {
    const re = /\$([^$\n]+)\$/g;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      inlineMatches.push({ start: m.index, end: m.index + m[0].length, math: m[1], display: false });
    }
  }
  // Remove inline hits that are inside display $$...$$ blocks we already captured
  function isInsideAny(start: number, end: number, blocks: M[]): boolean {
    return blocks.some(b => start >= b.start && end <= b.end);
  }
  const displayBlocks = matches.filter(m => m.display);
  for (const im of inlineMatches) {
    if (!isInsideAny(im.start, im.end, displayBlocks)) matches.push(im);
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
  const mjRef = useRef<{ doc: MathDocument<unknown, unknown, unknown> } | null>(null);
  const rafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
      } catch (e) {
        if (!cancelled) {
          mjRef.current = null;
          setReady(true); // allow render to show error state
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function scheduleRender() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const container = containerRef.current!;
      container.innerHTML = '';
      const trimmed = source.trim();
      if (!trimmed) {
        container.textContent = 'Type TeX math like \\(e^{i\\pi}+1=0\\) or $$\\int_0^1 x^2\\,dx$$';
        rafRef.current = null;
        return;
      }
      if (!mjRef.current || typeof mjRef.current.doc.convert !== 'function') {
        container.textContent = 'MathJax failed: doc.convert missing';
        rafRef.current = null;
        return;
      }
      try {
        const { doc } = mjRef.current;
        const parts = tokenize(source);
        if (parts.length === 0) {
          container.appendChild(document.createTextNode(source)); // fallback: plain text
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
    if (!ready) return;
    console.debug('[debug] MathJaxPreview render source len=', source.length, 'ready=', ready);
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

