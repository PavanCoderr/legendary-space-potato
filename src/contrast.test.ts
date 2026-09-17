/// <reference types="node" />
// The stylesheet is read from disk so this audit can never drift from the CSS that ships.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * WCAG AA contrast audit.
 *
 * The palettes are parsed from styles.css, so this audit cannot drift from what ships:
 * it reads the `:root` block (dark, the default) and the `:root[data-theme='light']` block,
 * resolves var() references and rgba() over their real backdrop, and computes contrast
 * ratios for every foreground/surface pair the interface actually renders.
 *
 * Thresholds (WCAG 2.1 AA):
 *   - normal text, UI icons and form-control borders: 4.5 / 3.0 / 3.0
 *   - large text (the hero title): 3.0
 *   - text on accent buttons: 4.5 (they are the primary action, never "incidental")
 *   - decorative washes (the body glow) are exempt; they sit behind opaque surfaces.
 */

const CSS_PATH = join(__dirname, 'styles.css');
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parses #rgb/#rrggbb into channels, preserving alpha from 8-digit hex. */
function parseHex(hex: string): (Rgb & { a: number }) | null {
  const value = hex.replace('#', '');
  if (![3, 6, 8].includes(value.length)) return null;
  const expand = (part: string) => parseInt(part.length === 1 ? part + part : part, 16);
  if (value.length === 3) {
    return { r: expand(value[0]), g: expand(value[1]), b: expand(value[2]), a: 1 };
  }
  if (value.length === 6) {
    return {
      r: expand(value.slice(0, 2)),
      g: expand(value.slice(2, 4)),
      b: expand(value.slice(4, 6)),
      a: 1,
    };
  }
  return {
    r: expand(value.slice(0, 2)),
    g: expand(value.slice(2, 4)),
    b: expand(value.slice(4, 6)),
    a: parseInt(value.slice(6, 8), 16) / 255,
  };
}

function parseRgbColor(color: string): (Rgb & { a: number }) | null {
  const match = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+%?))?\s*\)/);
  if (!match) return null;
  const alphaRaw = match[4];
  const alpha = alphaRaw === undefined ? 1 : alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw);
  return { r: parseFloat(match[1]), g: parseFloat(match[2]), b: parseFloat(match[3]), a: alpha };
}

function parseColor(color: string): (Rgb & { a: number }) | null {
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) return parseHex(trimmed);
  if (trimmed.startsWith('rgb')) return parseRgbColor(trimmed);
  return null;
}

/** Composites a (possibly translucent) colour over an opaque backdrop. */
function over(fg: Rgb & { a: number }, bg: Rgb): Rgb {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
  };
}

function channelLuminance(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * channelLuminance(color.r) + 0.7152 * channelLuminance(color.g) + 0.0722 * channelLuminance(color.b)
  );
}

/** WCAG contrast ratio between two opaque colours. */
export function contrastRatio(fg: Rgb, bg: Rgb): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Extracts one CSS block (custom properties only) by selector. */
function readTokens(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`styles.css has no ${selector} block`);
  const open = css.indexOf('{', start);
  let depth = 1;
  let end = open + 1;
  while (depth > 0 && end < css.length) {
    if (css[end] === '{') depth += 1;
    if (css[end] === '}') depth -= 1;
    end += 1;
  }
  const body = css.slice(open + 1, end - 1);
  const tokens = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

/** Resolves var() chains (e.g. var(--track) inside another token) against a palette. */
function resolveValue(value: string, tokens: Map<string, string>, seen = new Set<string>()): string {
  let out = value;
  for (let i = 0; i < 8; i += 1) {
    if (!out.includes('var(')) break;
    out = out.replace(/var\((--[\w-]+)\)/g, (_full, name: string) => {
      if (seen.has(name)) return 'transparent';
      seen.add(name);
      return tokens.get(name) ?? 'transparent';
    });
  }
  return out;
}

function paletteOf(tokens: Map<string, string>): Map<string, Rgb> {
  const palette = new Map<string, Rgb>();
  for (const [name, raw] of tokens) {
    const value = resolveValue(raw, tokens);
    // Solid colors only; gradients and shadows are composited separately below.
    const parsed = parseColor(value);
    if (parsed && parsed.a >= 1) palette.set(name, parsed);
  }
  return palette;
}

function token(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`styles.css is missing the ${name} token`);
  return resolveValue(value, tokens);
}

/** Composites a named translucent token (rgba) over a named opaque backdrop token. */
function overToken(
  tokens: Map<string, string>,
  overlayName: string,
  backdrop: Rgb,
): Rgb {
  const overlay = parseColor(token(tokens, overlayName));
  if (!overlay) throw new Error(`token ${overlayName} is not a parseable colour`);
  return overlay.a >= 1 ? overlay : over(overlay, backdrop);
}

const css = readFileSync(CSS_PATH, 'utf8');
const darkTokens = readTokens(css, ':root {');
const lightTokens = readTokens(css, ":root[data-theme='light'] {");
const darkPalette = paletteOf(darkTokens);
const lightPalette = paletteOf(lightTokens);

const GATE_INK_TOKENS = [
  '--gate-h-ink',
  '--gate-x-ink',
  '--gate-y-ink',
  '--gate-z-ink',
  '--gate-s-ink',
  '--gate-t-ink',
  '--gate-cnot-ink',
  '--gate-m-ink',
];

/** The .btn-primary / .btn-accent gradient stops and label inks, per theme. */
interface ButtonInkCheck {
  pair: string;
  fg: Rgb;
  stops: string[];
  required: number;
}

const BUTTON_INK_CHECKS: ButtonInkCheck[] = [
  {
    pair: 'white on .btn-primary gradient',
    fg: { r: 255, g: 255, b: 255 },
    stops: ['--accent-deep', '--btn-primary-2'],
    required: AA_NORMAL,
  },
  {
    pair: '#05120f on .btn-accent gradient',
    fg: { r: 5, g: 18, b: 15 },
    stops: ['--accent-2-deep', '--good'],
    required: AA_NORMAL,
  },
];

interface Check {
  theme: 'dark' | 'light';
  pair: string;
  ratio: number;
  required: number;
}

const failures: Check[] = [];
const checks: Check[] = [];

function audit(theme: 'dark' | 'light', pair: string, fg: Rgb, bg: Rgb, required: number) {
  const ratio = contrastRatio(fg, bg);
  const entry = { theme, pair, ratio, required };
  checks.push(entry);
  // Ratios are reported to two decimals; the comparison uses the same rounding so a
  // 4.496 measured ratio does not silently pass as "4.5".
  if (Math.round(ratio * 100) / 100 < required) failures.push(entry);
}

/** Runs one foreground colour against every surface it is really painted on. */
function auditOnSurfaces(
  theme: 'dark' | 'light',
  _tokens: Map<string, string>,
  palette: Map<string, Rgb>,
  pair: string,
  fg: Rgb,
  surfaces: string[],
  required: number,
) {
  for (const surface of surfaces) {
    const bg = palette.get(surface);
    if (!bg) throw new Error(`${theme} theme is missing surface token ${surface}`);
    audit(theme, `${pair} on ${surface}`, fg, bg, required);
  }
}

for (const [theme, tokens, palette] of [
  ['dark', darkTokens, darkPalette],
  ['light', lightTokens, lightPalette],
] as const) {
  const fgOf = (name: string): Rgb => {
    const color = palette.get(name);
    if (!color) throw new Error(`${theme} theme is missing colour token ${name}`);
    return color;
  };

  // The surfaces text is really painted on. Cards sit on --bg, so a flat --panel colour is
  // the honest worst case (the gradient values hug it on both themes).
  const surfaces = ['--bg', '--bg-soft', '--panel', '--panel-2'];

  // Core text tiers — these carry the reading experience.
  auditOnSurfaces(theme, tokens, palette, '--text', fgOf('--text'), surfaces, AA_NORMAL);
  auditOnSurfaces(theme, tokens, palette, '--muted', fgOf('--muted'), surfaces, AA_NORMAL);
  // --dim is used for fine print (timestamps, hints, table headers); it must still clear AA.
  auditOnSurfaces(theme, tokens, palette, '--dim', fgOf('--dim'), surfaces, AA_NORMAL);

  // Status colours are used as small text and icons on panels. The ink variants are what
  // the interface actually paints text with (styles.css .badge/.toast/.check-mark and the
  // inline styles), so those are the colours that must clear AA.
  for (const name of ['--good-ink', '--warn-ink', '--bad-ink', '--accent-2-ink']) {
    auditOnSurfaces(theme, tokens, palette, name, fgOf(name), surfaces, AA_NORMAL);
  }

  // --accent-soft is text on accent-tinted chips and markers.
  auditOnSurfaces(theme, tokens, palette, '--accent-soft', fgOf('--accent-soft'), surfaces, AA_NORMAL);

  // Primary action buttons: the label sits on a two-stop gradient, so every stop
  // must clear AA (the lighter stop is the binding constraint).
  for (const check of BUTTON_INK_CHECKS) {
    check.stops.forEach((stopToken, index) => {
      audit(theme, `${check.pair} (stop ${index + 1})`, check.fg, fgOf(stopToken), check.required);
    });
  }

  // Notification badge: white over its darker light-theme red.
  if (theme === 'light') {
    audit(theme, 'white on .count-badge red', { r: 255, g: 255, b: 255 }, { r: 198, g: 43, b: 71 }, AA_NORMAL);
  }

  // Form controls: the UA paints placeholder and caret in --muted/--text over --field-bg.
  const fieldBg = fgOf('--field-bg');
  audit(theme, '--muted on --field-bg', fgOf('--muted'), fieldBg, AA_NORMAL);

  // Code and preformatted blocks sit on --pre-bg.
  audit(theme, '--text on --pre-bg', fgOf('--text'), fgOf('--pre-bg'), AA_NORMAL);
  audit(theme, '--muted on --pre-bg', fgOf('--muted'), fgOf('--pre-bg'), AA_NORMAL);

  // Progress tracks are decorative, but the raised overlays under chips are not:
  // icons/labels painted over --overlay-faint sit effectively on the panel colour.
  const panel = fgOf('--panel');
  const chipBg = overToken(tokens, '--overlay-faint', panel);
  audit(theme, '--dim over --overlay-faint on --panel', fgOf('--dim'), chipBg, AA_NORMAL);

  // Gate colours appear as text in the palette glyphs, the inspector and the reference
  // labels — always over the chip overlay on a panel. The ink tokens are per theme.
  for (const gateToken of GATE_INK_TOKENS) {
    const gateColor = fgOf(gateToken);
    audit(theme, `${gateToken} over chip on --panel`, gateColor, chipBg, AA_NORMAL);
    audit(theme, `${gateToken} on --panel`, gateColor, panel, AA_NORMAL);
  }
  // The circuit-grid boxes paint a label on a gate-colour fill; --gate-box-ink is that
  // label. Worst case is the lightest fill of the theme.
  const gateFillTokens = ['--gate-h', '--gate-x', '--gate-y', '--gate-z', '--gate-s', '--gate-t', '--gate-cnot', '--gate-m'];
  const boxInk = fgOf('--gate-box-ink');
  for (const fillToken of gateFillTokens) {
    audit(theme, `--gate-box-ink on ${fillToken} (grid box)`, boxInk, fgOf(fillToken), AA_NORMAL);
  }

  // Borders that carry meaning (inputs, enabled control edges) need 3:1 against what
  // they border — non-text contrast (WCAG 1.4.11).
  audit(theme, '--border on --field-bg (input edge)', fgOf('--border'), fieldBg, AA_LARGE);
  audit(theme, '--border on --bg', fgOf('--border'), fgOf('--bg'), AA_LARGE);
}

describe('WCAG AA contrast audit', () => {
  it('meets contrast thresholds in the dark theme', () => {
    const themeFailures = failures.filter(entry => entry.theme === 'dark');
    expect(render(themeFailures)).toBe('');
  });

  it('meets contrast thresholds in the light theme', () => {
    const themeFailures = failures.filter(entry => entry.theme === 'light');
    expect(render(themeFailures)).toBe('');
  });

  /** Message helper kept outside the assertions so both themes report the same way. */
  function render(list: Check[]): string {
    return list
      .map(entry => `  ${entry.theme} · ${entry.pair}: ${entry.ratio.toFixed(2)} (needs ${entry.required})`)
      .join('\n');
  }
});
