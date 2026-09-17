/**
 * Minimal complex number helpers.
 *
 * Amplitudes inside the simulator are stored as parallel Float64Arrays for speed
 * (see `gates.ts`), but gate matrices and the public API use plain objects so the
 * rest of the application (rendering, tutor, tests) stays readable.
 */
export interface Complex {
  re: number;
  im: number;
}

export const cx = (re: number, im = 0): Complex => ({ re, im });

export function cadd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function cmul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

export function cscale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

export function cabs2(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

export function cabs(a: Complex): number {
  return Math.sqrt(cabs2(a));
}

/** Returns the phase angle of the amplitude in radians, in (-π, π]. */
export function cphase(a: Complex): number {
  return Math.atan2(a.im, a.re);
}

/** Formats a complex number for display, e.g. `0.707`, `-0.500i`, `0.354-0.354i`. */
export function formatComplex(a: Complex, digits = 3): string {
  const round = (v: number) => {
    const r = Number(v.toFixed(digits));
    return Object.is(r, -0) ? 0 : r;
  };
  const re = round(a.re);
  const im = round(a.im);
  if (im === 0) return String(re);
  if (re === 0) return `${im}i`;
  return `${re}${im > 0 ? '+' : '-'}${Math.abs(im)}i`;
}
