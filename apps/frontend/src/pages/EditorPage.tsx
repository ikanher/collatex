import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import CodeMirror from '../components/CodeMirror';
import { useProject } from '../hooks/useProject';
import MathJaxPreview from '../components/MathJaxPreview';
import { USE_SERVER_COMPILE } from '../config';
import { logDebug } from '../debug';

const EditorPage: React.FC = () => {
  const { token, gatewayWS } = useProject();
  const [texStr, setTexStr] = useState<string>('');
  const rafRef = useRef<number | null>(null);
  const unsubRef = useRef<() => void>();
  const previewRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string>('');

  const handleShare = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast('Link copied to clipboard');
      setTimeout(() => setToast(''), 1500);
    } catch {
      setToast('Copy failed');
      setTimeout(() => setToast(''), 1500);
    }
  }, []);

  const handleDownloadPdf = React.useCallback(() => {
    const node = previewRef.current;
    if (!node) return;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=1000');
    if (!w) return;
    const html = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>CollaTeX Export</title>
      <style>
        @page { margin: 16mm; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, 'Noto Sans', 'Apple Color Emoji','Segoe UI Emoji'; }
        .mjx-display { margin: 12px 0; }
        pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; }
        .content { white-space: pre-wrap; }
        /* Ensure SVG math renders fully width-wise */
        svg { max-width: 100%; }
      </style>
    </head>
    <body>
      <div class="content">${node.innerHTML}</div>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }, []);

  const scheduleRender = useCallback((text: Y.Text) => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      setTexStr(text.toString());
      rafRef.current = null;
    });
  }, []);

  const handleReady = useCallback(
    (text: Y.Text) => {
      logDebug('editor ready');
      const observer = () => {
        logDebug('ytext changed');
        scheduleRender(text);
      };
      text.observe(observer);
      unsubRef.current = () => text.unobserve(observer);

      setTexStr(text.toString());
      scheduleRender(text);
    },
    [scheduleRender],
  );

  useEffect(() => {
    return () => {
      unsubRef.current?.();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b bg-white/70 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="text-lg font-semibold tracking-tight">CollaTeX</div>
          <div className="text-xs text-gray-500">Realtime LaTeX + MathJax</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={handleShare}>Share</button>
          <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={handleDownloadPdf}>Download PDF</button>
        </div>
      </header>
      <div className="flex-1 min-h-0 flex">
        <div className="w-1/2 h-full min-h-0 flex flex-col border-r">
          {USE_SERVER_COMPILE && (
            <div className="p-2 border-b flex items-center gap-2">
              {/* Future toolbar area */}
            </div>
          )}
          <div className="flex-1 min-h-0 p-2">
            <CodeMirror token={token} gatewayWS={gatewayWS} onReady={handleReady} />
          </div>
        </div>
        <div className="w-1/2 h-full min-h-0 p-2">
          <MathJaxPreview source={texStr} containerRefExternal={previewRef} />
        </div>
      </div>
      <footer className="px-4 py-2 border-t text-xs text-gray-500 flex items-center justify-between">
        <span>© {new Date().getFullYear()} CollaTeX</span>
        <span><a className="underline hover:no-underline" href="https://github.com/ikanher/collatex" target="_blank" rel="noreferrer">GitHub</a></span>
      </footer>
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-3 py-1.5 rounded-md shadow">
          {toast}
        </div>
      )}
    </div>
  );
};

export default EditorPage;
