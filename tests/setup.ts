import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// jsdom lacks these; React Flow + some components touch them.
if (typeof window !== 'undefined') {
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: false, media: q, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList));
  // @ts-expect-error - jsdom has no ResizeObserver
  window.ResizeObserver = window.ResizeObserver || class { observe(){} unobserve(){} disconnect(){} };
  // @ts-expect-error - jsdom has no scrollTo
  window.scrollTo = window.scrollTo || (() => {});
}
