#!/bin/sh
EMAIL=${1:-demo@example.com}
PASS=${2:-demo123}
curl -s -X POST http://localhost:8080/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | \
  sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
