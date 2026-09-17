// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { StoreProvider } from './state/StoreProvider';
import { THEME_TRANSITION_MS, applyTheme, applyThemeAnimated, loadStoredTheme, resolveTheme } from './state/theme';

/**
 * Theme toggle behaviour.
 *
 * The setting lives in AppSettings, so it must flow through the real store: clicking the
 * toggle updates <html data-theme> immediately (CSS reads that attribute), rides the same
 * persistence snapshot as everything else, and survives a reload through loadStoredTheme.
 */

function mount(hash: string) {
  window.location.hash = hash;
  return render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});

afterEach(cleanup);

describe('theme', () => {
  it('resolves "system" to light where the OS preference is unknown', () => {
    // jsdom has no matchMedia; the code must treat that as a light system, not crash.
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('system')).toBe('light');
  });

  it('writes the resolved theme onto <html> and the browser UI colour', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe('#f4f6fc');

    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe('#070912');
  });

  it('cycles dark → system → light → dark from the topbar toggle', () => {
    mount('#/dashboard');
    const root = document.documentElement;

    // Dark → system (resolves to light without a matchMedia).
    fireEvent.click(screen.getByRole('button', { name: /Switch to System/i }));
    expect(['light', 'dark']).toContain(root.dataset.theme);

    // System → light.
    fireEvent.click(screen.getByRole('button', { name: /Theme: System mode\. Switch to Light/i }));
    expect(root.dataset.theme).toBe('light');
    expect(screen.getByRole('button', { name: /Theme: Light mode\. Switch to Dark/i })).toBeTruthy();

    // Light → dark, closing the cycle.
    fireEvent.click(screen.getByRole('button', { name: /Switch to Dark/i }));
    expect(root.dataset.theme).toBe('dark');
  });

  it('persists the theme choice and restores it on the next load', async () => {
    mount('#/dashboard');
    fireEvent.click(screen.getByRole('button', { name: /Switch to System/i }));
    fireEvent.click(screen.getByRole('button', { name: /Theme: System mode\. Switch to Light/i }));

    // Persistence is debounced, so give the snapshot a moment to flush.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 400));
    });
    expect(loadStoredTheme()).toBe('light');

    // A fresh mount (the stand-in for a reload) must come up light, not dark.
    cleanup();
    mount('#/dashboard');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('cross-fades on switch: the transition class is temporary, never stuck', () => {
    vi.useFakeTimers();
    try {
      applyThemeAnimated('light');
      expect(document.documentElement.classList.contains('theme-transition')).toBe(true);

      // A rapid second switch reschedules the removal instead of stacking timers.
      applyThemeAnimated('dark');
      act(() => {
        vi.advanceTimersByTime(THEME_TRANSITION_MS + 50);
      });
      expect(document.documentElement.classList.contains('theme-transition')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(document.documentElement.classList.contains('theme-transition')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers the same control on the landing page and in Settings', () => {
    mount('#/home');
    expect(screen.getByRole('button', { name: /Theme: .* mode\. Switch to/i })).toBeTruthy();

    cleanup();
    mount('#/settings');
    expect(screen.getByRole('group', { name: /Colour theme/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Dark$/ })).toBeTruthy();
  });
});
