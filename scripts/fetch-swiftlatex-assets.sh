#!/usr/bin/env bash
set -euo pipefail

# Download SwiftLaTeX WASM engine assets
# Requires curl and unzip

DEST_SWIFTLATEX="apps/frontend/public/swiftlatex"
mkdir -p "$DEST_SWIFTLATEX"

RELEASE_URL="https://github.com/SwiftLaTeX/SwiftLaTeX/releases/download/v20022022/20-02-2022.zip"
TMP_ZIP="$(mktemp)"

echo "Downloading SwiftLaTeX release..."
curl -fL "$RELEASE_URL" -o "$TMP_ZIP" || {
  echo "Failed to download SwiftLaTeX release" >&2
  exit 1
}

echo "Extracting engine files..."
# Extract XeTeX engine files only
unzip -j "$TMP_ZIP" XeTeXEngine.js swiftlatexxetex.js swiftlatexxetex.wasm -d "$DEST_SWIFTLATEX" >/dev/null
rm -f "$TMP_ZIP"

printf 'SwiftLaTeX WASM assets downloaded to %s\n' "$DEST_SWIFTLATEX"
