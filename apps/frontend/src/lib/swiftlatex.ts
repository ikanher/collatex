export async function compileWithSwiftLatex(
  source: string,
  opts?: { engine?: 'xetex' | 'pdftex'; timeoutMs?: number }
): Promise<Blob> {
  const env = (typeof import.meta !== 'undefined' ? ((import.meta as any).env as Record<string, string>) : {}) as Record<
    string,
    string
  >;
  const origin = env.VITE_SWIFTLATEX_ORIGIN || (process.env as any).VITE_SWIFTLATEX_ORIGIN;
  const token = env.VITE_SWIFTLATEX_TOKEN || (process.env as any).VITE_SWIFTLATEX_TOKEN;
  if (!origin || !token) {
    throw new Error(
      'SwiftLaTeX isn\u2019t configured. Set VITE_SWIFTLATEX_ORIGIN and VITE_SWIFTLATEX_TOKEN in your environment and reload.'
    );
  }
  const timeoutMs =
    opts?.timeoutMs ??
    Number(env.VITE_SWIFTLATEX_TIMEOUT_MS || (process.env as any).VITE_SWIFTLATEX_TIMEOUT_MS || '60000');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${origin}/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ engine: opts?.engine ?? 'xetex', tex: source }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const first = text.split('\n')[0].slice(0, 200);
    throw new Error(`SwiftLaTeX error ${res.status}: ${first}`);
  }
  const ct = res.headers.get('Content-Type')?.split(';')[0];
  if (ct !== 'application/pdf') {
    const text = await res.text().catch(() => '');
    const first = text.split('\n')[0].slice(0, 200);
    throw new Error(`SwiftLaTeX unexpected content-type ${ct || 'unknown'}: ${first}`);
  }
  if (controller.signal.aborted) {
    throw new Error('SwiftLaTeX request timed out');
  }
  return res.blob();
}
