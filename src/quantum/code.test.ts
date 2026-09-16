import { describe, expect, it } from 'vitest';
import { addOp, createCircuit } from './circuit';
import { circuitToCode, parseCode } from './code';
import { simulate } from './simulator';

describe('code mode', () => {
  it('generates runnable Qiskit-style code from a visual circuit', () => {
    let circuit = createCircuit('Bell', 2);
    circuit = addOp(circuit, 'H', [0]).circuit;
    circuit = addOp(circuit, 'CNOT', [1, 0]).circuit;
    circuit = addOp(circuit, 'M', [0]).circuit;
    circuit = addOp(circuit, 'M', [1]).circuit;
    const code = circuitToCode(circuit);
    expect(code).toContain('qc = QuantumCircuit(2)');
    expect(code).toContain('qc.h(0)');
    expect(code).toContain('qc.cx(0, 1)');
    expect(code).toContain('qc.measure_all()');
  });

  it('parses a Bell state program into the same circuit', () => {
    const { circuit, issues } = parseCode(`qc = QuantumCircuit(2)\nqc.h(0)\nqc.cx(0, 1)\nqc.measure_all()`);
    expect(issues).toEqual([]);
    expect(circuit).not.toBeNull();
    expect(circuit!.ops.map(op => [op.type, op.qubits])).toEqual([
      ['H', [0]],
      ['CNOT', [1, 0]],
      ['M', [0]],
      ['M', [1]],
    ]);
    const result = simulate(circuit!, { shots: 400 });
    expect(result.measurement.buckets.map(b => b.label).sort()).toEqual(['|00⟩', '|11⟩']);
  });

  it('round-trips circuit → code → circuit', () => {
    let circuit = createCircuit('mixed', 3);
    circuit = addOp(circuit, 'H', [0]).circuit;
    circuit = addOp(circuit, 'S', [1]).circuit;
    circuit = addOp(circuit, 'CNOT', [2, 0]).circuit;
    circuit = addOp(circuit, 'T', [2]).circuit;
    circuit = addOp(circuit, 'M', [0]).circuit;
    const reparsed = parseCode(circuitToCode(circuit));
    expect(reparsed.issues).toEqual([]);
    // T landed in column 0 (the CNOT needed q0 which was busy), so execution order is H, S, T, CNOT, M.
    expect(reparsed.circuit!.ops.map(op => [op.type, op.qubits])).toEqual([
      ['H', [0]],
      ['S', [1]],
      ['T', [2]],
      ['CNOT', [2, 0]],
      ['M', [0]],
    ]);
  });

  it('explains mistakes with line numbers', () => {
    const { issues } = parseCode(`qc = QuantumCircuit(1)\nqc.h(0)\nqc.cx(0, 1)\nqc.foo(2)`);
    expect(issues).toHaveLength(2);
    expect(issues[0].line).toBe(3);
    expect(issues[0].message).toMatch(/q1 does not exist/);
    expect(issues[1].message).toMatch(/Unsupported operation/);
  });

  it('handles missing declarations and unsupported operations', () => {
    expect(parseCode('qc.h(0)').issues[0].message).toMatch(/Create the circuit first/);
    const reset = parseCode('qc = QuantumCircuit(1)\nqc.reset(0)');
    expect(reset.issues[0].message).toMatch(/not supported/);
    const empty = parseCode('# only a comment\n');
    expect(empty.issues[0].message).toMatch(/No circuit found/);
  });
});
