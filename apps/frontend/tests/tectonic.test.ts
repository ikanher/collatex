import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { compileLatexInWorker } from '../src/lib/tectonicClient';

vi.mock('../src/lib/latexWasm', () => ({
  compilePdfTeX: async () => ({
    pdf: new TextEncoder().encode('%PDF-1.4\n'),
    log: '',
  }),
}));

describe('compileLatexInWorker', () => {
  const load = (name: string) =>
    readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

  it('compiles minimal.tex', async () => {
    const { pdf } = await compileLatexInWorker({ getSource: () => load('minimal.tex') });
    expect(new TextDecoder().decode(pdf).startsWith('%PDF')).toBe(true);
  });

  it('compiles math.tex', async () => {
    const { pdf } = await compileLatexInWorker({ getSource: () => load('math.tex') });
    expect(pdf.length).toBeGreaterThan(0);
  });
});
