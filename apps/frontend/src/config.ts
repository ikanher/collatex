// Vite injects environment variables via `import.meta.env` during build time.
// In the browser we don't have access to `process.env`, so rely solely on
// `import.meta.env` with sensible defaults for development.
const env: Record<string, string> =
  typeof import.meta !== 'undefined'
    ? (import.meta as unknown as { env: Record<string, string> }).env
    : {};

export const WS_URL = env.VITE_WS_URL ?? 'ws://localhost:1234';
// Gateway (projects/lock/unlock) on 1234:
export const API_URL = env.VITE_API_ORIGIN ?? 'http://localhost:1234';
export const DEBUG = env.VITE_DEBUG ? env.VITE_DEBUG !== 'false' : true;

export const SWIFTLATEX_ORIGIN = env.VITE_SWIFTLATEX_ORIGIN ?? 'http://localhost:8787';
export const SWIFTLATEX_TOKEN = env.VITE_SWIFTLATEX_TOKEN ?? '';
export const SWIFTLATEX_TIMEOUT_MS = Number(env.VITE_SWIFTLATEX_TIMEOUT_MS ?? '60000');
export const SWIFTLATEX_RETRIES = Number(env.VITE_SWIFTLATEX_RETRIES ?? '2');

export function checkSwiftlatexConfig(): boolean {
  const hasOrigin = !!SWIFTLATEX_ORIGIN;
  const hasToken = !!SWIFTLATEX_TOKEN;
  if (!hasOrigin || !hasToken) {
    console.error(
      '[Export] SwiftLaTeX config missing:',
      'origin set?',
      hasOrigin,
      'token set?',
      hasToken,
    );
    return false;
  }
  return true;
}
