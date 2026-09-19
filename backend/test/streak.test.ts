import { describe, it, expect } from 'vitest';
import { computeStreak } from '../src/rewards';

/**
 * Streak day-transition tests (CG3).
 *
 * computeStreak takes a sorted array of UTC day keys (YYYY-MM-DD) and returns
 * the current practice streak. We test the calendar math directly without
 * touching the database or real time.
 */
describe('Streak day-transition (CG3)', () => {
  it('consecutive days increment streak', () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    const dayBefore = new Date(today.getTime() - 2 * 86_400_000);

    // Format as YYYY-MM-DD UTC
    const dayKey = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    const activeDays = [dayKey(dayBefore), dayKey(yesterday), dayKey(today)];
    expect(computeStreak(activeDays)).toBe(3);
  });

  it('a gap in days resets streak to zero', () => {
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 86_400_000);

    const dayKey = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    // Active 3 days ago, then today — gap of 1 day breaks the streak
    const activeDays = [dayKey(threeDaysAgo), dayKey(today)];
    expect(computeStreak(activeDays)).toBe(1); // only today counts
  });

  it('streak is broken if last active day is neither today nor yesterday', () => {
    const today = new Date();
    const twoDaysAgo = new Date(today.getTime() - 2 * 86_400_000);

    const dayKey = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    // Last active 2 days ago, which is neither today nor yesterday
    const activeDays = [dayKey(twoDaysAgo)];
    expect(computeStreak(activeDays)).toBe(0);
  });

  it('empty active days yields streak 0', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('single active day (today) yields streak 1', () => {
    const today = new Date();
    const dayKey = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    expect(computeStreak([dayKey(today)])).toBe(1);
  });
});
