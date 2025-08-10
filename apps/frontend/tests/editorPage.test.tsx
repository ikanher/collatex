import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
const renderSpy = vi.fn();

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

// Mock CodeMirror to a simple input field wired to a persistent Y.Text
vi.mock('../src/components/CodeMirror', () => {
  const React = require('react');
  const doc = new Y.Doc();
  const text = doc.getText('doc');
  return {
    __esModule: true,
    default: ({ onReady }: any) => {
      React.useEffect(() => {
        onReady?.(text);
      }, [onReady]);
      return (
        <input
          data-testid="cm"
          onChange={(e) => {
            text.delete(0, text.length);
            text.insert(0, e.target.value);
          }}
        />
      );
    },
  };
});

vi.mock('../src/components/MathJaxPreview', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ source }: any) => {
      renderSpy();
      return <div data-testid="preview">{source}</div>;
    },
  };
});

import EditorPage from '../src/pages/EditorPage';

describe('EditorPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ locked: false }) }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    cleanup();
  });

  it('updates preview when typing', async () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/p/token']}>
        <Routes>
          <Route path="/p/:token" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const input = getByTestId('cm') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '$$a+b=c$$' } });
    await vi.runAllTimersAsync();
    await waitFor(() =>
      expect(getByTestId('preview').textContent).toContain('a+b=c'),
    );
  });

  it('unsubscribes observer on unmount', async () => {
    const setup = () =>
      render(
        <MemoryRouter initialEntries={['/p/token']}>
          <Routes>
            <Route path="/p/:token" element={<EditorPage />} />
          </Routes>
        </MemoryRouter>,
      );

    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const first = setup();
    fireEvent.change(first.getByTestId('cm'), { target: { value: 'one' } });
    await vi.runAllTimersAsync();
    first.unmount();

    const second = setup();
    renderSpy.mockClear();
    fireEvent.change(second.getByTestId('cm'), { target: { value: 'two' } });
    await vi.runAllTimersAsync();
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    second.unmount();
    errorSpy.mockRestore();
  });
});
