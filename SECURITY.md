# Security Notes

- LaTeX compilation with Tectonic runs entirely inside a Web Worker.
- The worker has no network access except optional package mirrors configured at build time.
- No server-side execution occurs; PDFs are produced client-side only.
