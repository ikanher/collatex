export const isServerCompileEnabled = import.meta.env.VITE_ENABLE_SERVER_COMPILE === 'true';

export async function compile(): Promise<{ ok: false; reason: string; log?: string; pdf?: Uint8Array }> {
  if (!isServerCompileEnabled) {
    return { ok: false, reason: 'disabled' };
  }
  return { ok: false, reason: 'not-implemented' };
}

export function streamLogs(): AsyncGenerator<string> {
  if (!isServerCompileEnabled) {
    return (async function* () {})();
  }
  return (async function* () {})();
}
