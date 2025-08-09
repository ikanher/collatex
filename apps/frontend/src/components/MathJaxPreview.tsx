import React, { useEffect, useRef, useState } from 'react';
import type { MathDocument } from 'mathjax-full/js/core/MathDocument.js';
interface Props {
  source: string;
  containerRefExternal?: React.RefObject<HTMLDivElement>;
}

// Tokenize TeX spans: $$...$$, \[...\], \(...\), and safe $...$
function tokenize(src: string): Array<{ kind: 'text' | 'math'; value: string; display?: boolean }> {
  type Span = { start: number; end: number; math: string; display: boolean };
  const spans: Span[] = [];

  function pushMatches(re: RegExp, display: boolean) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, math: m[1], display });
    }
  }

  // 1) Collect display spans first
  pushMatches(/\$\$([\s\S]*?)\$\$/g, true); // $$ ... $$
  pushMatches(/\\\[([\s\S]*?)\\\]/g, true); // \[ ... \]

  // Sort & merge overlapping display spans
  spans.sort((a, b) => a.start - b.start);
  const displaySpans: Span[] = [];
  for (const s of spans) {
    if (!s.display) continue;
    const last = displaySpans[displaySpans.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
      last.math = '';
    } else {
      displaySpans.push({ ...s });
    }
  }

  const insideDisplay = (a: number, b: number) =>
    displaySpans.some(d => a >= d.start && b <= d.end);

  // 2) Add \(...\) inline spans
  const inlineParens: Span[] = [];
  {
    const re = /\\\(([\s\S]*?)\\\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (!insideDisplay(start, end)) {
        inlineParens.push({ start, end, math: m[1], display: false });
      }
    }
  }

  // 3) Add safe $...$ inline spans
  const inlineDollar: Span[] = [];
  {
    const re = /\$([^$\n]+)\$/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const prev = start > 0 ? src[start - 1] : '';
      const next = end < src.length ? src[end] : '';
      const escaped = start > 0 && src[start - 1] === '\\';
      if (!escaped && prev !== '$' && next !== '$' && !insideDisplay(start, end)) {
        inlineDollar.push({ start, end, math: m[1], display: false });
      }
    }
  }

  const all: Span[] = [...displaySpans, ...inlineParens, ...inlineDollar];
  all.sort((a, b) => a.start - b.start || (a.end - a.start) - (b.end - b.start));
  const picked: Span[] = [];
  for (const s of all) {
    const last = picked[picked.length - 1];
    if (!last || s.start >= last.end) picked.push(s);
  }

  const parts: Array<{ kind: 'text' | 'math'; value: string; display?: boolean }> = [];
  let cursor = 0;
  for (const s of picked) {
    if (s.start > cursor) parts.push({ kind: 'text', value: src.slice(cursor, s.start) });
    parts.push({ kind: 'math', value: s.math, display: s.display });
    cursor = s.end;
  }
  if (cursor < src.length) parts.push({ kind: 'text', value: src.slice(cursor) });
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

