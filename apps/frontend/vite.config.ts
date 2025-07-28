import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiOrigin = process.env.VITE_API_ORIGIN || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.VITE_API_ORIGIN': JSON.stringify(apiOrigin),
  },
});
