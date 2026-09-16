// @vitest-environment jsdom
import { act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { StoreProvider } from './state/StoreProvider';

/**
 * Route smoke test.
 *
 * Renders every route — including the awkward ones (unknown topic, missing lesson id, deep
 * links) — and fails if React logs an error or warning while doing it. That is how layout
 * nesting mistakes, missing keys and broken guards get caught without a browser.
 */

/** Messages that come from the test environment rather than the application. */
const IGNORED = [
  'not configured to support act',
  'Not implemented: HTMLCanvasElement',
  'Not implemented: window.matchMedia',
  'Warning: ReactDOM.render',
];

const ROUTES = [
  '#/', // landing
  '#/home',
  '#/login',
  '#/signup',
  '#/dashboard',
  '#/learn',
  '#/learn/superposition',
  '#/learn/qubits',
  '#/learn/entanglement',
  '#/learn/gates',
  '#/learn/algorithms',
  '#/learn/fundamentals', // a subject area, not a module
  '#/learn/does-not-exist', // unknown topic
  '#/lesson',
  '#/lesson/qubits',
  '#/lesson/superposition',
  '#/lesson/entanglement',
  '#/lesson/gates',
  '#/lesson/algorithms',
  '#/builder',
  '#/simulator',
  '#/tutor',
  '#/practice',
  '#/practice/challenge-superposition',
  '#/progress',
  '#/projects',
  '#/profile',
  '#/settings',
  '#/totally-unknown',
];

let messages: string[] = [];
let originalError: typeof console.error;
let originalWarn: typeof console.warn;

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
  messages = [];
  originalError = console.error;
  originalWarn = console.warn;
  const capture = (kind: string) => (...args: unknown[]) => {
    const text = args
      .map(value => (value instanceof Error ? value.message : typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ');
    if (!IGNORED.some(ignore => text.includes(ignore))) messages.push(`${kind}: ${text}`);
  };
  console.error = capture('error');
  console.warn = capture('warn');
});

afterEach(() => {
  cleanup();
  console.error = originalError;
  console.warn = originalWarn;
});

describe('route smoke test', () => {
  it('renders every route without crashing or logging a React warning', () => {
    const failures: string[] = [];
    for (const hash of ROUTES) {
      const view = render(
        <StoreProvider>
          <App />
        </StoreProvider>,
      );
      act(() => {
        window.location.hash = hash;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      const text = document.body.textContent ?? '';
      const captured = messages.filter(message => !message.includes('Warning: An update to'));
      if (captured.length > 0) {
        failures.push(`${hash}\n  ${captured.join('\n  ')}`);
      }
      if (hash.startsWith('#/') && !hash.startsWith('#/totally-unknown') && text.trim().length < 40) {
        failures.push(`${hash}\n  rendered almost nothing (${text.length} chars)`);
      }
      messages = [];
      view.unmount();
    }
    expect(failures.join('\n\n')).toBe('');
  });
});
