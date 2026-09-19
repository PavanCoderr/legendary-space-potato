/**
 * Date utilities for streak tracking.
 *
 * Calendar day key in YYYY-MM-DD format (UTC), used to compute practice streaks.
 * Uses UTC so streaks are consistent regardless of server timezone.
 */
export function dayKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${d.getUTCDate()}`.padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}-${day}`;
}
