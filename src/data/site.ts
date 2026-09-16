/**
 * Build metadata shown in the footer and the settings page.
 *
 * `version` is asserted against package.json in `site.test.ts`, so bumping the package
 * version without updating what the app displays fails the test suite instead of quietly
 * shipping a stale number.
 */
export const SITE = {
  name: 'QubitVerse',
  version: '0.1.0',
  tagline: 'Learn Quantum. Build Quantum. Understand Quantum.',
  /** Where learner progress is kept. Worth stating plainly on a platform with no backend. */
  storage: 'This browser (localStorage)',
} as const;
