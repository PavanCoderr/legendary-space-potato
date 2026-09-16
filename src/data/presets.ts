import type { GateType, SerializedCircuit } from '../quantum';

/**
 * Builds a serialized circuit from a column-based description:
 * every inner array is one time step (column) and holds `[gate, qubits]` pairs.
 */
export function preset(
  name: string,
  numQubits: number,
  steps: [GateType, number[]][][],
): SerializedCircuit {
  return {
    name,
    numQubits,
    ops: steps.flatMap((step, column) =>
      step.map(([type, qubits]) => ({ type, qubits: [...qubits], column })),
    ),
  };
}

export const superpositionCircuit = () =>
  preset('Superposition', 1, [[['H', [0]]], [['M', [0]]]]);

export const xFlipCircuit = () => preset('Bit flip', 1, [[['X', [0]]], [['M', [0]]]]);

export const phaseCircuit = () =>
  preset('Phase kick', 1, [[['H', [0]]], [['S', [0]]], [['M', [0]]]]);

export const bellCircuit = () =>
  preset('Bell state', 2, [[['H', [0]]], [['CNOT', [1, 0]]], [['M', [0]], ['M', [1]]]]);

export const hzhCircuit = () =>
  preset('HZH equals X', 1, [[['H', [0]]], [['Z', [0]]], [['H', [0]]], [['M', [0]]]]);

/**
 * Two-qubit Grover for the marked state |11⟩.
 * Oracle: CZ on (q0, q1) built from H + CNOT + H.  Diffusion: H, X, CZ, X, H on both wires.
 * HZH = X identifies the diffusion step; the whole round maps |00⟩ to |11⟩ exactly.
 */
export const groverCircuit = () =>
  preset('Grover search for |11⟩', 2, [
    [['H', [0]], ['H', [1]]],
    [['H', [1]]],
    [['CNOT', [1, 0]]],
    [['H', [1]]],
    [['H', [0]], ['H', [1]]],
    [['X', [0]], ['X', [1]]],
    [['H', [1]]],
    [['CNOT', [1, 0]]],
    [['H', [1]]],
    [['X', [0]], ['X', [1]]],
    [['H', [0]], ['H', [1]]],
    [['M', [0]], ['M', [1]]],
  ]);

/**
 * Deutsch–Jozsa for one input qubit with the balanced oracle f(x) = x.
 * The oracle is CNOT (control q0, target q1); the measurement on q1 reads 1 for balanced.
 */
export const deutschJozsaCircuit = () =>
  preset('Deutsch–Jozsa (balanced oracle)', 2, [
    [['X', [1]]],
    [['H', [0]], ['H', [1]]],
    [['CNOT', [1, 0]]],
    [['H', [0]]],
    [['M', [0]]],
  ]);

/** Ancilla-free preparation of a Bell pair plus the message qubit of a teleportation run. */
export const teleportationPrepCircuit = () =>
  preset('Teleportation state preparation', 3, [
    [['X', [0]]],
    [['H', [1]]],
    [['CNOT', [2, 1]]],
    [['CNOT', [1, 0]]],
    [['H', [0]]],
  ]);

export const SAMPLE_CIRCUITS: { id: string; name: string; description: string; build: () => SerializedCircuit }[] = [
  { id: 'superposition', name: 'Superposition', description: 'H on one qubit, then measure.', build: superpositionCircuit },
  { id: 'bell', name: 'Bell state', description: 'H + CNOT entanglement generator.', build: bellCircuit },
  { id: 'hzh', name: 'HZH = X', description: 'Shows that gate order matters.', build: hzhCircuit },
  { id: 'grover', name: 'Grover (2 qubits)', description: 'Amplitude amplification of |11⟩.', build: groverCircuit },
  { id: 'deutsch', name: 'Deutsch–Jozsa', description: 'One-shot balanced oracle test.', build: deutschJozsaCircuit },
  { id: 'teleport', name: 'Teleportation prep', description: 'Bell pair + message encoding.', build: teleportationPrepCircuit },
];
