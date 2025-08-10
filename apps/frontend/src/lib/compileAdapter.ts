export const isServerCompileEnabled =
  import.meta.env.VITE_ENABLE_SERVER_COMPILE === 'true';

const compileUrl = import.meta.env.VITE_COMPILE_ORIGIN;

export async function compile(tex: string, project: string): Promise<
  { ok: true; pdf: Uint8Array; log?: string } | { ok: false; reason: string }
> {
  if (!isServerCompileEnabled || !compileUrl) {
    return { ok: false, reason: 'Server compile disabled' };
  }
  const res = await fetch(`${compileUrl}/compile?project=${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tex }),
  });
  if (!res.ok) {
    return { ok: false, reason: `compile enqueue failed: ${res.status}` };
  }
  const { jobId } = await res.json();
  const statusUrl = `${compileUrl}/jobs/${encodeURIComponent(jobId)}?project=${encodeURIComponent(project)}`;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    const s = await fetch(statusUrl);
    if (!s.ok) continue;
    const body = await s.json();
    if (body.status === 'SUCCEEDED' && body.pdfUrl) {
      const pdfRes = await fetch(`${compileUrl}${body.pdfUrl}`);
      if (!pdfRes.ok) {
        return { ok: false, reason: 'pdf fetch failed' };
      }
      const blob = await pdfRes.blob();
      const pdf = new Uint8Array(await blob.arrayBuffer());
      return { ok: true, pdf, log: body.log ? String(body.log).slice(-4000) : undefined };
    }
    if (body.status === 'FAILED') {
      const log = (body.log || '').slice(-4000);
      return { ok: false, reason: `server compile failed:\n${log}` };
    }
  }
  return { ok: false, reason: 'server compile timeout' };
}

export async function* streamLogs(): AsyncGenerator<string, void, unknown> {
  if (!isServerCompileEnabled || !compileUrl) {
    return;
  }
  const url = `${compileUrl}/logs`; // placeholder
  const source = new EventSource(url);
  const queue: string[] = [];
  source.onmessage = e => queue.push(e.data);
  try {
    while (true) {
      if (queue.length) {
        yield queue.shift()!;
      } else {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } finally {
    source.close();
  }
}
