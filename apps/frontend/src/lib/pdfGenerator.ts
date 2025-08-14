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
  onStatus?.('Loading Tectonic…');
  await Promise.resolve();
  try {
    onStatus?.('Compiling…');
    const r = await compileLatexInWorker({ getSource: () => source });
    if (r.ok && r.pdf) {
      return { blob: new Blob([r.pdf], { type: 'application/pdf' }), log: r.log, via: 'wasm' };
    }
    if (r.log) {
      // WASM provided log but no pdf
      return { log: r.log, error: 'WASM compile failed', via: 'wasm' };
    }
  } catch (err) {
    return { error: String(err), via: 'wasm' };
  }

  if (isServerCompileEnabled) {
    onStatus?.('Compiling on server…');
    const res = await serverCompile(source);
    if (res.ok && res.pdf) {
      return { blob: new Blob([res.pdf], { type: 'application/pdf' }), log: res.log, via: 'server' };
    }
    if (res.log) {
      onStatus?.('Server compile failed');
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
  return { blob: new Blob([pdfBytes], { type: 'application/pdf' }), via: 'canvas' };
}
