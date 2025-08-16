#!/usr/bin/env bash
set -euo pipefail

# Download SwiftLaTeX WASM assets
# Requires curl and unzip

DEST_SWIFT="apps/frontend/public/swiftlatex"
mkdir -p "$DEST_SWIFT"

ENGINE_ZIP_URL="https://github.com/SwiftLaTeX/SwiftLaTeX/releases/latest/download/20-02-2022.zip"
TMP_ZIP="/tmp/swiftlatex.zip"

echo "Downloading SwiftLaTeX package..."
curl -fL "$ENGINE_ZIP_URL" -o "$TMP_ZIP" || {
  echo "Failed to download SwiftLaTeX package" >&2
  exit 1
}

unzip -o "$TMP_ZIP" -d "$DEST_SWIFT" >/dev/null
rm "$TMP_ZIP"

printf 'SwiftLaTeX assets downloaded to %s\n' "$DEST_SWIFT"
