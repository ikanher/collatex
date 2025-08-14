// Minimal PdfTeXEngine stub for development/testing.
(function () {
  const pdfStr =
    '%PDF-1.1\n' +
    '1 0 obj<< /Type /Catalog /Pages 2 0 R>>endobj\n' +
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1>>endobj\n' +
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R>>>>>>endobj\n' +
    '4 0 obj<< /Length 44>>stream\n' +
    'BT /F1 24 Tf 50 100 Td (Hello) Tj ET\n' +
    'endstream\nendobj\n' +
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica>>endobj\n' +
    'xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000061 00000 n \n0000000129 00000 n \n0000000290 00000 n \n0000000381 00000 n \ntrailer<< /Size 6 /Root 1 0 R>>\nstartxref\n452\n%%EOF';
  const pdfBytes = new TextEncoder().encode(pdfStr);

  window.PdfTeXEngine = class {
    constructor() {
      this.fs = {};
      this.main = 'main.tex';
    }
    async loadEngine() {}
    flushCache() {
      this.fs = {};
    }
    writeMemFSFile(name, data) {
      this.fs[name] = data;
    }
    setEngineMainFile(name) {
      this.main = name;
    }
    async compileLaTeX() {
      return { pdf: pdfBytes, log: 'stub pdf generated' };
    }
  };
})();
