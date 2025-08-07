import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';

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
vi.mock('mathjax-full/js/adaptors/liteAdaptor.js', () => ({ liteAdaptor: () => ({}) }));
vi.mock('mathjax-full/js/handlers/html.js', () => ({ RegisterHTMLHandler: () => {} }));

// Mock CodeMirror to a simple input field wired to Y.Text
vi.mock('../src/components/CodeMirror', () => {
  const React = require('react');
  return {
    default: ({ onReady }: any) => {
      const doc = React.useRef(new Y.Doc());
      const text = React.useRef(doc.current.getText('doc'));
      React.useEffect(() => {
        onReady?.(text.current);
      }, [onReady]);
      return (
        <input
          data-testid="cm"
          onChange={(e) => {
            text.current.delete(0, text.current.length);
            text.current.insert(0, e.target.value);
          }}
        />
      );
    },
  };
});

import EditorPage from '../src/pages/EditorPage';

describe('EditorPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('updates preview when typing', async () => {
    const { getByTestId, container } = render(
      <MemoryRouter initialEntries={['/p/token']}>
        <Routes>
          <Route path="/p/:token" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const input = getByTestId('cm') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '$$a+b=c$$' } });
    await vi.runAllTimersAsync();
    await waitFor(() => expect(container.querySelector('svg')).toBeInTheDocument());
  });
});
