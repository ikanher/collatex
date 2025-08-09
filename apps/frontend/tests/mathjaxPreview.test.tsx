import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import MathJaxPreview from '../src/components/MathJaxPreview';

// MathJax rendering involves timers due to debouncing.
describe('MathJaxPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders svg output for simple math', async () => {
    const { container } = render(<MathJaxPreview source={"$$a+b=c$$"} />);
    await vi.runAllTimersAsync();
    await waitFor(() => expect(container.querySelector('svg')).toBeInTheDocument());
  });

  it('updates when prop changes', async () => {
    const { container, rerender } = render(<MathJaxPreview source={"$$a+b=c$$"} />);
    await vi.runAllTimersAsync();
    await waitFor(() => expect(container.querySelector('svg')).toBeInTheDocument());
    const first = container.innerHTML;
    rerender(<MathJaxPreview source={"$$1+1=2$$"} />);
    await vi.runAllTimersAsync();
    await waitFor(() => expect(container.innerHTML).not.toEqual(first));
  });

  it('renders placeholder when empty', async () => {
    const { container } = render(<MathJaxPreview source="" />);
    await vi.runAllTimersAsync();
    await waitFor(() =>
      expect(container.textContent).toContain(
        'Type TeX math like \\(e^{i\\pi}+1=0\\) or $$\\int_0^1 x^2\\,dx$$',
      ),
    );
  });
});
