import { cabs, cphase, formatComplex, type Complex } from '../quantum/complex';
import { GATE_DEFS, type GateType } from '../quantum/gates';

const EPSILON = 1e-9;
const SQRT_HALF = Math.SQRT1_2;

const approx = (value: number, target: number) => Math.abs(value - target) < EPSILON;

/**
 * Formats one matrix entry.
 *
 * Matrices are read far more easily as exact symbols than as decimals, and the gate set is
 * small and well known, so the constants that actually occur (0, ±1, ±1/√2, ±i and the phase
 * factors) are recognised. Anything else falls back to a trimmed decimal, which keeps this
 * honest for a new gate whose matrix is numeric.
 */
export function formatMatrixEntry(z: Complex): string {
  if (approx(z.re, 0) && approx(z.im, 0)) return '0';

  // Purely real or purely imaginary entries are the common case.
  if (approx(z.im, 0)) return formatReal(z.re);
  if (approx(z.re, 0)) {
    const magnitude = formatReal(z.im);
    if (magnitude === '1') return 'i';
    if (magnitude === '−1') return '−i';
    return `${magnitude}i`;
  }

  // Unit-modulus phases: S and T sit here.
  if (approx(cabs(z), 1)) {
    const phase = cphase(z);
    if (approx(phase, Math.PI / 2)) return 'i';
    if (approx(phase, -Math.PI / 2)) return '−i';
    if (approx(phase, Math.PI / 4)) return 'e^(iπ/4)';
    if (approx(phase, -Math.PI / 4)) return 'e^(−iπ/4)';
    if (approx(phase, Math.PI)) return '−1';
  }

  return formatComplex(z).replace(/-/g, '−');
}

function formatReal(value: number): string {
  if (approx(value, 0)) return '0';
  if (approx(value, 1)) return '1';
  if (approx(value, -1)) return '−1';
  if (approx(value, SQRT_HALF)) return '1/√2';
  if (approx(value, -SQRT_HALF)) return '−1/√2';
  const rounded = Number(value.toFixed(3));
  const text = String(Object.is(rounded, -0) ? 0 : rounded);
  return text.replace(/-/g, '−');
}

export interface GateReferenceEntry {
  type: GateType;
  label: string;
  name: string;
  color: string;
  /** The 2x2 unitary the engine applies, already formatted. Empty for CNOT and measurement. */
  matrix: string[][] | null;
  /** How to read the gate when it is not a plain 2x2 matrix. */
  note: string;
  description: string;
}

/**
 * The gate reference shown in the course catalogue.
 *
 * It is derived from `GATE_DEFS`, which is the same table the simulator multiplies into the
 * state vector, so the matrices on the page cannot drift away from the matrices being run.
 */
export function gateReference(): GateReferenceEntry[] {
  return (Object.keys(GATE_DEFS) as GateType[]).map(type => {
    const def = GATE_DEFS[type];
    const matrix = def.matrix
      ? def.matrix.map(row => row.map(entry => formatMatrixEntry(entry)))
      : null;
    const note =
      type === 'CNOT'
        ? 'Controlled-X: a 4×4 unitary that applies X to the target only when the control is |1⟩.'
        : type === 'M'
          ? 'Not a unitary. Measurement samples the Born distribution and collapses the state.'
          : `${def.arity}-qubit unitary.`;
    return {
      type,
      label: def.label,
      name: def.name,
      color: def.color,
      matrix,
      note,
      description: def.description,
    };
  });
}
