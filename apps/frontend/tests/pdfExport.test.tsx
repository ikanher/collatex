import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { startSwiftlatexServer } from './swiftlatexServer';

vi.mock('html2canvas', () => ({
  default: vi.fn(() => ({ toDataURL: () => 'data', width: 1, height: 1 })),
}));
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({ addImage: vi.fn(), output: () => new Blob([1]) })),
}));

describe('PdfExportButton', () => {
  it('downloads pdf on success', async () => {
    const srv = await startSwiftlatexServer([200]);
    vi.stubEnv('VITE_SWIFTLATEX_ORIGIN', srv.url);
    vi.stubEnv('VITE_SWIFTLATEX_TOKEN', 't');
    vi.resetModules();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const { default: PdfExportButton } = await import('../src/components/PdfExportButton');
    render(<PdfExportButton getSource={() => 'hi'} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    await srv.close();
  });

  it('falls back to screenshot on error', async () => {
    const srv = await startSwiftlatexServer([500]);
    vi.stubEnv('VITE_SWIFTLATEX_ORIGIN', srv.url);
    vi.stubEnv('VITE_SWIFTLATEX_TOKEN', 't');
    vi.resetModules();
    const html2canvasMock: any = (await import('html2canvas')).default;
    const { default: PdfExportButton } = await import('../src/components/PdfExportButton');
    render(<PdfExportButton getSource={() => 'hi'} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(html2canvasMock).toHaveBeenCalled());
    expect(
      screen.getByText(/Remote compile failed/)
    ).toBeInTheDocument();
    await srv.close();
  });
});
