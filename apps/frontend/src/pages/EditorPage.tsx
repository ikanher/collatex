import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import CodeMirror from '../components/CodeMirror';
import { useProject } from '../hooks/useProject';
import MathJaxPreview from '../components/MathJaxPreview';
import { USE_SERVER_COMPILE } from '../config';
import { logDebug } from '../debug';
import { compilePdfTeX } from '../lib/latexWasm';

const EditorPage: React.FC = () => {
  const { token, gatewayWS } = useProject();
  const [texStr, setTexStr] = useState<string>('');
  const unsubRef = useRef<() => void>();
  const [toast, setToast] = useState<string>('');
  const [compiling, setCompiling] = React.useState(false);
  const [compileLog, setCompileLog] = React.useState<string>('');

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

  const handleDownloadPdf = React.useCallback(async () => {
    if (compiling) return;
    const src = texStr || '%% empty document';
    setCompiling(true);
    setCompileLog('');
    try {
      const { pdf, log } = await compilePdfTeX(src);
      setCompileLog(log ?? '');
      const blob = new Blob([pdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'collatex.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setCompileLog(String(e));
    } finally {
      setCompiling(false);
    }
  }, [texStr, compiling]);

  const handleReady = useCallback(
    (text: Y.Text) => {
      logDebug('editor ready');
      const observer = () => {
        logDebug('ytext changed (Yjs)');
        setTexStr(text.toString());
      };
      text.observe(observer);
      unsubRef.current = () => text.unobserve(observer);

      setTexStr(text.toString());
    },
    [],
  );

  const handleDocChange = useCallback((value: string) => {
    logDebug('onDocChange (CM path) len=', value.length);
    setTexStr(value);
  }, []);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
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
          <button
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            onClick={handleDownloadPdf}
            disabled={compiling}
          >
            {compiling ? 'Compiling…' : 'Download PDF'}
          </button>
          {compileLog && (
            <details className="ml-2 text-xs text-gray-600">
              <summary>Show LaTeX log</summary>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap">{compileLog}</pre>
            </details>
          )}
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
            <CodeMirror
              token={token}
              gatewayWS={gatewayWS}
              onReady={handleReady}
              onChange={text => {
                // Optional extra: log Yjs local changes if they do arrive
                logDebug('onChange (Yjs path) len=', text.toString().length);
              }}
              onDocChange={handleDocChange}
            />
          </div>
        </div>
        <div className="w-1/2 h-full min-h-0 p-2">
          <MathJaxPreview source={texStr} />
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
