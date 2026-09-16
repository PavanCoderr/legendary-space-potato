import { describe, expect, it } from 'vitest';
import { addOp, createCircuit, type QuantumCircuit } from '../quantum/circuit';
import type { GateType } from '../quantum/gates';
import { runSimulation } from '../quantum/simulator';
import { formatAmplitude, formatInitialState, formatStateVector } from './analysis';

/**
 * These cases run the real simulator rather than asserting against hand-written amplitudes,
 * so the formatted state is checked against the physics, not against a transcription of it.
 */
function simulate(gates: [GateType, number[]][], numQubits = 1) {
  let circuit: QuantumCircuit = createCircuit('formatting fixture', numQubits);
  for (const [type, qubits] of gates) {
    const outcome = addOp(circuit, type, qubits);
    if (outcome.error) throw new Error(outcome.error);
    circuit = outcome.circuit;
  }
  const outcome = runSimulation(circuit, { shots: 100 });
  if (!outcome.ok || !outcome.result) {
    throw new Error(`fixture failed to simulate: ${outcome.issues.map(issue => issue.message).join(' ')}`);
  }
  return outcome.result;
}

describe('formatAmplitude', () => {
  it('omits unity and spells out the constants that matter', () => {
    expect(formatAmplitude(1, 0)).toBe('');
    expect(formatAmplitude(-1, 0)).toBe('−');
    expect(formatAmplitude(Math.SQRT1_2, 0)).toBe('1/√2');
    expect(formatAmplitude(-Math.SQRT1_2, 0)).toBe('−1/√2');
    expect(formatAmplitude(0, 0)).toBe('0');
  });

  it('rounds the rest and keeps an imaginary part visible', () => {
    expect(formatAmplitude(0.353553, 0)).toBe('0.354');
    expect(formatAmplitude(0.5, 0)).toBe('0.5');
    expect(formatAmplitude(0.5, 0.5)).toContain('i');
  });
});

describe('formatInitialState', () => {
  it('shows every qubit starting in |0⟩', () => {
    expect(formatInitialState(1)).toBe('|0⟩');
    expect(formatInitialState(2)).toBe('|00⟩');
    expect(formatInitialState(3)).toBe('|000⟩');
  });
});

describe('formatStateVector', () => {
  it('renders Hadamard superposition the way the lessons write it', () => {
    expect(formatStateVector(simulate([['H', [0]]]))).toBe('1/√2|0⟩ + 1/√2|1⟩');
  });

  it('renders a definite basis state without a coefficient', () => {
    expect(formatStateVector(simulate([['X', [0]]]))).toBe('|1⟩');
  });

  it('keeps the minus sign of a relative phase', () => {
    expect(formatStateVector(simulate([['H', [0]], ['Z', [0]]]))).toBe('1/√2|0⟩ − 1/√2|1⟩');
  });

  it('renders the Bell state with only its two correlated branches', () => {
    // Two quirks of this codebase, both easy to get wrong: the gate type key is CNOT ("CX"
    // is just the display label), and operands are [target, control] — so CNOT with
    // control q0 and target q1 is `[1, 0]`. Passing [0, 1] yields |00⟩ + |10⟩ instead.
    expect(formatStateVector(simulate([['H', [0]], ['CNOT', [1, 0]]], 2))).toBe('1/√2|00⟩ + 1/√2|11⟩');
  });

  it('does not entangle when the CNOT operands are the wrong way round', () => {
    // Documents the failure mode that a reversed operand order silently produces.
    expect(formatStateVector(simulate([['H', [0]], ['CNOT', [0, 1]]], 2))).toBe('1/√2|00⟩ + 1/√2|10⟩');
  });

  it('is deterministic for equally likely branches', () => {
    // Ten runs of the same circuit must produce byte-identical output.
    const rendered = new Set(
      Array.from({ length: 10 }, () =>
        formatStateVector(simulate([['H', [0]], ['CNOT', [1, 0]]], 2)),
      ),
    );
    expect(rendered.size).toBe(1);
  });

  it('falls back to a dash when nothing has amplitude', () => {
    const empty = simulate([], 1);
    expect(formatStateVector(empty)).toBe('|0⟩');
  });
});
