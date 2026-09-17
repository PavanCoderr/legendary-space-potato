import { describe, expect, it } from 'vitest';
import { formatMatrixEntry, gateReference } from './gateReference';
import { cx } from '../quantum/complex';
import { GATE_DEFS } from '../quantum/gates';

describe('formatMatrixEntry', () => {
  it('renders the constants a learner reads as symbols', () => {
    expect(formatMatrixEntry(cx(0))).toBe('0');
    expect(formatMatrixEntry(cx(1))).toBe('1');
    expect(formatMatrixEntry(cx(-1))).toBe('−1');
    expect(formatMatrixEntry(cx(Math.SQRT1_2))).toBe('1/√2');
    expect(formatMatrixEntry(cx(-Math.SQRT1_2))).toBe('−1/√2');
    expect(formatMatrixEntry(cx(0, 1))).toBe('i');
    expect(formatMatrixEntry(cx(0, -1))).toBe('−i');
  });

  it('uses a real minus sign rather than a hyphen', () => {
    // A hyphen next to a monospace digit is the kind of detail that makes maths look wrong.
    expect(formatMatrixEntry(cx(-0.5))).not.toContain('-');
    expect(formatMatrixEntry(cx(-0.25, -0.25))).not.toContain('-');
  });

  it('recognises a unit-modulus phase', () => {
    const phase = Math.SQRT1_2;
    expect(formatMatrixEntry(cx(phase, phase))).toBe('e^(iπ/4)');
    expect(formatMatrixEntry(cx(phase, -phase))).toBe('e^(−iπ/4)');
  });

  it('falls back to decimals for values it cannot name', () => {
    expect(formatMatrixEntry(cx(0.3, 0.4))).toBe('0.3+0.4i');
  });
});

describe('gateReference', () => {
  it('lists every gate the builder offers, in one place', () => {
    const entries = gateReference();
    expect(entries.map(entry => entry.type).sort()).toEqual(Object.keys(GATE_DEFS).sort());
  });

  it('shows the matrix the simulator actually applies', () => {
    const hadamard = gateReference().find(entry => entry.type === 'H')!;
    expect(hadamard.matrix).toEqual([
      ['1/√2', '1/√2'],
      ['1/√2', '−1/√2'],
    ]);
    const pauliY = gateReference().find(entry => entry.type === 'Y')!;
    expect(pauliY.matrix).toEqual([
      ['0', '−i'],
      ['i', '0'],
    ]);
  });

  it('explains the two operations that are not plain 2x2 unitaries', () => {
    const entries = gateReference();
    expect(entries.find(entry => entry.type === 'CNOT')!.matrix).toBeNull();
    expect(entries.find(entry => entry.type === 'CNOT')!.note).toMatch(/Controlled-X/);
    expect(entries.find(entry => entry.type === 'M')!.matrix).toBeNull();
    expect(entries.find(entry => entry.type === 'M')!.note).toMatch(/Born/);
  });
});
