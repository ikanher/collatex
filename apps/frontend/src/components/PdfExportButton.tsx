import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generatePdf } from '@/lib/pdfGenerator';

interface Props {
  getSource: () => string;
  previewRef: React.RefObject<HTMLElement>;
}

const PdfExportButton: React.FC<Props> = ({ getSource, previewRef }) => {
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [log, setLog] = React.useState('');

  const handleClick = async () => {
    if (busy) return;
    const previewEl = previewRef.current;
    if (!previewEl) return;
    setBusy(true);
    setLog('');
    setStatus('Loading engine…');
    try {
      const res = await generatePdf({ source: getSource(), previewEl, onStatus: setStatus });
      if (res.log) setLog(res.log);
      if (res.blob) {
        const url = URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.pdf';
        a.click();
        URL.revokeObjectURL(url);
      } else if (res.error) {
        // eslint-disable-next-line no-alert
        alert(res.error);
      }
    } catch (err) {
      setLog(String(err));
      // eslint-disable-next-line no-alert
      alert('PDF generation failed');
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <div className="inline-block">
      <Button variant="default" size="sm" className="gap-1" onClick={handleClick} disabled={busy} aria-busy={busy}>
        {busy ? status || 'Compiling…' : (
          <>
            <Download className="size-4" />
            Export PDF
          </>
        )}
      </Button>
      {log && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary>View log</summary>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-foreground bg-card/80 p-2 rounded">{log}</pre>
        </details>
      )}
    </div>
  );
};

export default PdfExportButton;
