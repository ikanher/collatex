// Placeholder PdfTeXEngine for development
window.PdfTeXEngine = class {
  async loadEngine() {}
  flushCache() {}
  writeMemFSFile() {}
  setEngineMainFile() {}
  async compileLaTeX() {
    return { pdf: new Uint8Array(), log: '' };
  }
};
