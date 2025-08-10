#!/usr/bin/env bash
set -euo pipefail

# Download Tectonic WASM and minimal TeX bundle
# Requires curl and unzip

DEST_TECTONIC="apps/frontend/public/tectonic"
DEST_BUNDLE="apps/frontend/public/texbundle"
mkdir -p "$DEST_TECTONIC" "$DEST_BUNDLE"

# Example commands; adjust versions as needed
curl -L "https://github.com/tectonic-typesetting/tectonic/releases/latest/download/tectonic.wasm" -o "$DEST_TECTONIC/tectonic.wasm"
curl -L "https://github.com/tectonic-typesetting/tectonic/releases/latest/download/tectonic_init.js" -o "$DEST_TECTONIC/tectonic_init.js"

# Fetch minimal bundle (placeholder; replace with actual source)
# curl -L <bundle-url> -o bundle.zip && unzip -o bundle.zip -d "$DEST_BUNDLE" && rm bundle.zip

printf 'Tectonic WASM assets downloaded to %s\n' "$DEST_TECTONIC"
