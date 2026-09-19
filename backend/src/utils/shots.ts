/**
 * Maximum number of shots (measurement repetitions) allowed per simulation request.
 * Configurable via the MAX_SHOTS environment variable.
 */
export const MAX_SHOTS = Number(process.env.MAX_SHOTS) || 10000;

/**
 * Clamp a requested shot count into the valid [1, MAX_SHOTS] range.
 * Guards against negative, zero, non-integer, or excessively large values.
 *
 * Returns the capped value that should be used for simulation AND echoed back
 * in the response's `shots_used` / `shots` field.
 */
export function capShots(requested: number | undefined): number {
  const n = Number(requested);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_SHOTS);
}
