import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { compile } from './compileAdapter';

export interface GeneratePdfOptions {
  source: string;
  onStatus?: (msg: string) => void;
}

export interface GeneratePdfResult {
  blob: Blob;
  log?: string;
  via: 'remote' | 'screenshot';
}

async function screenshotPdf(): Promise<Blob> {
  const canvas = await html2canvas(document.body);
  const img = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'pt', [canvas.width, canvas.height]);
  pdf.addImage(img, 'PNG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
}

export function generatePdf({ source, onStatus }: GeneratePdfOptions) {
  onStatus?.('Compiling…');
  const { controller, result } = compile(source);
  const wrapped = result.then(async (res) => {
    if (res.ok && res.pdf) {
      return {
        blob: new Blob([res.pdf], { type: 'application/pdf' }),
        log: res.log,
        via: 'remote' as const,
      };
    }
    const warn = `⚠ Remote compile failed (reason: ${res.error}). Falling back to screenshot export.`;
    const log = [res.log, warn].filter(Boolean).join('\n');
    onStatus?.('Rendering screenshot…');
    const blob = await screenshotPdf();
    return { blob, log, via: 'screenshot' as const };
  });
  return { controller, result: wrapped };
}
