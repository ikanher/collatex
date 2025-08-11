import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, Lock, RefreshCw, Share2, Unlock } from 'lucide-react';
import CodeMirror from '../components/CodeMirror';
import { useProject } from '../hooks/useProject';
import MathJaxPreview from '../components/MathJaxPreview';
import { API_URL } from '../config';
import { logDebug } from '../debug';
import { compileLatexInWorker } from '../lib/tectonicClient';
import { isServerCompileEnabled, compile as serverCompile } from '../lib/compileAdapter';

const SEED_HINT = 'Type TeX math like \\(' + 'e^{i\\pi}+1=0' + '\\) or $$\\int_0^1 x^2\\,dx$$';

const EditorPage: React.FC = () => {
  const { token, gatewayWS } = useProject();
  const [texStr, setTexStr] = useState<string>('');
  const unsubRef = useRef<() => void>();
  const previewRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string>('');
  const [compiling, setCompiling] = React.useState(false);
  const [compileLog, setCompileLog] = React.useState<string>('');
  const [locked, setLocked] = useState<boolean>(false);
  const ownerKey = React.useMemo(
    () => localStorage.getItem(`collatex:ownerKey:${token}`) ?? '',
    [token],
  );

  async function refreshState() {
    const res = await fetch(`${API_URL}/projects/${token}`);
    if (res.ok) {
      const data = await res.json();
      setLocked(Boolean(data.locked));
    }
  }
  useEffect(() => {
    if (token) refreshState();
  }, [token]);

  async function lockProject() {
    const res = await fetch(`${API_URL}/projects/${token}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerKey }),
    });
    if (res.ok) {
      setLocked(true);
    } else {
      /* toast error */
    }
  }
  async function unlockProject() {
    const res = await fetch(`${API_URL}/projects/${token}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerKey }),
    });
    if (res.ok) {
      setLocked(false);
    } else {
      await res.json().catch(() => ({}));
      // show 409 w/ message "active recently" to user
    }
  }

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
    setCompiling(true);
    setCompileLog('');
    try {
      // Try browser WASM first
      let pdfBytes: Uint8Array | null = null;
      try {
        const { pdf, log } = await compileLatexInWorker({
          getSource: () => texStr,
        });
        if (log) setCompileLog(log);
        if (pdf && pdf.length > 0) pdfBytes = pdf;
      } catch (e) {
        console.warn('WASM compile failed, falling back to client render:', e);
      }
      if (!pdfBytes) {
        if (isServerCompileEnabled) {
          const res = await serverCompile();
          if (res.ok && res.pdf) {
            pdfBytes = res.pdf;
            if (res.log) setCompileLog(res.log);
          }
        }
        if (!pdfBytes) {
          const node = previewRef.current;
          if (!node) throw new Error('preview missing');
          const canvas = await html2canvas(node, { scale: 2 });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
          const width = pdf.internal.pageSize.getWidth();
          const height = (canvas.height * width) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, width, height);
          pdfBytes = new Uint8Array(pdf.output('arraybuffer'));
        }
      }
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
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
  }, [texStr, token, compiling, previewRef]);

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
    <div className="h-screen flex flex-col bg-white">
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-100 text-gray-800">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold tracking-tight">CollaTeX</span>
          <span className="text-sm opacity-80">Realtime LaTeX + MathJax</span>
        </div>
        <div className="flex items-center gap-2 flex-nowrap">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${locked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {locked ? 'Locked' : 'Unlocked'}
          </span>
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600" onClick={refreshState}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {ownerKey && (locked ? (
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600" onClick={unlockProject}>
              <Unlock className="w-4 h-4" />
              Unlock
            </button>
          ) : (
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600" onClick={lockProject}>
              <Lock className="w-4 h-4" />
              Lock
            </button>
          ))}
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500 text-white hover:bg-teal-600" onClick={handleShare}>
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-60"
            onClick={handleDownloadPdf}
            disabled={compiling}
            aria-busy={compiling}
          >
            {compiling ? (
              'Compiling…'
            ) : (
              <>
                <Download className="w-4 h-4" />
                {isServerCompileEnabled ? 'Download PDF' : 'Export PDF'}
              </>
            )}
          </button>
          {compileLog && (
            <details className="ml-2 text-xs text-gray-700">
              <summary>Show LaTeX log</summary>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-black bg-white/80 p-2 rounded">{compileLog}</pre>
            </details>
          )}
        </div>
      </header>

      <main className="flex-1 h-full min-h-0 flex gap-2 p-2 bg-gray-50">
        <section className="flex-1 h-full min-h-0 flex flex-col rounded-md border">
          <div className="flex-1 min-h-0 p-2">
            <CodeMirror
              token={token}
              gatewayWS={gatewayWS}
              onReady={handleReady}
              onChange={text => logDebug('onChange (Yjs path) len=', text.toString().length)}
              onDocChange={handleDocChange}
              readOnly={locked}
            />
          </div>
        </section>
        <aside className="flex-1 h-full min-h-0 rounded-md border p-2 overflow-auto" ref={previewRef}>
          <MathJaxPreview source={texStr.trim() ? texStr : SEED_HINT} />
        </aside>
      </main>

      <footer className="px-4 py-2 border-t border-gray-200 bg-gray-100 text-xs text-gray-800 flex items-center justify-between">
        <span>© {new Date().getFullYear()} CollaTeX</span>
        <a className="underline hover:no-underline text-gray-800" href="https://github.com/ikanher/collatex" target="_blank" rel="noreferrer">
          GitHub
        </a>
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
