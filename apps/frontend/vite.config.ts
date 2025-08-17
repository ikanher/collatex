import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const root = path.resolve(__dirname, '../..');
  const env = loadEnv(mode, root, '');
  const apiOrigin = env.VITE_API_ORIGIN || 'http://localhost:1234';
  const wsOrigin = env.VITE_WS_URL || 'ws://localhost:1234';
  return {
    envDir: root,
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    define: {
      'process.env.VITE_API_ORIGIN': JSON.stringify(apiOrigin),
      'process.env.VITE_WS_URL': JSON.stringify(wsOrigin),
    },
    server: {
      headers: {
        "Content-Security-Policy":
          "default-src 'self'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "worker-src 'self'; " +
          `connect-src 'self' ${apiOrigin} ${wsOrigin}`,
      },
    },
  };
});
