import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { compileLatexInWorker } from './tectonicClient';
import { compile as serverCompile, isServerCompileEnabled } from './compileAdapter';

export interface GeneratePdfOptions {
  source: string;
  previewEl: HTMLElement;
  onStatus?: (msg: string) => void;
  wasmEnabled: boolean;
}

export interface GeneratePdfResult {
  blob?: Blob;
  log?: string;
  error?: string;
  via: 'wasm' | 'server' | 'canvas';
}

export async function generatePdf({ source, previewEl, onStatus, wasmEnabled }: GeneratePdfOptions): Promise<GeneratePdfResult> {
  onStatus?.('Loading engine…');
  await Promise.resolve();
  let log = '';

  if (wasmEnabled) {
    try {
      onStatus?.('Compiling…');
      const r = await compileLatexInWorker({ getSource: () => source });
      console.log(
        '[Export] WASM compile finished. PDF length:',
        r.pdf?.length || 0,
        'Log length:',
        r.log?.length || 0
      );
      return { blob: new Blob([r.pdf], { type: 'application/pdf' }), log: r.log, via: 'wasm' };
    } catch (err) {
      console.error('[Export] WASM compile failed:', err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      log = (err as any)?.log || '';
      if ((err as Error).message === 'tectonic_assets_missing') {
        console.error(
          '[Export] Tectonic assets missing in build output. Check /tectonic/tectonic_init.js and /tectonic/tectonic.wasm.'
        );
        log = [
          log,
          '❌ Tectonic assets missing in build output. Screenshot export used instead.',
        ]
          .filter(Boolean)
          .join('\n');
      } else {
        log = [log, '⚠ Tectonic unavailable, falling back to screenshot export.']
          .filter(Boolean)
          .join('\n');
      }
    }
  } else {
    log = [log, '⚠ WASM compile skipped due to feature flag or config. Using screenshot export.']
      .filter(Boolean)
      .join('\n');
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
