import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { compileLatexInWorker } from '../src/lib/tectonicClient';

vi.mock('../src/lib/latexWasm', () => ({
  compilePdfTeX: async () => ({
    pdf: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]),
    log: '',
  }),
}));

describe('compileLatexInWorker', () => {
  const load = (name: string) =>
    readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

  it('compiles minimal.tex', async () => {
    const { pdf } = await compileLatexInWorker({ getSource: () => load('minimal.tex') });
    expect(Array.from(pdf.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it('compiles math.tex', async () => {
    const { pdf } = await compileLatexInWorker({ getSource: () => load('math.tex') });
    expect(pdf.length).toBeGreaterThan(0);
  });
});
