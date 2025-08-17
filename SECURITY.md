# Security Notes

- PDF compilation runs entirely in-browser via BusyTeX WASM; sources never leave the client.
- The BusyTeX asset fetch script downloads large binaries at build time; ensure they are served with the correct `application/wasm` MIME type.
