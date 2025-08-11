declare module '/tectonic/tectonic_init.js' {
  const init: (wasmPath: string) => Promise<unknown>;
  export default init;
}
