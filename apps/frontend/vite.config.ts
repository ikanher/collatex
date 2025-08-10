import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiOrigin = env.VITE_API_ORIGIN || 'http://localhost:1234';
  const compileOrigin = env.VITE_COMPILE_ORIGIN || 'http://localhost:8080';
  const wsOrigin = env.VITE_WS_URL || 'ws://localhost:1234';

  return {
    plugins: [react()],
    server: {
      headers: {
        // Dev-only: allow inline/eval for Vite client & React refresh
        'Content-Security-Policy':
          "default-src 'self'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          `connect-src 'self' ${apiOrigin} ${compileOrigin} ${wsOrigin}`,
      },
    },
  };
});
