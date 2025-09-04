# CollaTeX

[![CI](https://github.com/ikanher/collatex/actions/workflows/ci.yaml/badge.svg)](https://github.com/ikanher/collatex/actions/workflows/ci.yaml)

CollaTeX is a real-time collaborative LaTeX editor. It pairs a Yjs-powered
WebSocket gateway with a React frontend that renders MathJax previews as you
type.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [API specifications](SPECIFICATIONS.md)
- [Agent guidelines](AGENTS.md)

## Quick start

Requirements: Node.js 20+

```bash
cp .env.example .env
make dev
```

Open `http://localhost:5173` and start a project. Share the `/p/<token>` URL
with another tab to see live edits.

## Testing

Run lint checks and the test suites:

```bash
make lint
make test
```

Both commands must finish without errors.

