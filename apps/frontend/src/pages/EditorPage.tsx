import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import CodeMirror from '../components/CodeMirror';
import { useProject } from '../hooks/useProject';
import MathJaxPreview from '../components/MathJaxPreview';
import { API_URL, COMPILE_URL, USE_SERVER_COMPILE } from '../config';
import { logDebug } from '../debug';
import { compilePdfTeX } from '../lib/latexWasm';

async function compileViaServer(tex: string, token: string): Promise<Uint8Array> {
  // Wrap in minimal LaTeX in the backend too; keep as-is here, backend expects raw TeX string.
  const res = await fetch(`${COMPILE_URL}/compile?project=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tex }),
  });
  if (!res.ok) throw new Error(`compile enqueue failed: ${res.status}`);
  const { jobId } = await res.json();
  // Poll job status
  const statusUrl = `${COMPILE_URL}/jobs/${encodeURIComponent(jobId)}?project=${encodeURIComponent(token)}`;
  let tries = 0;
  while (tries++ < 60) {
    await new Promise(r => setTimeout(r, 500));
    const s = await fetch(statusUrl);
    if (!s.ok) continue;
    const body = await s.json();
    if (body.status === 'SUCCEEDED' && body.pdfUrl) {
      const pdfRes = await fetch(`${COMPILE_URL}${body.pdfUrl}`);
      if (!pdfRes.ok) throw new Error('pdf fetch failed');
      const blob = await pdfRes.blob();
      return new Uint8Array(await blob.arrayBuffer());
    }
    if (body.status === 'FAILED') {
      const log = (body.log || '').slice(-4000);
      throw new Error(`server compile failed:\n${log}`);
    }
  }
  throw new Error('server compile timeout');
}

const SEED_HINT = 'Type TeX math like \\(e^{i\\pi}+1=0\\) or $$\\int_0^1 x^2\\,dx$$';

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
        const { pdf, log } = await compilePdfTeX(texStr);
        if (log) setCompileLog(log);
        if (pdf && pdf.length > 0) pdfBytes = pdf;
      } catch (e) {
        // WASM missing or failed — fall back silently
        console.warn('WASM compile failed, falling back to client render:', e);
      }
      if (!pdfBytes) {
        if (USE_SERVER_COMPILE) {
          pdfBytes = await compileViaServer(texStr, token);
        } else {
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
    <div className="min-h-screen flex flex-col bg-white">
      <header className="flex items-center justify-between px-4 py-2 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold tracking-tight">CollaTeX</span>
          <span className="text-sm text-gray-500">Realtime LaTeX + MathJax</span>
        </div>
        <div className="flex items-center gap-2 flex-nowrap">
          <span className={`text-xs px-2 py-0.5 rounded ${locked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {locked ? 'Locked' : 'Unlocked'}
          </span>
          <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={refreshState}>
            Refresh
          </button>
          {ownerKey && (locked ? (
            <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={unlockProject}>
              Unlock
            </button>
          ) : (
            <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={lockProject}>
              Lock
            </button>
          ))}
          <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={handleShare}>
            Share
          </button>
          <button
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            onClick={handleDownloadPdf}
            disabled={compiling}
            aria-busy={compiling}
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

      <main className="flex-1 min-h-0 flex">
        <section className="w-1/2 h-full min-h-0 flex flex-col border-r">
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
        <aside className="w-1/2 h-full min-h-0 p-2">
          <MathJaxPreview source={texStr.trim() ? texStr : SEED_HINT} />
        </aside>
      </main>

      <footer className="px-4 py-2 border-t text-xs text-gray-500 flex items-center justify-between">
        <span>© {new Date().getFullYear()} CollaTeX</span>
        <a className="underline hover:no-underline" href="https://github.com/ikanher/collatex" target="_blank" rel="noreferrer">
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
