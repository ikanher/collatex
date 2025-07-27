export function getToken(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('collatex_token');
    if (stored) return stored;
  }
  const env = typeof import.meta !== 'undefined' ? import.meta.env : {};
  return (env.VITE_API_TOKEN as string) || '';
}
