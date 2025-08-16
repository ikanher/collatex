import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiOrigin = process.env.VITE_API_ORIGIN || 'http://localhost:1234';
const wsOrigin = process.env.VITE_WS_URL || 'ws://localhost:1234';
const swiftlatexOrigin = process.env.VITE_SWIFTLATEX_ORIGIN || 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  define: {
    'process.env.VITE_API_ORIGIN': JSON.stringify(apiOrigin),
    'process.env.VITE_WS_URL': JSON.stringify(wsOrigin),
    'process.env.VITE_SWIFTLATEX_ORIGIN': JSON.stringify(swiftlatexOrigin),
    'process.env.VITE_SWIFTLATEX_TOKEN': JSON.stringify(process.env.VITE_SWIFTLATEX_TOKEN || ''),
    'process.env.VITE_SWIFTLATEX_TIMEOUT_MS': JSON.stringify(process.env.VITE_SWIFTLATEX_TIMEOUT_MS || ''),
    'process.env.VITE_SWIFTLATEX_RETRIES': JSON.stringify(process.env.VITE_SWIFTLATEX_RETRIES || ''),
  },
  server: {
    headers: {
      "Content-Security-Policy":
        "default-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        `connect-src 'self' ${apiOrigin} ${wsOrigin} ${swiftlatexOrigin}`,
    },
  },
});
