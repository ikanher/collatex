import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { initBusyTeX, compileToPdf } from '@/lib/wasmTex';

interface Props {
  getSource: () => string;
}

const PdfExportButton: React.FC<Props> = ({ getSource }) => {
  const [status, setStatus] = React.useState<'idle' | 'init' | 'compile'>('idle');
  const [error, setError] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleClick = async () => {
    setStatus('init');
    setError('');
    try {
      await initBusyTeX();
      setStatus('compile');
      const pdf = await compileToPdf(getSource(), { engine: 'xetex' });
      const url = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err && err.stage === 'init') {
        setError('LaTeX engine missing. Run "npm run fetch:busytex" and reload.');
      } else if (err && err.stage === 'compile' && err.log) {
        const lines = String(err.log).split('\n').slice(0, 20).join('\n');
        setError(`${err.message || 'Compile failed'}\n${lines}\nTry engine=pdftex.`);
      } else {
        setError(String(err));
      }
      setDialogOpen(true);
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="inline-block">
      <Button
        variant="default"
        size="sm"
        className="gap-1"
        onClick={handleClick}
        disabled={status !== 'idle'}
        aria-busy={status !== 'idle'}
      >
        {status === 'init'
          ? 'Initializing LaTeX engine (WASM)…'
          : status === 'compile'
            ? 'Compiling…'
            : (
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
    </div>
  );
};

export default PdfExportButton;
