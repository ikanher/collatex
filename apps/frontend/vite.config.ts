import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiOrigin = process.env.VITE_API_ORIGIN || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.VITE_API_ORIGIN': JSON.stringify(apiOrigin),
  },
  server: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'",
    },
  },
});
