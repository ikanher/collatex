import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('../src/lib/swiftlatex', () => ({
  compileWithSwiftLatex: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
}));

describe('PdfExportButton', () => {
  it('downloads pdf via SwiftLaTeX', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    (globalThis.URL as any).createObjectURL = vi.fn(() => 'blob:1');
    (globalThis.URL as any).revokeObjectURL = vi.fn();
    const { default: PdfExportButton } = await import('../src/components/PdfExportButton');
    render(<PdfExportButton getSource={() => 'hi'} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
  });

  it('has no Tectonic references', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../src/components/PdfExportButton.tsx'), 'utf8').toLowerCase();
    expect(src).not.toContain('tectonic');
  });
});
