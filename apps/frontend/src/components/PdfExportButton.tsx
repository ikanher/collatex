import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generatePdf } from '@/lib/pdfGenerator';

interface Props {
  getSource: () => string;
}

const PdfExportButton: React.FC<Props> = ({ getSource }) => {
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [log, setLog] = React.useState('');
  const [error, setError] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const controllerRef = React.useRef<AbortController | null>(null);
  const opRef = React.useRef(0);

  const handleClick = async () => {
    opRef.current += 1;
    const myOp = opRef.current;
    controllerRef.current?.abort();
    setBusy(true);
    setLog('');
    try {
      const { controller, result } = generatePdf({ source: getSource(), onStatus: setStatus });
      controllerRef.current = controller;
      const res = await result;
      if (opRef.current !== myOp) return;
      if (res.log) setLog(res.log);
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (opRef.current !== myOp) return;
      setLog(String(err));
      setError('PDF generation failed');
      setDialogOpen(true);
    } finally {
      if (opRef.current === myOp) {
        setBusy(false);
        setStatus('');
      }
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PDF export failed</DialogTitle>
            <DialogDescription>{error}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
