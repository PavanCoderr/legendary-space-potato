import { describe, expect, it } from 'vitest';
import { addOp, createCircuit, QuantumCircuit } from './circuit';
import { createSeededRandom, runSimulation, simulate } from './simulator';

/** Builds a circuit from a compact instruction list, e.g. [['H', [0]], ['CNOT', [1, 0]]]. */
function build(numQubits: number, instructions: [Parameters<typeof addOp>[1], number[]][]): QuantumCircuit {
  let circuit = createCircuit('test', numQubits);
  for (const [type, qubits] of instructions) {
    const outcome = addOp(circuit, type, qubits);
    if (outcome.error) throw new Error(outcome.error);
    circuit = outcome.circuit;
  }
  return circuit;
}

function probabilityOf(circuit: QuantumCircuit, label: string, shots = 4096) {
  const result = simulate(circuit, { shots });
  return result.probabilities.find(p => p.label === label)?.probability ?? 0;
}

describe('state-vector simulator', () => {
  it('starts in |0> and stays normalised', () => {
    const result = simulate(createCircuit('empty', 1));
    expect(result.probabilities[0].label).toBe('|0⟩');
    expect(result.probabilities[0].probability).toBeCloseTo(1, 12);
    expect(result.bloch[0].z).toBeCloseTo(1, 12);
  });

  it('X flips |0> to |1>', () => {
    const circuit = build(1, [['X', [0]]]);
    const result = simulate(circuit);
    expect(probabilityOf(circuit, '|1⟩')).toBeCloseTo(1, 12);
    expect(result.bloch[0].z).toBeCloseTo(-1, 9);
  });

  it('H creates an equal superposition with a +X Bloch vector', () => {
    const circuit = build(1, [['H', [0]]]);
    const result = simulate(circuit);
    expect(probabilityOf(circuit, '|0⟩')).toBeCloseTo(0.5, 12);
    expect(probabilityOf(circuit, '|1⟩')).toBeCloseTo(0.5, 12);
    expect(result.bloch[0].x).toBeCloseTo(1, 9);
    expect(result.bloch[0].magnitude).toBeCloseTo(1, 9);
  });

  it('H twice returns to |0>', () => {
    const circuit = build(1, [['H', [0]], ['H', [0]]]);
    expect(probabilityOf(circuit, '|0⟩')).toBeCloseTo(1, 12);
  });

  it('T applied twice equals S', () => {
    const twoT = simulate(build(1, [['H', [0]], ['T', [0]], ['T', [0]]]));
    const oneS = simulate(build(1, [['H', [0]], ['S', [0]]]));
    expect(twoT.bloch[0].x).toBeCloseTo(oneS.bloch[0].x, 9);
    expect(twoT.bloch[0].y).toBeCloseTo(oneS.bloch[0].y, 9);
    expect(twoT.bloch[0].z).toBeCloseTo(oneS.bloch[0].z, 9);
  });

  it('S after H points to +Y and Z after H points to -X', () => {
    const plusI = simulate(build(1, [['H', [0]], ['S', [0]]]));
    expect(plusI.bloch[0].y).toBeCloseTo(1, 9);
    const minus = simulate(build(1, [['H', [0]], ['Z', [0]]]));
    expect(minus.bloch[0].x).toBeCloseTo(-1, 9);
  });

  it('Y|0> = i|1> keeps the correct phase', () => {
    const circuit = build(1, [['Y', [0]]]);
    const result = simulate(circuit);
    const one = result.probabilities.find(p => p.label === '|1⟩')!;
    expect(one.probability).toBeCloseTo(1, 12);
    expect(one.imag).toBeCloseTo(1, 12);
    expect(result.bloch[0].z).toBeCloseTo(-1, 9);
  });

  it('treats qubit 0 as the leftmost bit of the label', () => {
    const circuit = build(2, [['X', [1]]]);
    expect(probabilityOf(circuit, '|01⟩')).toBeCloseTo(1, 12);
  });

  it('produces a correlated Bell state without hard-coded numbers', () => {
    const circuit = build(2, [['H', [0]], ['CNOT', [1, 0]]]);
    const result = simulate(circuit, { shots: 2000 });
    expect(probabilityOf(circuit, '|00⟩')).toBeCloseTo(0.5, 12);
    expect(probabilityOf(circuit, '|11⟩')).toBeCloseTo(0.5, 12);
    expect(probabilityOf(circuit, '|01⟩')).toBeCloseTo(0, 12);
    expect(probabilityOf(circuit, '|10⟩')).toBeCloseTo(0, 12);
    expect(result.measurement.buckets.map(b => b.label).sort()).toEqual(['|00⟩', '|11⟩']);
    const total = result.measurement.buckets.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(2000);
    // Entanglement shrinks both individual Bloch vectors towards the centre.
    expect(result.bloch[0].magnitude).toBeLessThan(0.01);
    expect(result.bloch[1].magnitude).toBeLessThan(0.01);
  });

  it('samples shots according to the Born rule', () => {
    // H → T → H leaves a real amplitude on |1⟩: p1 = (1 - cos(π/4)) / 2 ≈ 0.1464.
    const circuit = build(1, [['H', [0]], ['T', [0]], ['H', [0]]]);
    const shots = 20000;
    const result = simulate(circuit, { shots, random: createSeededRandom(7) });
    const p1 = result.probabilities.find(p => p.label === '|1⟩')!.probability;
    expect(p1).toBeCloseTo((1 - Math.cos(Math.PI / 4)) / 2, 9);
    const bucket = result.measurement.buckets.find(b => b.label === '|1⟩')!;
    // Statistical estimate within 5% of the ideal probability.
    expect(bucket.count / shots).toBeCloseTo(p1, 1);
  });

  it('is reproducible when given a seeded PRNG', () => {
    const circuit = build(2, [['H', [0]], ['CNOT', [1, 0]], ['M', [0]], ['M', [1]]]);
    const first = simulate(circuit, { shots: 500, random: createSeededRandom(1234) });
    const second = simulate(circuit, { shots: 500, random: createSeededRandom(1234) });
    expect(second.measurement.buckets.map(b => b.count)).toEqual(
      first.measurement.buckets.map(b => b.count),
    );
    expect(first.measurement.buckets.reduce((s, b) => s + b.count, 0)).toBe(500);
  });

  it('reports invalid circuits instead of throwing', () => {
    const bad: QuantumCircuit = {
      id: 'bad',
      name: 'bad',
      numQubits: 1,
      ops: [{ id: 'op1', type: 'X', qubits: [4], column: 0 }],
    };
    const outcome = runSimulation(bad);
    expect(outcome.ok).toBe(false);
    expect(outcome.result).toBeNull();
    expect(outcome.issues[0].message).toContain('q0–q0');
    expect(() => simulate(bad)).toThrow(/Cannot simulate/);
  });

  it('warns when a circuit has no measurement gates', () => {
    const result = simulate(build(1, [['H', [0]]]));
    expect(result.warnings.some(w => w.includes('No measurement gates'))).toBe(true);
    expect(result.hasMeasurementGates).toBe(false);
  });
});
