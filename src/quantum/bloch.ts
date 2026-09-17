import { StateVector, qubitMask, stateProbabilities } from './gates';

/** Bloch sphere geometry derived from a (possibly mixed) single-qubit state. */
export interface BlochVector {
  x: number;
  y: number;
  z: number;
  /** Length of the Bloch vector: 1 for a pure state, less for a mixed/reduced state. */
  magnitude: number;
  /** Polar angle from the +Z axis, in radians (0..π). */
  theta: number;
  /** Azimuth in the XY plane, in radians (-π..π], measured from +X towards +Y. */
  phi: number;
  /** Tr(ρ²): 0.5 for a fully mixed state, 1 for a pure state. */
  purity: number;
  isMixed: boolean;
}

/**
 * Bloch vector of a single qubit inside an n-qubit register.
 *
 * We first trace out the other qubits to get the reduced density matrix
 * ρ = [[p0, ρ01], [ρ10, p1]] and then read the vector off as
 * (Tr(ρX), Tr(ρY), Tr(ρZ)) = (2Re ρ01, -2Im ρ01, p0 - p1).
 *
 * For entangled qubits this correctly produces a vector shorter than 1, which is
 * exactly what a learner should see on a Bell state.
 */
export function reducedBlochVector(state: StateVector, qubit: number): BlochVector {
  const mask = qubitMask(state.numQubits, qubit);
  const dim = state.re.length;
  let p0 = 0;
  let rho01re = 0;
  let rho01im = 0;
  for (let i = 0; i < dim; i++) {
    if ((i & mask) !== 0) continue;
    const j = i | mask;
    p0 += state.re[i] * state.re[i] + state.im[i] * state.im[i];
    // ρ01 = Σ a_i * conj(a_j)
    rho01re += state.re[i] * state.re[j] + state.im[i] * state.im[j];
    rho01im += state.im[i] * state.re[j] - state.re[i] * state.im[j];
  }
  const p1 = 1 - p0;
  const x = 2 * rho01re;
  const y = -2 * rho01im;
  const z = p0 - p1;
  return finalizeBloch(x, y, z);
}

export function blochFromAngles(theta: number, phi: number, magnitude = 1): BlochVector {
  const x = magnitude * Math.sin(theta) * Math.cos(phi);
  const y = magnitude * Math.sin(theta) * Math.sin(phi);
  const z = magnitude * Math.cos(theta);
  return finalizeBloch(x, y, z);
}

export function finalizeBloch(x: number, y: number, z: number): BlochVector {
  const raw = Math.sqrt(x * x + y * y + z * z);
  const magnitude = clamp01(raw);
  const theta = Math.acos(magnitude > 1e-9 ? clampUnit(z / magnitude) : 0);
  const phi = Math.atan2(y, x);
  const purity = (1 + raw * raw) / 2;
  return {
    x,
    y,
    z,
    magnitude,
    theta,
    phi,
    purity,
    isMixed: raw < 1 - 1e-6,
  };
}

/** Cartesian point on the unit sphere for rendering. */
export function blochToCartesian(vector: BlochVector, radius = 1) {
  const m = Math.max(vector.magnitude, 1e-9);
  const scale = radius * vector.magnitude;
  return {
    x: (vector.x / m) * scale,
    y: (vector.y / m) * scale,
    z: (vector.z / m) * scale,
  };
}

/** The pure state (up to a global phase) described by a Bloch vector. */
export function blochToAmplitudes(vector: BlochVector): { alpha: number; betaRe: number; betaIm: number } {
  const theta = vector.theta;
  const phi = vector.phi;
  return {
    alpha: Math.cos(theta / 2),
    betaRe: Math.sin(theta / 2) * Math.cos(phi),
    betaIm: Math.sin(theta / 2) * Math.sin(phi),
  };
}

/** Human-readable name of the region of the sphere the vector points at. */
export function describeBlochPosition(vector: BlochVector): string {
  if (vector.isMixed) {
    if (vector.magnitude < 0.02) return 'maximally mixed (the qubit is entangled or measured)';
    return 'partially mixed — the qubit is entangled with the others';
  }
  if (vector.z > 0.99) return '|0⟩ (north pole)';
  if (vector.z < -0.99) return '|1⟩ (south pole)';
  if (vector.x > 0.9) return '|+⟩ (on the +X equator)';
  if (vector.x < -0.9) return '|−⟩ (on the −X equator)';
  if (vector.y > 0.9) return '|+i⟩ (on the +Y equator)';
  if (vector.y < -0.9) return '|−i⟩ (on the −Y equator)';
  const parts: string[] = [];
  if (Math.abs(vector.x) > 0.05) parts.push(`${vector.x > 0 ? '+' : '−'}X`);
  if (Math.abs(vector.y) > 0.05) parts.push(`${vector.y > 0 ? '+' : '−'}Y`);
  if (Math.abs(vector.z) > 0.05) parts.push(`${vector.z > 0 ? '+' : '−'}Z`);
  return `a superposition pointing towards ${parts.join(', ')}`;
}

function clampUnit(v: number): number {
  return Math.min(1, Math.max(-1, v));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Probabilities of 0/1 for one qubit, re-exported for convenience. */
export { stateProbabilities };
