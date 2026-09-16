import { describe, expect, it } from 'vitest';
import {
  addOp,
  clearCircuit,
  compactColumns,
  createCircuit,
  deserializeCircuit,
  moveOp,
  orderedOps,
  removeOp,
  serializeCircuit,
  setNumQubits,
  validateCircuit,
} from './circuit';

/** Execution order (column first) with each op described compactly. */
const shape = (circuit: Parameters<typeof orderedOps>[0]) =>
  orderedOps(circuit).map(op => [op.type, op.qubits, op.column] as const);

describe('circuit model', () => {
  it('adds gates to the next free column on the requested wires', () => {
    let circuit = createCircuit('c', 2);
    circuit = addOp(circuit, 'H', [0]).circuit;
    circuit = addOp(circuit, 'H', [1]).circuit; // same column: no wire conflict
    circuit = addOp(circuit, 'X', [0]).circuit;
    expect(circuit.ops.map(op => [op.type, op.column])).toEqual([
      ['H', 0],
      ['H', 0],
      ['X', 1],
    ]);
    expect(validateCircuit(circuit)).toEqual([]);
  });

  it('rejects out-of-range qubits and duplicate wires', () => {
    const circuit = createCircuit('c', 1);
    expect(addOp(circuit, 'X', [3]).error).toContain('does not exist');
    expect(addOp(circuit, 'CNOT', [0, 0]).error).toContain('same qubit twice');
    expect(addOp(circuit, 'CNOT', [0]).error).toContain('needs 2 qubits');
  });

  it('refuses to place two gates on one wire in the same column', () => {
    const base = addOp(createCircuit('c', 2), 'H', [0]).circuit;
    const clash = addOp(base, 'X', [0], 0);
    expect(clash.error).toContain('already uses q0');
  });

  it('validates overlapping gates and reports readable messages', () => {
    const circuit = createCircuit('c', 2, [
      { id: 'a', type: 'X', qubits: [0], column: 0 },
      { id: 'b', type: 'CNOT', qubits: [1, 0], column: 0 },
    ]);
    const issues = validateCircuit(circuit);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/overlap on q0/);
  });

  it('moves, removes and compacts columns', () => {
    let circuit = createCircuit('c', 3);
    circuit = addOp(circuit, 'H', [0]).circuit;
    const x = addOp(circuit, 'X', [1]).circuit;
    circuit = addOp(x, 'Z', [2]).circuit;
    const target = circuit.ops.find(op => op.type === 'X')!;
    const moved = moveOp(circuit, target.id, 1);
    expect(moved.error).toBeUndefined();
    expect(moved.circuit.ops.find(op => op.id === target.id)!.column).toBe(1);
    const noClash = moveOp(moved.circuit, target.id, 0);
    expect(noClash.error).toBeUndefined(); // column 0 holds H on q0, no conflict with the X on q1
    const invalid = moveOp(circuit, 'missing-id', 0);
    expect(invalid.error).toContain('no longer in the circuit');
    const removed = removeOp(circuit, target.id);
    expect(removed.ops).toHaveLength(2);
    expect(compactColumns(removed).ops.every(op => op.column <= 1)).toBe(true);
  });

  it('drops gates that no longer fit when the qubit count shrinks', () => {
    let circuit = createCircuit('c', 3);
    circuit = addOp(circuit, 'X', [2]).circuit;
    const shrunk = setNumQubits(circuit, 2);
    expect(shrunk.circuit.ops).toHaveLength(0);
    expect(shrunk.error).toContain('removed because');
  });

  it('round-trips through serialization', () => {
    let circuit = createCircuit('Bell', 2);
    circuit = addOp(circuit, 'H', [0]).circuit;
    circuit = addOp(circuit, 'CNOT', [1, 0]).circuit;
    circuit = addOp(circuit, 'M', [0]).circuit;
    circuit = addOp(circuit, 'M', [1]).circuit;
    const { circuit: restored, issues } = deserializeCircuit(serializeCircuit(circuit));
    expect(issues).toEqual([]);
    expect(restored.numQubits).toBe(2);
    expect(shape(restored)).toEqual(shape(circuit));
  });

  it('degrades gracefully on malformed stored data', () => {
    const { circuit, issues } = deserializeCircuit({
      name: 'broken',
      numQubits: 99,
      ops: [
        { type: 'NOPE', qubits: [0], column: 0 },
        { type: 'X', qubits: [7], column: 1 },
        { type: 'H', qubits: [8], column: 2 },
      ],
    });
    expect(circuit.numQubits).toBe(8); // clamped from 99
    expect(circuit.ops).toHaveLength(1); // only the gate that fits is kept
    expect(circuit.ops[0].type).toBe('X');
    expect(issues.some(i => i.includes('unknown gate'))).toBe(true);
    expect(issues.some(i => i.includes('invalid qubit targets'))).toBe(true);
    expect(issues.some(i => i.includes('clamped'))).toBe(true);
  });

  it('clears every gate but keeps the register', () => {
    const circuit = clearCircuit(addOp(createCircuit('c', 2), 'H', [0]).circuit);
    expect(circuit.ops).toEqual([]);
    expect(circuit.numQubits).toBe(2);
  });
});
