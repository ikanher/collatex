export const isServerCompileEnabled = import.meta.env.VITE_ENABLE_SERVER_COMPILE === 'true';

export interface ServerCompileResult {
  ok: boolean;
  reason?: string;
  log?: string;
  pdf?: Uint8Array;
}

export async function compile(latex: string): Promise<ServerCompileResult> {
  if (!isServerCompileEnabled) {
    return { ok: false, reason: 'disabled' };
  }
  try {
    const res = await fetch('/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: latex,
    });
    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status}` };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    // server may send log in a header
    const log = res.headers.get('x-tex-log') ?? undefined;
    return { ok: true, pdf: buf, log };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

export function streamLogs(): AsyncGenerator<string> {
  if (!isServerCompileEnabled) {
    return (async function* () {})();
  }
  return (async function* () {})();
}
