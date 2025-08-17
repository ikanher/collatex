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
import { compileWithSwiftLatex } from '@/lib/swiftlatex';

interface Props {
  getSource: () => string;
}

const PdfExportButton: React.FC<Props> = ({ getSource }) => {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleClick = async () => {
    setBusy(true);
    setError('');
    try {
      const pdf = await compileWithSwiftLatex(getSource(), { engine: 'xetex' });
      const url = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(String(err));
      setDialogOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-block">
      <Button variant="default" size="sm" className="gap-1" onClick={handleClick} disabled={busy} aria-busy={busy}>
        {busy ? 'Compiling…' : (
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
            <Button variant="secondary" asChild>
              <a
                href="https://github.com/ikanher/collatex#remote-swiftlatex-pdf-compilation"
                target="_blank"
                rel="noreferrer"
              >
                Configure SwiftLaTeX
              </a>
            </Button>
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
