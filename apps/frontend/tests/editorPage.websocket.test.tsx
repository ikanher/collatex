import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

// Mock MathJax modules to keep tests light
vi.mock('mathjax-full/js/mathjax.js', () => ({
  mathjax: {
    document: () => ({
      convert: (s: string) => {
        const el = document.createElement('svg');
        el.textContent = s;
        return el;
      },
    }),
  },
}));
vi.mock('mathjax-full/js/input/tex.js', () => ({ TeX: class {} }));
vi.mock('mathjax-full/js/output/svg.js', () => ({ SVG: class {} }));
vi.mock('mathjax-full/js/adaptors/browserAdaptor.js', () => ({ browserAdaptor: () => ({}) }));
vi.mock('mathjax-full/js/handlers/html.js', () => ({ RegisterHTMLHandler: () => {} }));

// Spyable stub for WebsocketProvider
vi.mock('y-websocket', () => ({
  WebsocketProvider: vi.fn().mockImplementation(function (
    this: any,
    url: string,
    room: string,
    doc: Y.Doc,
  ) {
    this.url = `${url}/${room}`;
    this.awareness = new Awareness(doc);
    this.doc = doc;
    this.destroy = vi.fn();
  }),
}));
import { WebsocketProvider } from 'y-websocket';

// Lightweight MathJaxPreview
vi.mock('../src/components/MathJaxPreview', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ source }: any) => <div data-testid="preview">{source}</div>,
  };
});

import EditorPage from '../src/pages/EditorPage';

// Tests
describe('EditorPage websocket', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('connects to websocket without extra path and updates preview', async () => {
    const { container, getByTestId } = render(
      <MemoryRouter initialEntries={['/p/fake']}> 
        <Routes>
          <Route path="/p/:token" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(WebsocketProvider).toHaveBeenCalled();
    const instanceUrl = (WebsocketProvider as any).mock.instances[0].url as string;
    expect(instanceUrl.endsWith('/document')).toBe(false);

    const instanceDoc = (WebsocketProvider as any).mock.instances[0].doc as Y.Doc;
    const text = instanceDoc.getText('document');
    text.insert(0, '$$a+b=c$$');
    await waitFor(() =>
      expect(getByTestId('preview').textContent).toContain('a+b=c'),
    );
  });
});

