import { Complex, cx } from './complex';

/**
 * Gate catalog and the low level linear algebra used to apply gates to a state vector.
 *
 * State vector convention: an `n` qubit register is a vector of 2^n amplitudes where
 * index `i` is the basis state |b_{n-1} ... b_1 b_0> and qubit `q` owns the bit
 * `1 << (n - 1 - q)`. So qubit 0 is the most significant bit, matching Qiskit's
 * little-endian-free display convention where |q0 q1> is printed left to right.
 */
export type GateType = 'H' | 'X' | 'Y' | 'Z' | 'S' | 'T' | 'CNOT' | 'M';

export interface GateDefinition {
  type: GateType;
  /** Short label drawn inside the circuit box. */
  label: string;
  name: string;
  /** Number of qubits the gate touches. */
  arity: 1 | 2;
  category: 'single' | 'two' | 'measure';
  matrix?: Complex[][];
  description: string;
  /** What happens on the Bloch sphere, phrased for the tutor and lesson copy. */
  blochEffect: string;
  color: string;
  /** Qiskit-style source line, given the resolved qubit targets. */
  toCode: (qubits: number[]) => string;
}

const SQRT1_2 = Math.SQRT1_2;

export const HADAMARD: Complex[][] = [
  [cx(SQRT1_2), cx(SQRT1_2)],
  [cx(SQRT1_2), cx(-SQRT1_2)],
];

export const PAULI_X: Complex[][] = [
  [cx(0), cx(1)],
  [cx(1), cx(0)],
];

export const PAULI_Y: Complex[][] = [
  [cx(0), cx(0, -1)],
  [cx(0, 1), cx(0)],
];

export const PAULI_Z: Complex[][] = [
  [cx(1), cx(0)],
  [cx(0), cx(-1)],
];

export const PHASE_S: Complex[][] = [
  [cx(1), cx(0)],
  [cx(0), cx(0, 1)],
];

export const PHASE_T: Complex[][] = [
  [cx(1), cx(0)],
  [cx(0), cx(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4))],
];

export const GATE_DEFS: Record<GateType, GateDefinition> = {
  H: {
    type: 'H',
    label: 'H',
    name: 'Hadamard',
    arity: 1,
    category: 'single',
    matrix: HADAMARD,
    description:
      'Creates an equal superposition: it maps |0⟩ to (|0⟩+|1⟩)/√2 and |1⟩ to (|0⟩−|1⟩)/√2.',
    blochEffect: 'Rotates the state vector 90° about the Y axis, moving |0⟩ to the +X equator.',
    // Gate colours are CSS custom properties that both themes define (see styles.css), so
    // the palette, grid and reference table stay readable in light and dark alike.
    color: 'var(--gate-h)',
    toCode: q => `qc.h(${q[0]})`,
  },
  X: {
    type: 'X',
    label: 'X',
    name: 'Pauli-X (NOT)',
    arity: 1,
    category: 'single',
    matrix: PAULI_X,
    description: 'The quantum NOT: it swaps the amplitudes of |0⟩ and |1⟩.',
    blochEffect: 'Rotates 180° about the X axis, flipping the state to the opposite pole.',
    color: 'var(--gate-x)',
    toCode: q => `qc.x(${q[0]})`,
  },
  Y: {
    type: 'Y',
    label: 'Y',
    name: 'Pauli-Y',
    arity: 1,
    category: 'single',
    matrix: PAULI_Y,
    description: 'Bit flip combined with a phase flip; rotates 180° about the Y axis.',
    blochEffect: 'Rotates 180° about the Y axis, so |0⟩ goes to −i|1⟩.',
    color: 'var(--gate-y)',
    toCode: q => `qc.y(${q[0]})`,
  },
  Z: {
    type: 'Z',
    label: 'Z',
    name: 'Pauli-Z',
    arity: 1,
    category: 'single',
    matrix: PAULI_Z,
    description: 'Phase flip: leaves |0⟩ alone and flips the sign of |1⟩.',
    blochEffect: 'Rotates 180° about the Z axis, flipping the phase of |1⟩.',
    color: 'var(--gate-z)',
    toCode: q => `qc.z(${q[0]})`,
  },
  S: {
    type: 'S',
    label: 'S',
    name: 'Phase (√Z)',
    arity: 1,
    category: 'single',
    matrix: PHASE_S,
    description: 'Adds a 90° (π/2) phase to |1⟩, a quarter turn about the Z axis.',
    blochEffect: 'Rotates the state vector 90° about the Z axis.',
    color: 'var(--gate-s)',
    toCode: q => `qc.s(${q[0]})`,
  },
  T: {
    type: 'T',
    label: 'T',
    name: 'T (π/8)',
    arity: 1,
    category: 'single',
    matrix: PHASE_T,
    description: 'Adds a 45° (π/4) phase to |1⟩. Two T gates equal one S gate.',
    blochEffect: 'Rotates the state vector 45° about the Z axis.',
    color: 'var(--gate-t)',
    toCode: q => `qc.t(${q[0]})`,
  },
  CNOT: {
    type: 'CNOT',
    label: 'CX',
    name: 'Controlled-NOT',
    arity: 2,
    category: 'two',
    description:
      'Flips the target qubit only when the control qubit is |1⟩. It is the standard tool for creating entanglement.',
    blochEffect:
      'On its own it never changes the control; applied to a superpositioned control it entangles the pair (the individual Bloch vectors shrink).',
    color: 'var(--gate-cnot)',
    toCode: q => `qc.cx(${q[1]}, ${q[0]})`,
  },
  M: {
    type: 'M',
    label: 'M',
    name: 'Measurement',
    arity: 1,
    category: 'measure',
    description:
      'Reads the qubit in the computational basis. QubitVerse executes measurement gates at the end of the circuit (like Qiskit\'s measure_all), so they do not disturb the unitaries before them.',
    blochEffect: 'Collapses the state vector onto the measured outcome.',
    color: 'var(--gate-m)',
    toCode: q => `qc.measure(${q[0]}, ${q[0]})`,
  },
};

/** Order used by the gate palette and by code generation. */
export const GATE_ORDER: GateType[] = ['H', 'X', 'Y', 'Z', 'S', 'T', 'CNOT', 'M'];

export const SINGLE_QUBIT_GATES: GateType[] = ['H', 'X', 'Y', 'Z', 'S', 'T'];

export function isGateType(value: string): value is GateType {
  return Object.prototype.hasOwnProperty.call(GATE_DEFS, value);
}

export function gateDefinition(type: GateType): GateDefinition {
  return GATE_DEFS[type];
}

/** A state vector split into real and imaginary parts, both of length 2^n. */
export interface StateVector {
  re: Float64Array;
  im: Float64Array;
  numQubits: number;
}

export function allocateState(numQubits: number): StateVector {
  const dim = 1 << numQubits;
  const re = new Float64Array(dim);
  const im = new Float64Array(dim);
  re[0] = 1; // |00...0>
  return { re, im, numQubits };
}

export function cloneState(state: StateVector): StateVector {
  return {
    re: Float64Array.from(state.re),
    im: Float64Array.from(state.im),
    numQubits: state.numQubits,
  };
}

/** Bit mask that selects qubit `q` inside a 2^n amplitude index. */
export function qubitMask(numQubits: number, q: number): number {
  return 1 << (numQubits - 1 - q);
}

/**
 * Applies an arbitrary 2x2 matrix to `qubit` in place. Every pair of amplitudes that
 * differ only in that qubit is transformed independently.
 */
export function applySingleQubit(
  state: StateVector,
  matrix: Complex[][],
  qubit: number,
): void {
  const mask = qubitMask(state.numQubits, qubit);
  const dim = state.re.length;
  const [[m00, m01], [m10, m11]] = matrix;
  for (let i = 0; i < dim; i++) {
    if ((i & mask) !== 0) continue;
    const j = i | mask;
    const a0r = state.re[i];
    const a0i = state.im[i];
    const a1r = state.re[j];
    const a1i = state.im[j];
    state.re[i] = m00.re * a0r - m00.im * a0i + m01.re * a1r - m01.im * a1i;
    state.im[i] = m00.re * a0i + m00.im * a0r + m01.re * a1i + m01.im * a1r;
    state.re[j] = m10.re * a0r - m10.im * a0i + m11.re * a1r - m11.im * a1i;
    state.im[j] = m10.re * a0i + m10.im * a0r + m11.re * a1i + m11.im * a1r;
  }
}

/** Controlled version of a 2x2 matrix: applies the matrix to `target` when `control` is |1⟩. */
export function applyControlled(
  state: StateVector,
  matrix: Complex[][],
  control: number,
  target: number,
): void {
  const cMask = qubitMask(state.numQubits, control);
  const tMask = qubitMask(state.numQubits, target);
  const dim = state.re.length;
  const [[m00, m01], [m10, m11]] = matrix;
  for (let i = 0; i < dim; i++) {
    if ((i & cMask) === 0) continue;
    if ((i & tMask) !== 0) continue;
    const j = i | tMask;
    const a0r = state.re[i];
    const a0i = state.im[i];
    const a1r = state.re[j];
    const a1i = state.im[j];
    state.re[i] = m00.re * a0r - m00.im * a0i + m01.re * a1r - m01.im * a1i;
    state.im[i] = m00.re * a0i + m00.im * a0r + m01.re * a1i + m01.im * a1r;
    state.re[j] = m10.re * a0r - m10.im * a0i + m11.re * a1r - m11.im * a1i;
    state.im[j] = m10.re * a0i + m10.im * a0r + m11.re * a1i + m11.im * a1r;
  }
}

/**
 * Applies one gate described by its type and target wires.
 * Returns the information the simulator needs for bookkeeping.
 */
export function applyGate(
  state: StateVector,
  type: GateType,
  qubits: number[],
): void {
  const def = GATE_DEFS[type];
  if (type === 'CNOT') {
    applyControlled(state, PAULI_X, qubits[1], qubits[0]);
    return;
  }
  if (type === 'M' || !def.matrix) return; // measurement is handled by the simulator
  applySingleQubit(state, def.matrix, qubits[0]);
}

/** Probability of measuring each computational basis state. */
export function stateProbabilities(state: StateVector): Float64Array {
  const dim = state.re.length;
  const probs = new Float64Array(dim);
  for (let i = 0; i < dim; i++) {
    probs[i] = state.re[i] * state.re[i] + state.im[i] * state.im[i];
  }
  return probs;
}

/** Probability that a single qubit reads 0 or 1 (marginal over all other qubits). */
export function qubitProbabilities(
  state: StateVector,
  qubit: number,
): { p0: number; p1: number } {
  const probs = stateProbabilities(state);
  const mask = qubitMask(state.numQubits, qubit);
  let p1 = 0;
  for (let i = 0; i < probs.length; i++) {
    if ((i & mask) !== 0) p1 += probs[i];
  }
  return { p0: 1 - p1, p1 };
}

/** Basis-state label such as `|01⟩`, with qubit 0 printed first. */
export function basisLabel(index: number, numQubits: number): string {
  let bits = '';
  for (let q = 0; q < numQubits; q++) {
    bits += (index & qubitMask(numQubits, q)) !== 0 ? '1' : '0';
  }
  return `|${bits}⟩`;
}
