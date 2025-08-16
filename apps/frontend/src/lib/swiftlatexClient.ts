import { SWIFTLATEX_ORIGIN, SWIFTLATEX_TOKEN, SWIFTLATEX_TIMEOUT_MS, SWIFTLATEX_RETRIES } from '@/config';

export interface CompileRequest {
  mainTex: string;
  files?: Record<string, Uint8Array>;
}

export type CompileResult =
  | { ok: true; pdf: Uint8Array; log?: string }
  | { ok: false; error: string; log?: string; status?: number };

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function doCompile(
  req: CompileRequest,
  signal: AbortSignal
): Promise<CompileResult> {
  const body = JSON.stringify({ main: req.mainTex, files: req.files ?? {} });
  try {
    const res = await fetch(`${SWIFTLATEX_ORIGIN}/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SWIFTLATEX_TOKEN}`,
      },
      body,
      signal,
    });
    const status = res.status;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const truncated = text.slice(0, 200);
      return { ok: false, error: truncated || `HTTP ${status}`, status };
    }
    const buf = await res.arrayBuffer();
    const log = res.headers.get('x-tex-log') ?? undefined;
    return { ok: true, pdf: new Uint8Array(buf), log };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    return { ok: false, error: 'network_error' };
  }
}

export function compile(req: CompileRequest) {
  const outer = new AbortController();
  const retries = Math.max(0, SWIFTLATEX_RETRIES);
  const timeoutMs = Math.max(1, SWIFTLATEX_TIMEOUT_MS);

  const run = async (): Promise<CompileResult> => {
    let attempt = 0;
    while (true) {
      const attemptCtrl = new AbortController();
      const onAbort = () => attemptCtrl.abort();
      outer.signal.addEventListener('abort', onAbort);
      const timer = setTimeout(() => attemptCtrl.abort(), timeoutMs);
      const res = await doCompile(req, attemptCtrl.signal);
      clearTimeout(timer);
      outer.signal.removeEventListener('abort', onAbort);
      if (outer.signal.aborted) {
        return { ok: false, error: 'timeout' };
      }
      if (
        res.ok ||
        !(res.status && (res.status === 429 || res.status >= 500)) ||
        attempt >= retries
      ) {
        return res;
      }
      attempt++;
      await sleep(2 ** attempt * 1000);
    }
  };

  return { controller: outer, promise: run() };
}
