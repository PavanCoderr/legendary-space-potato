import type { Theme } from '../data/types';
import { STORAGE_KEY } from './defaults';

/**
 * Theme engine.
 *
 * The setting is stored inside `AppSettings` (so it rides the same persistence snapshot as
 * everything else) but the resolved value is applied to `<html data-theme>` as early as
 * possible, because the background colour must be right before React mounts to avoid a
 * flash of the wrong theme. Every style in styles.css reads the CSS custom properties that
 * this attribute switches, so no component needs to know which theme is active — except
 * the canvas visualisations, which read `resolvedTheme()` at draw time.
 */

export const THEMES: Theme[] = ['light', 'dark', 'system'];

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Reads just the theme out of the persisted snapshot, without pulling in the store.
 * (defaults.ts → data files → … would make a store import here circular; the raw storage
 * read keeps this module leaf-level so main.tsx can call it before React mounts.)
 */
export function loadStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'dark';
    const parsed = JSON.parse(raw) as { settings?: { theme?: Theme } };
    const theme = parsed?.settings?.theme;
    return theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'dark';
  } catch {
    return 'dark';
  }
}

/** The OS preference, tolerating environments without matchMedia (tests, old embeds). */
export function systemPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.(DARK_QUERY).matches === true;
  } catch {
    return false;
  }
}

/** Maps a stored setting onto the theme that should actually be painted. */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return theme;
}

/** Writes `data-theme` on <html> and updates the browser UI colour. */
export function applyTheme(theme: Theme): 'light' | 'dark' {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    // Embedded or test documents may not carry the tag; create it rather than skip it.
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = resolved === 'dark' ? '#070912' : '#f4f6fc';
  return resolved;
}

/** How long the theme cross-fade runs — keep in sync with styles.css. */
export const THEME_TRANSITION_MS = 220;

let transitionCleanup: number | null = null;

/**
 * Same as applyTheme, but surfaces cross-fade instead of snapping.
 *
 * The fade is driven by a `theme-transition` class on <html> that styles.css keys a
 * colour/border/shadow transition off. The class lives only for the duration of the fade
 * (plus a small buffer): first paint never animates, and everyday hovers keep their own
 * snappier transitions outside that window. Rapid clicks reschedule the removal rather
 * than stacking timers, so the class can never get stuck on.
 */
export function applyThemeAnimated(theme: Theme): 'light' | 'dark' {
  const root = document.documentElement;
  root.classList.add('theme-transition');
  const resolved = applyTheme(theme);
  if (transitionCleanup !== null) window.clearTimeout(transitionCleanup);
  transitionCleanup = window.setTimeout(() => {
    root.classList.remove('theme-transition');
    transitionCleanup = null;
  }, THEME_TRANSITION_MS + 100);
  return resolved;
}

/**
 * Keeps 'system' honest: when the OS flips between light and dark the page follows along.
 * The listener is only registered while the setting is 'system'.
 */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  try {
    const query = window.matchMedia(DARK_QUERY);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    // Very old engines only expose the deprecated addListener.
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  } catch {
    return () => {};
  }
}
