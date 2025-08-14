export default class PdfTeXEngineStub {
  private fs: Record<string, Uint8Array | string> = {};
  private main = 'main.tex';
  async loadEngine() {}
  flushCache() {
    this.fs = {};
  }
  writeMemFSFile(name: string, data: Uint8Array | string) {
    this.fs[name] = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  }
  setEngineMainFile(name: string) {
    this.main = name;
  }
  async compileLaTeX() {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a]); // "%PDF\n"
    return { pdf, log: 'stub engine' };
  }
}
