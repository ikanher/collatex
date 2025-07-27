const env = typeof import.meta !== 'undefined' ? import.meta.env : {};
export const WS_URL =
  (process.env.VITE_WS_URL as string) || env.VITE_WS_URL || 'ws://localhost:1234';
export const API_URL =
  (process.env.VITE_API_URL as string) || env.VITE_API_URL || 'http://localhost:8080';
