#!/bin/sh
set -e

if command -v docker >/dev/null 2>&1; then
  echo "Docker detected. If you want the containerised stack, run: docker compose up" >&2
fi

if ! nc -z localhost 6379; then
  echo "Starting local Redis on port 6379"
  if command -v redis-server >/dev/null 2>&1; then
    redis-server --daemonize yes
  else
    export COLLATEX_USE_REDISLITE=1
  fi
fi

export REDIS_URL="redis://localhost:6379/0"
export ALLOWED_ORIGINS="localhost:5173"

npm --prefix apps/collab_gateway install
npm --prefix apps/frontend install

cleanup() {
  kill $GATEWAY_PID $FRONT_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm --prefix apps/collab_gateway run dev &
GATEWAY_PID=$!
npm --prefix apps/frontend run dev &
FRONT_PID=$!

echo "Gateway: ws://localhost:1234"
echo "Frontend: http://localhost:5173"
echo "API token: changeme"

wait
