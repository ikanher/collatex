import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { compileLatexInWorker } from './tectonicClient';
import { compile as serverCompile, isServerCompileEnabled } from './compileAdapter';

export interface GeneratePdfOptions {
  source: string;
  previewEl: HTMLElement;
  onStatus?: (msg: string) => void;
}

export interface GeneratePdfResult {
  blob?: Blob;
  log?: string;
  error?: string;
  via: 'wasm' | 'server' | 'canvas';
}

export async function generatePdf({ source, previewEl, onStatus }: GeneratePdfOptions): Promise<GeneratePdfResult> {
  onStatus?.('Loading engine…');
  await Promise.resolve();
  let log = '';

  try {
    onStatus?.('Compiling…');
    const r = await compileLatexInWorker({ getSource: () => source });
    return { blob: new Blob([r.pdf], { type: 'application/pdf' }), log: r.log, via: 'wasm' };
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log = (err as any)?.log || '';
  }

  if (isServerCompileEnabled) {
    onStatus?.('Compiling on server…');
    try {
      const res = await serverCompile(source);
      if (res.ok && res.pdf) {
        return { blob: new Blob([res.pdf], { type: 'application/pdf' }), log: res.log || log, via: 'server' };
      }
      log = res.log || log;
    } catch {
      /* ignore */
    }
  }

  onStatus?.('Rendering preview…');
  const canvas = await html2canvas(previewEl, { scale: 2 });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const width = pdf.internal.pageSize.getWidth();
  const height = (canvas.height * width) / canvas.width;
  pdf.addImage(imgData, 'PNG', 0, 0, width, height);
  const pdfBytes = new Uint8Array(pdf.output('arraybuffer'));
  return { blob: new Blob([pdfBytes], { type: 'application/pdf' }), log, via: 'canvas' };
}
