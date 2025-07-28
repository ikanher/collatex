// Vite injects environment variables via `import.meta.env` during build time.
// In the browser we don't have access to `process.env`, so rely solely on
// `import.meta.env` with sensible defaults for development.
const env = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) as Record<string, string>;

export const WS_URL = env.VITE_WS_URL ?? 'ws://localhost:1234';
export const API_URL = env.VITE_API_ORIGIN ?? 'http://localhost:8080';
