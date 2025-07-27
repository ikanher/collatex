# Compile Service

This service compiles LaTeX sources to PDF using Tectonic.

## Running locally

```bash
make up          # build image and start service at http://localhost:8000
```

Stop with:

```bash
make down
```

To test Redis-backed persistence locally:

```bash
brew install redis  # or use your package manager
make dev-redis &
export COLLATEX_STATE=redis
```

## Example request

```bash
curl -X POST http://localhost:8000/compile \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"demo","entryFile":"main.tex","engine":"tectonic","files":[{"path":"main.tex","contentBase64":"$(base64 -w0 examples/minimal/main.tex)"}],"options":{}}'
```

You will receive a job id. Check status:

```bash
curl http://localhost:8000/jobs/<jobId>
```

When `status` becomes `done`, download the PDF:

```bash
curl -o out.pdf http://localhost:8000/pdf/<jobId>
```

## Limits and errors

Uploads are limited by `MAX_UPLOAD_BYTES` (default 2 MiB) and compile timeouts are
controlled by `COMPILE_TIMEOUT_SECONDS` (default 20). Dangerous TeX commands like
`\write18` are rejected.
