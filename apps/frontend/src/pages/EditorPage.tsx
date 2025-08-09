import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

  const handleDownloadPdf = React.useCallback(async () => {
    const node = previewRef.current;
    if (!node) return;
    // Render at higher scale for clarity
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    let remaining = imgHeight;
    // Add pages if content exceeds one page
    while (remaining > 0) {
      // Add the image; jsPDF positions it at (0, y) on each page
      pdf.addImage(imgData, 'PNG', 0, y ? -y : 0, imgWidth, imgHeight);
      remaining -= pageHeight;
      y += pageHeight;
      if (remaining > 0) pdf.addPage();
    }
    pdf.save('collatex.pdf');
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
        logDebug('ytext changed (Yjs)');
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
            <CodeMirror
              token={token}
              gatewayWS={gatewayWS}
              onReady={handleReady}
              onChange={text => scheduleRender(text)}
              onDocChange={value => {
                // Belt-and-suspenders: update from CodeMirror directly.
                if (rafRef.current) return;
                rafRef.current = requestAnimationFrame(() => {
                  setTexStr(value);
                  rafRef.current = null;
                });
              }}
            />
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
