import { describe, it, expect, vi } from 'vitest';
import { startSwiftlatexServer } from './swiftlatexServer';

describe('swiftlatexClient', () => {
  it('returns pdf bytes', async () => {
    const srv = await startSwiftlatexServer([200]);
    vi.stubEnv('VITE_SWIFTLATEX_ORIGIN', srv.url);
    vi.stubEnv('VITE_SWIFTLATEX_TOKEN', 't');
    vi.resetModules();
    const { compile } = await import('../src/lib/swiftlatexClient');
    const { promise } = compile({ mainTex: 'a' });
    const res = await promise;
    await srv.close();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.pdf.length).toBeGreaterThan(0);
  });

  it('retries on 500', async () => {
    vi.useFakeTimers();
    const srv = await startSwiftlatexServer([500, 500, 200]);
    vi.stubEnv('VITE_SWIFTLATEX_ORIGIN', srv.url);
    vi.stubEnv('VITE_SWIFTLATEX_TOKEN', 't');
    vi.resetModules();
    const { compile } = await import('../src/lib/swiftlatexClient');
    const { promise } = compile({ mainTex: 'a' });
    await vi.runAllTimersAsync();
    const res = await promise;
    await srv.close();
    vi.useRealTimers();
    expect(res.ok).toBe(true);
    expect(srv.requests()).toBe(3);
  });

  it('does not retry on 401', async () => {
    const srv = await startSwiftlatexServer([401, 200]);
    vi.stubEnv('VITE_SWIFTLATEX_ORIGIN', srv.url);
    vi.stubEnv('VITE_SWIFTLATEX_TOKEN', 't');
    vi.resetModules();
    const { compile } = await import('../src/lib/swiftlatexClient');
    const { promise } = compile({ mainTex: 'a' });
    const res = await promise;
    await srv.close();
    expect(res.ok).toBe(false);
    expect(srv.requests()).toBe(1);
  });
});
