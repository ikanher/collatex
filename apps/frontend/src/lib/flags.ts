// Determine whether the WASM TeX path is enabled. Default to true in
// development builds if the environment variable is undefined so that local
// developers get the faster WASM experience without additional config.
const enableWasmTexEnv =
  import.meta.env.VITE_ENABLE_WASM_TEX ?? (import.meta.env.DEV ? 'true' : 'false');

export const ENABLE_WASM_TEX = enableWasmTexEnv === 'true';
