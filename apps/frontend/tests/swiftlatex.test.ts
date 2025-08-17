import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  delete (process.env as any).VITE_SWIFTLATEX_ORIGIN;
  delete (process.env as any).VITE_SWIFTLATEX_TOKEN;
});

describe('compileWithSwiftLatex', () => {
  it('returns a PDF blob', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/pdf' }),
      blob: () => Promise.resolve(blob),
    });
    vi.stubGlobal('fetch', fetchMock);
    (process.env as any).VITE_SWIFTLATEX_ORIGIN = 'https://swift';
    (process.env as any).VITE_SWIFTLATEX_TOKEN = 't';
    const { compileWithSwiftLatex } = await import('../src/lib/swiftlatex');
    const res = await compileWithSwiftLatex('a');
    expect(res.type).toBe('application/pdf');
  });

  it('throws on 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('unauthorized'),
      headers: new Headers({ 'Content-Type': 'text/plain' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    (process.env as any).VITE_SWIFTLATEX_ORIGIN = 'https://swift';
    (process.env as any).VITE_SWIFTLATEX_TOKEN = 't';
    const { compileWithSwiftLatex } = await import('../src/lib/swiftlatex');
    await expect(compileWithSwiftLatex('a')).rejects.toThrow(/401/);
  });
});
