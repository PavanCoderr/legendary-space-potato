import {
  BlochVector,
  reducedBlochVector,
} from './bloch';
import {
  QuantumCircuit,
  CircuitIssue,
  CircuitOp,
  orderedOps,
  validateCircuit,
} from './circuit';
import { Complex } from './complex';
import {
  GATE_DEFS,
  GateType,
  StateVector,
  allocateState,
  applyGate,
  basisLabel,
  gateDefinition,
  qubitMask,
  qubitProbabilities,
  stateProbabilities,
} from './gates';

/** One gate as it was executed, kept so the UI and tutor can replay the circuit. */
export interface AppliedOperation {
  opId: string;
  type: GateType;
  label: string;
  qubits: number[];
  column: number;
  /** Qiskit-style statement for this single gate. */
  code: string;
}

export interface BasisAmplitude {
  index: number;
  label: string;
  real: number;
  imag: number;
  probability: number;
  /** Phase in radians, for phase-coloured rendering. */
  phase: number;
}

export interface MeasurementBucket {
  index: number;
  label: string;
  count: number;
  /** count / shots */
  measuredProbability: number;
  /** |amplitude|², the ideal probability the sampled counts estimate. */
  idealProbability: number;
  /** shots * idealProbability — what the counts should be on average. */
  expectedCount: number;
}

export interface QubitOutcome {
  qubit: number;
  zeros: number;
  ones: number;
  p0: number;
  p1: number;
}

export interface SimulationResult {
  circuitId: string;
  circuitName: string;
  numQubits: number;
  shots: number;
  operations: AppliedOperation[];
  unitaryCount: number;
  hasMeasurementGates: boolean;
  amplitudes: BasisAmplitude[];
  probabilities: BasisAmplitude[];
  qubitProbabilities: { qubit: number; p0: number; p1: number }[];
  bloch: BlochVector[];
  measurement: {
    buckets: MeasurementBucket[];
    qubitOutcomes: QubitOutcome[];
    sampledStates: string[];
  };
  warnings: string[];
  ranAt: number;
  /** Wall-clock duration of the state-vector evolution in milliseconds. */
  elapsedMs: number;
}

export interface SimulationOptions {
  shots?: number;
  /** Injectable randomness so tests and reproducible runs can pass a seeded PRNG. */
  random?: () => number;
  now?: () => number;
}

export interface SimulationOutcome {
  ok: boolean;
  result: SimulationResult | null;
  issues: CircuitIssue[];
}

export const DEFAULT_SHOTS = 1000;
export const SHOT_PRESETS = [100, 512, 1000, 4096, 10000];

/** Deterministic PRNG (mulberry32) used when a run asks for a reproducible seed. */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function describeOperation(op: CircuitOp): AppliedOperation {
  const def = GATE_DEFS[op.type];
  return {
    opId: op.id,
    type: op.type,
    label: def.label,
    qubits: [...op.qubits],
    column: op.column,
    code: def.toCode(op.qubits),
  };
}

/** Evolves the register through every non-measurement gate, left to right. */
export function evolveState(circuit: QuantumCircuit): StateVector {
  const state = allocateState(circuit.numQubits);
  for (const op of orderedOps(circuit)) {
    if (op.type === 'M') continue; // deferred measurement, see applyMeasurementSemantics
    applyGate(state, op.type, op.qubits);
  }
  return state;
}

function sampleIndex(probabilities: Float64Array, random: () => number, total: number): number {
  const r = random() * total;
  let acc = 0;
  for (let i = 0; i < probabilities.length; i++) {
    acc += probabilities[i];
    if (r < acc) return i;
  }
  // Numerical drift: fall back to the largest probability.
  let best = 0;
  for (let i = 1; i < probabilities.length; i++) {
    if (probabilities[i] > probabilities[best]) best = i;
  }
  return best;
}

/**
 * Runs the circuit and returns real state-vector results plus sampled shot counts.
 *
 * Measurement semantics: measurement gates are executed at the end of the circuit,
 * matching Qiskit's `measure_all()`. Counts are therefore drawn from the Born rule on
 * the final state instead of being hard-coded, so a Bell circuit really does produce
 * only |00⟩ and |11⟩ outcomes.
 */
export function runSimulation(
  circuit: QuantumCircuit,
  options: SimulationOptions = {},
): SimulationOutcome {
  const issues = validateCircuit(circuit);
  if (issues.some(issue => issue.severity === 'error')) {
    return { ok: false, result: null, issues };
  }

  const shots = Math.max(1, Math.floor(options.shots ?? DEFAULT_SHOTS));
  const random = options.random ?? Math.random;
  const now = options.now ?? (() => Date.now());
  const started = now();

  const state = evolveState(circuit);
  const probabilities = stateProbabilities(state);

  // Guard against tiny numerical drift so the distribution always sums to 1.
  const total = probabilities.reduce((sum, p) => sum + p, 0);
  if (total > 0 && Math.abs(total - 1) > 1e-9) {
    for (let i = 0; i < probabilities.length; i++) probabilities[i] /= total;
  }

  const amplitudes: BasisAmplitude[] = [];
  for (let i = 0; i < probabilities.length; i++) {
    amplitudes.push({
      index: i,
      label: basisLabel(i, circuit.numQubits),
      real: state.re[i],
      imag: state.im[i],
      probability: probabilities[i],
      phase: Math.atan2(state.im[i], state.re[i]),
    });
  }

  const counts = new Map<number, number>();
  const samples: number[] = [];
  for (let s = 0; s < shots; s++) {
    const index = sampleIndex(probabilities, random, total || 1);
    counts.set(index, (counts.get(index) ?? 0) + 1);
    samples.push(index);
  }

  const buckets: MeasurementBucket[] = [];
  for (let i = 0; i < probabilities.length; i++) {
    const count = counts.get(i) ?? 0;
    if (count === 0 && probabilities[i] < 1e-12) continue;
    buckets.push({
      index: i,
      label: basisLabel(i, circuit.numQubits),
      count,
      measuredProbability: count / shots,
      idealProbability: probabilities[i],
      expectedCount: probabilities[i] * shots,
    });
  }
  buckets.sort((a, b) => b.count - a.count || a.index - b.index);

  const qubitOutcomes: QubitOutcome[] = [];
  for (let q = 0; q < circuit.numQubits; q++) {
    const mask = qubitMask(circuit.numQubits, q);
    let ones = 0;
    for (const index of samples) if ((index & mask) !== 0) ones += 1;
    const { p0, p1 } = qubitProbabilities(state, q);
    qubitOutcomes.push({ qubit: q, zeros: shots - ones, ones, p0, p1 });
  }

  const bloch: BlochVector[] = [];
  for (let q = 0; q < circuit.numQubits; q++) bloch.push(reducedBlochVector(state, q));

  const hasMeasurementGates = circuit.ops.some(op => op.type === 'M');
  const warnings: string[] = [];
  if (!hasMeasurementGates && circuit.ops.length > 0) {
    warnings.push(
      'No measurement gates found — QubitVerse sampled the final state anyway. Add M gates to make the measurement explicit.',
    );
  }
  if (circuit.ops.length === 0) {
    warnings.push('The circuit is empty, so nothing happened: the register is still in |0…0⟩.');
  }
  issues
    .filter(issue => issue.severity === 'warning')
    .forEach(issue => warnings.push(issue.message));

  const result: SimulationResult = {
    circuitId: circuit.id,
    circuitName: circuit.name,
    numQubits: circuit.numQubits,
    shots,
    operations: orderedOps(circuit).map(describeOperation),
    unitaryCount: circuit.ops.filter(op => op.type !== 'M').length,
    hasMeasurementGates,
    amplitudes,
    probabilities: amplitudes,
    qubitProbabilities: Array.from({ length: circuit.numQubits }, (_, q) => ({
      qubit: q,
      ...qubitProbabilities(state, q),
    })),
    bloch,
    measurement: {
      buckets,
      qubitOutcomes,
      sampledStates: buckets.map(bucket => `${bucket.label} × ${bucket.count}`),
    },
    warnings,
    ranAt: now(),
    elapsedMs: Math.max(0, (now() - started) * 1000) / 1000,
  };

  return { ok: true, result, issues };
}

/**
 * Convenience wrapper used by the lessons and the practice system: run and return the
 * result, or throw a readable error list when the circuit is invalid.
 */
export function simulate(circuit: QuantumCircuit, options?: SimulationOptions): SimulationResult {
  const outcome = runSimulation(circuit, options);
  if (!outcome.ok || !outcome.result) {
    const detail = outcome.issues.map(issue => issue.message).join(' ');
    throw new Error(`Cannot simulate this circuit. ${detail}`);
  }
  return outcome.result;
}

export type { Complex };
export { gateDefinition };
