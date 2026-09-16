import { formatComplex } from '../quantum/complex';
import {
  GATE_DEFS,
  allocateState,
  applyGate,
  basisLabel,
  qubitProbabilities,
  stateProbabilities,
} from '../quantum/gates';
import { reducedBlochVector } from '../quantum/bloch';
import type { CircuitOp, QuantumCircuit } from '../quantum/circuit';
import { circuitDepth, countGate, orderedOps } from '../quantum/circuit';
import type { SimulationResult, BasisAmplitude } from '../quantum/simulator';

/**
 * Interpretation layer between the raw simulator and the UI/tutor.
 *
 * Keeping the "what does this mean" logic here (instead of inside components) means the
 * tutor, the lesson runner and the challenge panel all describe a result the same way.
 */
export interface EntanglementAssessment {
  entangled: boolean;
  /** Qubit pairs whose reduced states are mixed, i.e. correlated with other qubits. */
  mixedQubits: number[];
  maxMagnitude: number;
  notes: string[];
}

export function assessEntanglement(result: SimulationResult): EntanglementAssessment {
  const mixedQubits = result.bloch
    .map((vector, qubit) => ({ qubit, magnitude: vector.magnitude }))
    .filter(entry => entry.magnitude < 0.999)
    .map(entry => entry.qubit);
  const maxMagnitude = result.bloch.reduce((max, vector) => Math.max(max, vector.magnitude), 0);
  const notes: string[] = [];
  if (result.numQubits === 1) {
    notes.push('A single qubit cannot be entangled with anything, so its Bloch vector keeps its full length.');
  } else if (mixedQubits.length === 0) {
    notes.push('Every qubit is in a pure state of its own, so the register is a product state — no entanglement.');
  } else {
    notes.push(
      `q${mixedQubits.join(', q')} ${mixedQubits.length > 1 ? 'have' : 'has'} reduced Bloch vectors shorter than 1, which is the signature of entanglement with the rest of the register.`,
    );
  }
  return {
    entangled: result.numQubits > 1 && mixedQubits.length > 0,
    mixedQubits,
    maxMagnitude,
    notes,
  };
}

export function significantStates(result: SimulationResult, threshold = 1e-9): BasisAmplitude[] {
  return result.probabilities.filter(entry => entry.probability > threshold);
}

/** Short, factual description of the state, for headers and tutor context. */
/**
 * Orders states by probability, falling back to the basis label.
 *
 * Without the tie-break, floating-point noise could put |11⟩ ahead of |00⟩ in a Bell state
 * on one run and the other way round on the next, so the same circuit would render its
 * state differently every time.
 */
function byProbabilityThenLabel(a: BasisAmplitude, b: BasisAmplitude): number {
  return b.probability - a.probability || a.label.localeCompare(b.label);
}

export function describeState(result: SimulationResult): string {
  const states = significantStates(result, 1e-6).sort(byProbabilityThenLabel);
  if (states.length === 0) return 'No state information yet.';
  if (states.length === 1 && states[0].probability > 0.9999) {
    return `${states[0].label} with probability 1`;
  }
  if (states.length === 2 && Math.abs(states[0].probability - 0.5) < 0.01) {
    return `an equal superposition of ${states[0].label} and ${states[1].label} (≈50% each)`;
  }
  return states
    .slice(0, 4)
    .map(entry => `${entry.label} ${(entry.probability * 100).toFixed(1)}%`)
    .join(' · ');
}

const SQRT_HALF = Math.SQRT1_2;

function approx(value: number, target: number, tolerance = 1e-6): boolean {
  return Math.abs(value - target) < tolerance;
}

/**
 * Formats one amplitude as a textbook coefficient.
 *
 * The numbers that dominate quantum computing are special-cased (1, −1, ±1/√2), so a
 * Hadamard reads as `1/√2|0⟩ + 1/√2|1⟩` instead of `0.707|0⟩ + 0.707|1⟩`.
 */
export function formatAmplitude(re: number, im: number): string {
  if (Math.abs(im) > 1e-6) return formatComplex({ re, im });
  if (approx(re, 1)) return '';
  if (approx(re, -1)) return '−';
  if (approx(re, SQRT_HALF)) return '1/√2';
  if (approx(re, -SQRT_HALF)) return '−1/√2';
  if (approx(re, 0)) return '0';
  const rounded = re.toFixed(3).replace(/\.?0+$/, '').replace('-', '−');
  return rounded === '' ? re.toPrecision(2).replace('-', '−') : rounded;
}

/**
 * The final state in Dirac notation, e.g. `1/√2|0⟩ + 1/√2|1⟩` or `1/√2|00⟩ + 1/√2|11⟩`.
 * Terms are ordered by probability so the dominant branches come first.
 */
export function formatStateVector(result: SimulationResult, limit = 6): string {
  const states = significantStates(result, 1e-6).sort(byProbabilityThenLabel).slice(0, limit);
  if (states.length === 0) return '—';
  const terms = states.map(entry => {
    const coefficient = formatAmplitude(entry.real, entry.imag);
    if (coefficient === '') return entry.label;
    if (coefficient === '−') return `−${entry.label}`;
    return `${coefficient}${entry.label}`;
  });
  return terms.join(' + ').replace(/ \+ −/g, ' − ');
}

/** The state every circuit starts from: all qubits in |0⟩. */
export function formatInitialState(numQubits: number): string {
  return basisLabel(0, Math.max(1, numQubits));
}

export function describeCircuit(circuit: QuantumCircuit): string {
  if (circuit.ops.length === 0) return `an empty ${circuit.numQubits}-qubit circuit`;
  const ops = orderedOps(circuit)
    .map(op => `${op.type}(${op.qubits.join(',')})`)
    .join(' → ');
  return `${circuit.numQubits}-qubit circuit of depth ${circuitDepth(circuit)}: ${ops}`;
}

export interface MeasurementSummary {
  label: string;
  count: number;
  percent: number;
  expected: number;
  deviation: number;
}

export function measurementSummary(result: SimulationResult): MeasurementSummary[] {
  return result.measurement.buckets.map(bucket => ({
    label: bucket.label,
    count: bucket.count,
    percent: bucket.measuredProbability * 100,
    expected: bucket.expectedCount,
    deviation: bucket.count - bucket.expectedCount,
  }));
}

/** Warnings the simulator or the validator produced, in a form ready for the UI. */
export function simulationWarnings(result: SimulationResult): string[] {
  const warnings = [...result.warnings];
  const sum = result.probabilities.reduce((acc, entry) => acc + entry.probability, 0);
  if (Math.abs(sum - 1) > 1e-6) {
    warnings.push(`Probabilities summed to ${sum.toFixed(6)} instead of 1 — rerun the circuit.`);
  }
  return warnings;
}

export function amplitudeTable(result: SimulationResult, limit = 16): {
  label: string;
  amplitude: string;
  probability: string;
  phase: number;
}[] {
  return result.probabilities
    .slice(0, limit)
    .map(entry => ({
      label: entry.label,
      amplitude: formatComplex({ re: entry.real, im: entry.imag }),
      probability: `${(entry.probability * 100).toFixed(2)}%`,
      phase: entry.phase,
    }));
}

/** Gate histogram used by the "circuit insight" panels. */
export function gateHistogram(circuit: QuantumCircuit): { type: string; count: number }[] {
  const types = new Set(circuit.ops.map(op => op.type));
  return [...types].map(type => ({ type, count: countGate(circuit, type) }));
}

export function basisSummary(numQubits: number, count = 4): string[] {
  return Array.from({ length: Math.min(count, 1 << numQubits) }, (_, index) => basisLabel(index, numQubits));
}

export interface EvolutionStep {
  index: number;
  op: CircuitOp;
  label: string;
  code: string;
  /** Probabilities after this gate, biggest first. */
  states: { label: string; probability: number }[];
  /** Per-qubit 0/1 marginals after this gate. */
  qubits: { qubit: number; p1: number }[];
}

/**
 * Replays the circuit gate by gate and records the state after each step.
 * This powers the tutor's "explain my circuit" answers and the simulator's step view,
 * and it uses the same evolution code as a real run so the numbers always agree.
 */
export function evolveStepByStep(circuit: QuantumCircuit, threshold = 1e-6): EvolutionStep[] {
  const state = allocateState(circuit.numQubits);
  const steps: EvolutionStep[] = [];
  orderedOps(circuit).forEach((op, index) => {
    if (op.type !== 'M') applyGate(state, op.type, op.qubits);
    const probabilities = stateProbabilities(state);
    const states = Array.from(probabilities)
      .map((probability, basisIndex) => ({
        label: basisLabel(basisIndex, circuit.numQubits),
        probability,
      }))
      .filter(entry => entry.probability > threshold)
      .sort((a, b) => b.probability - a.probability);
    steps.push({
      index,
      op,
      label: GATE_DEFS[op.type].label,
      code: GATE_DEFS[op.type].toCode(op.qubits),
      states,
      qubits: op.qubits.map(qubit => ({
        qubit,
        p1: qubitProbabilities(state, qubit).p1,
      })),
    });
  });
  return steps;
}

export interface Simplification {
  description: string;
  reason: string;
}

/**
 * Mechanically detectable circuit simplifications.
 *
 * Only gate identities that are exact (no approximation) are reported, and the tutor
 * always states what the state after the rewrite must still be, so the learner can
 * verify the claim by running both circuits.
 */
export function analyseSimplifications(circuit: QuantumCircuit): Simplification[] {
  const ops = orderedOps(circuit).filter(op => op.type !== 'M');
  const found: Simplification[] = [];
  const used = new Set<string>();

  const sameWires = (a: CircuitOp, b: CircuitOp) =>
    a.qubits.length === b.qubits.length && a.qubits.every((q, index) => q === b.qubits[index]);

  const pairIdentity: Partial<Record<string, string>> = {
    H: 'H·H = I',
    X: 'X·X = I',
    Y: 'Y·Y = I',
    Z: 'Z·Z = I',
    CNOT: 'two identical CNOTs cancel',
  };
  const pairMerge: Partial<Record<string, string>> = {
    S: 'S·S = Z',
    T: 'T·T = S',
  };

  for (let i = 0; i < ops.length - 1; i++) {
    const a = ops[i];
    const b = ops[i + 1];
    if (used.has(a.id) || used.has(b.id)) continue;
    if (!sameWires(a, b)) continue;
    if (a.type === b.type) {
      const identity = pairIdentity[a.type];
      if (identity && a.type !== 'S' && a.type !== 'T') {
        found.push({
          description: `Remove ${a.type}(${a.qubits.join(',')}) in steps ${a.column + 1} and ${b.column + 1}.`,
          reason: `${identity} on q${a.qubits.join(', q')}, so these gates do nothing.`,
        });
        used.add(a.id);
        used.add(b.id);
        continue;
      }
      if (pairMerge[a.type]) {
        found.push({
          description: `Replace the two ${a.type} gates on q${a.qubits.join(', q')} (steps ${a.column + 1} and ${b.column + 1}) with a single Z.`,
          reason: `${pairMerge[a.type]}.`,
        });
        used.add(a.id);
        used.add(b.id);
        continue;
      }
    }
    // Four T gates in a row equal Z.
    if (a.type === 'T' && b.type === 'T') {
      const next = ops[i + 2];
      const after = ops[i + 3];
      if (next && after && next.type === 'T' && after.type === 'T' && sameWires(b, next) && sameWires(next, after)) {
        found.push({
          description: `Replace four T gates on q${a.qubits.join(', q')} with a single Z.`,
          reason: 'T⁴ = Z.',
        });
        [a, b, next, after].forEach(op => used.add(op.id));
        continue;
      }
    }
    // H Z H = X and Z H Z = -X (up to a global phase, which is unobservable).
    const third = ops[i + 2];
    if (third && sameWires(a, third) && !used.has(third.id)) {
      const sandwich = `${a.type}${b.type}${third.type}`;
      if ((sandwich === 'HZH' || sandwich === 'ZHZ') && sameWires(a, b)) {
        found.push({
          description: `Replace ${sandwich} on q${a.qubits.join(', q')} with a single X.`,
          reason: `${sandwich} = ±X; the sign is a global phase and cannot be measured.`,
        });
        [a, b, third].forEach(op => used.add(op.id));
      }
    }
  }

  const measuredQubits = circuit.ops.filter(op => op.type === 'M').map(op => op.qubits[0]);
  const duplicateMeasurement = measuredQubits.filter((q, index) => measuredQubits.indexOf(q) !== index);
  if (duplicateMeasurement.length > 0) {
    found.push({
      description: `Remove the duplicate measurement on q${[...new Set(duplicateMeasurement)].join(', q')}.`,
      reason: 'Measuring the same wire twice adds no information.',
    });
  }

  return found;
}

/** Bloch vector of one qubit after a partial evolution (used for step animations). */
export function stepBloch(circuit: QuantumCircuit, uptoColumn: number) {
  const state = allocateState(circuit.numQubits);
  orderedOps(circuit)
    .filter(op => op.column <= uptoColumn)
    .forEach(op => {
      if (op.type !== 'M') applyGate(state, op.type, op.qubits);
    });
  return Array.from({ length: circuit.numQubits }, (_, qubit) => reducedBlochVector(state, qubit));
}
