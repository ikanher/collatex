#!/bin/sh
set -e
started_local=""
if ! docker compose ps >/dev/null 2>&1; then
  ./scripts/dev_local.sh &
  started_local=$!
fi
backend=http://localhost:8080
gateway=http://localhost:1234

wait_service() {
  url=$1
  for i in $(seq 1 60); do
    if curl -fs "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

wait_service "$backend/healthz"
wait_service "$gateway/healthz"

curl -fs -X OPTIONS "$backend/compile" \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: POST' >/dev/null

tex='\\documentclass{article}\\begin{document}Hi\\end{document}'
body=$(printf '%s' "$tex" | base64 -w0)
job=$(curl -fs -X POST "$backend/compile" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer changeme' \
  -d '{"projectId":"demo","entryFile":"main.tex","engine":"tectonic","files":[{"path":"main.tex","contentBase64":"'$body'"}]}' | jq -r '.jobId')

if [ -z "$job" ] || [ "$job" = "null" ]; then
  echo "Failed to get job id" >&2
  exit 1
fi

for i in $(seq 1 60); do
  status=$(curl -fs "$backend/jobs/$job" -H 'Authorization: Bearer changeme' | jq -r '.status')
  if [ "$status" = "done" ]; then
    break
  fi
  sleep 1
  [ "$status" = "error" ] && break
done

if [ "$status" != "done" ]; then
  echo "Job failed or timed out: $status" >&2
  exit 1
fi

curl -fs "$backend/pdf/$job" -H 'Authorization: Bearer changeme' -o /tmp/out.pdf
grep -q '%PDF' /tmp/out.pdf

if [ -n "$started_local" ]; then
  kill "$started_local"
fi

