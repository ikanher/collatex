import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiOrigin = process.env.VITE_API_ORIGIN || 'http://localhost:8080';
const wsOrigin = process.env.VITE_WS_URL || 'ws://localhost:1234';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.VITE_API_ORIGIN': JSON.stringify(apiOrigin),
    'process.env.VITE_WS_URL': JSON.stringify(wsOrigin),
  },
  server: {
    headers: {
      // Dev-only: allow inline/eval for Vite client & React refresh
      'Content-Security-Policy':
        "default-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        `connect-src 'self' ${apiOrigin} ${wsOrigin} /latexwasm`,
    },
  },
});
