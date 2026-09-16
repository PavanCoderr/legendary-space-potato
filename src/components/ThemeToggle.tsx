import { Monitor, Moon, Sun } from 'lucide-react';
import type { Theme } from '../data/types';
import { useApp } from '../state/StoreProvider';
import { THEMES, resolveTheme } from '../state/theme';

/**
 * Light/dark/system switcher.
 *
 * One small button, used in the app topbar, the landing nav and the auth screens. Each
 * click cycles the setting, and the icon always names the mode you would switch *to* next
 * (sun while dark, moon while light, monitor while following the system). The aria-label
 * states the current mode and the action, so screen-reader users are never guessing.
 */
const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };

const ICON: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/** Short noun for the mode — used in labels, tooltips and the Settings selector. */
export function themeLabel(theme: Theme): string {
  return theme === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark';
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { state, actions } = useApp();
  const theme = state.settings.theme;
  const next = NEXT[theme];
  const Icon = ICON[next];
  const resolved = resolveTheme(theme);

  return (
    <button
      className={`theme-toggle${compact ? ' btn-small' : ''}`}
      onClick={() => actions.updateSettings({ theme: next })}
      aria-label={`Theme: ${themeLabel(theme)} mode. Switch to ${themeLabel(next)}`}
      title={`Theme: ${themeLabel(theme)} — click for ${themeLabel(next)}`}
      data-theme-state={theme}
    >
      <Icon size={16} aria-hidden />
      {!compact && (
        <span className="theme-toggle-text">
          {themeLabel(theme)}
          {theme === 'system' && <span className="theme-toggle-sub"> ({resolved})</span>}
        </span>
      )}
    </button>
  );
}

/** The three-way picker used on the Settings page. */
export function ThemeSetting() {
  const { state, actions } = useApp();
  return (
    <div className="row tight" role="group" aria-label="Colour theme">
      {THEMES.map(option => {
        const Icon = ICON[option];
        const active = state.settings.theme === option;
        return (
          <button
            key={option}
            className={`theme-option${active ? ' active' : ''}`}
            onClick={() => actions.updateSettings({ theme: option })}
            aria-pressed={active}
          >
            <Icon size={14} aria-hidden />
            {themeLabel(option)}
          </button>
        );
      })}
    </div>
  );
}
