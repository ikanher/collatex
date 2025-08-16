import { compileLatexInWorker } from './swiftlatexClient';
import { compile as serverCompile, isServerCompileEnabled } from './compileAdapter';

export interface GeneratePdfOptions {
  source: string;
  onStatus?: (msg: string) => void;
  wasmEnabled: boolean;
}

export interface GeneratePdfResult {
  blob?: Blob;
  log?: string;
  error?: string;
  via?: 'wasm' | 'server';
}

export async function generatePdf({ source, onStatus, wasmEnabled }: GeneratePdfOptions): Promise<GeneratePdfResult> {
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
      return { error: 'SwiftLaTeX PDF engine unavailable.', log };
    }
  } else {
    log = [log, '⚠ WASM compile disabled via feature flag or config.']
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

  return { error: 'SwiftLaTeX PDF engine unavailable.', log };
}
