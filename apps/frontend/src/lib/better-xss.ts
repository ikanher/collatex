// Minimal placeholder sanitizer. In a real app, use a vetted library.
export default function sanitize(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
}

// TODO(security): swap with DOMPurify or MathJax safe-mode.
