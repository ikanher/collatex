#!/usr/bin/env bash
set -euo pipefail

# Download Tectonic WASM and minimal TeX bundle
# Requires curl and unzip

DEST_TECTONIC="apps/frontend/public/tectonic"
DEST_BUNDLE="apps/frontend/public/texbundle"
mkdir -p "$DEST_TECTONIC" "$DEST_BUNDLE"

ENGINE_URL="https://github.com/tectonic-typesetting/tectonic/releases/latest/download/tectonic.wasm"
INIT_URL="https://github.com/tectonic-typesetting/tectonic/releases/latest/download/tectonic_init.js"

echo "Downloading Tectonic engine..."
curl -fL "$ENGINE_URL" -o "$DEST_TECTONIC/tectonic.wasm" || {
  echo "Failed to download Tectonic WASM engine" >&2
  exit 1
}

echo "Downloading Tectonic init script..."
curl -fL "$INIT_URL" -o "$DEST_TECTONIC/tectonic_init.js" || {
  echo "Failed to download Tectonic init script" >&2
  rm -f "$DEST_TECTONIC/tectonic.wasm"
  exit 1
}

if grep -q 'Not Found' "$DEST_TECTONIC/tectonic_init.js"; then
  echo "Tectonic assets not found at provided URLs" >&2
  rm -f "$DEST_TECTONIC/tectonic.wasm" "$DEST_TECTONIC/tectonic_init.js"
  exit 1
fi

# Fetch minimal bundle (placeholder; replace with actual source)
# curl -L <bundle-url> -o bundle.zip && unzip -o bundle.zip -d "$DEST_BUNDLE" && rm bundle.zip

printf 'Tectonic WASM assets downloaded to %s\n' "$DEST_TECTONIC"
