/**
 * Date utilities for streak tracking.
 *
 * Local calendar day key in YYYY-MM-DD format, used to compute practice streaks.
 */
export function dayKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
