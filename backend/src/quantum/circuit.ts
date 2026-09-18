import { GATE_DEFS, isGateType, type GateType } from './gates';

export type { GateType };

/**
 * The single source of truth for what a circuit *is*.
 *
 * A circuit is a list of operations placed on a grid: `column` is the time step and
 * `qubits` are the wires the gate touches (`qubits[0]` is the target, `qubits[1]` is
 * the control for CNOT). Storing the grid instead of a rendered picture keeps the
 * builder, simulator, code mode and tutor in agreement.
 */
export interface CircuitOp {
  id: string;
  type: GateType;
  /**
   * The wires this gate touches, in operation order: for a two-qubit gate `qubits[0]` is
   * the target and `qubits[1]` is the control, so CNOT(control q0 → target q1) is
   * `[1, 0]` — not the `[control, target]` order used in most textbooks (see data/presets.ts).
   */
  qubits: number[];
  column: number;
}

export interface QuantumCircuit {
  id: string;
  name: string;
  numQubits: number;
  ops: CircuitOp[];
}

export interface CircuitIssue {
  severity: 'error' | 'warning';
  message: string;
  opId?: string;
  column?: number;
  qubit?: number;
}

export const MIN_QUBITS = 1;
export const MAX_QUBITS = 8;

let idCounter = 0;

/** Deterministic-enough unique id for ops/circuits; avoids a uuid dependency. */
export function newId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function createCircuit(
  name = 'Untitled circuit',
  numQubits = 2,
  ops: CircuitOp[] = [],
): QuantumCircuit {
  return { id: newId('circuit'), name, numQubits: clampQubits(numQubits), ops };
}

export function clampQubits(n: number): number {
  if (!Number.isFinite(n)) return MIN_QUBITS;
  return Math.min(MAX_QUBITS, Math.max(MIN_QUBITS, Math.round(n)));
}

export function cloneCircuit(circuit: QuantumCircuit): QuantumCircuit {
  return {
    ...circuit,
    id: newId('circuit'),
    ops: circuit.ops.map(op => ({ ...op, id: newId('op'), qubits: [...op.qubits] })),
  };
}

export function gateArity(type: GateType): number {
  return GATE_DEFS[type].arity;
}

/** Highest occupied column index, or -1 for an empty circuit. */
export function lastColumn(circuit: QuantumCircuit): number {
  return circuit.ops.reduce((max, op) => Math.max(max, op.column), -1);
}

export function opsInColumn(circuit: QuantumCircuit, column: number): CircuitOp[] {
  return circuit.ops.filter(op => op.column === column);
}

/** Ordered execution list: left to right, stable within a column. */
export function orderedOps(circuit: QuantumCircuit): CircuitOp[] {
  return [...circuit.ops].sort((a, b) => a.column - b.column);
}

export function wireConflicts(a: number[], b: number[]): boolean {
  return a.some(q => b.includes(q));
}

/** Smallest column >= `from` where the given wires are free. */
export function nextFreeColumn(
  circuit: QuantumCircuit,
  qubits: number[],
  from = 0,
): number {
  let column = from;
  for (;;) {
    const occupied = opsInColumn(circuit, column);
    if (!occupied.some(op => wireConflicts(op.qubits, qubits))) return column;
    column += 1;
  }
}

export function findOp(circuit: QuantumCircuit, opId: string): CircuitOp | undefined {
  return circuit.ops.find(op => op.id === opId);
}

/** Removes empty columns so the grid stays dense after deletions and moves. */
export function compactColumns(circuit: QuantumCircuit): QuantumCircuit {
  const columns = [...new Set(circuit.ops.map(op => op.column))].sort((a, b) => a - b);
  const remap = new Map<number, number>();
  columns.forEach((c, index) => remap.set(c, index));
  return {
    ...circuit,
    ops: circuit.ops.map(op => ({ ...op, column: remap.get(op.column) ?? op.column })),
  };
}

export interface AddOpResult {
  circuit: QuantumCircuit;
  op?: CircuitOp;
  error?: string;
}

/**
 * Adds a gate to the circuit. If `column` is given and free the gate goes exactly
 * there, otherwise it slides to the next free column so a circuit can never hold two
 * gates on the same wire at the same time.
 */
export function addOp(
  circuit: QuantumCircuit,
  type: GateType,
  qubits: number[],
  column?: number,
): AddOpResult {
  const arity = gateArity(type);
  if (qubits.length !== arity) {
    return {
      circuit,
      error: `${GATE_DEFS[type].name} needs ${arity} qubit${arity > 1 ? 's' : ''}, got ${qubits.length}.`,
    };
  }
  if (new Set(qubits).size !== qubits.length) {
    return { circuit, error: 'A gate cannot use the same qubit twice.' };
  }
  const outOfRange = qubits.find(q => q < 0 || q >= circuit.numQubits);
  if (outOfRange !== undefined) {
    return {
      circuit,
      error: `Qubit q${outOfRange} does not exist — the circuit only has q0–q${circuit.numQubits - 1}.`,
    };
  }

  const target = column === undefined ? nextFreeColumn(circuit, qubits) : column;
  if (column !== undefined) {
    const occupied = opsInColumn(circuit, column);
    const clash = occupied.find(op => wireConflicts(op.qubits, qubits));
    if (clash) {
      return {
        circuit,
        error: `Column ${column + 1} already uses q${clash.qubits.join(
          ' and q',
        )}; choose another slot or delete the existing gate first.`,
      };
    }
  }

  const op: CircuitOp = { id: newId('op'), type, qubits: [...qubits], column: target };
  return { circuit: { ...circuit, ops: [...circuit.ops, op] }, op };
}

export function removeOp(circuit: QuantumCircuit, opId: string): QuantumCircuit {
  return { ...circuit, ops: circuit.ops.filter(op => op.id !== opId) };
}

/** Moves an op to a new column/wires, reporting a friendly error on collision. */
export function moveOp(
  circuit: QuantumCircuit,
  opId: string,
  column: number,
  qubits?: number[],
): AddOpResult {
  const op = findOp(circuit, opId);
  if (!op) return { circuit, error: 'That gate is no longer in the circuit.' };
  const wires = qubits ?? op.qubits;
  if (wires.some(q => q < 0 || q >= circuit.numQubits)) {
    return { circuit, error: 'That target wire is outside the circuit.' };
  }
  const clash = circuit.ops.find(
    other => other.id !== opId && other.column === column && wireConflicts(other.qubits, wires),
  );
  if (clash) {
    return {
      circuit,
      error: `Column ${column + 1} is already occupied on q${clash.qubits.join(
        ' and q',
      )}. Gate not moved.`,
    };
  }
  return {
    circuit: compactColumns({
      ...circuit,
      ops: circuit.ops.map(o => (o.id === opId ? { ...o, column, qubits: [...wires] } : o)),
    }),
    op: { ...op, column, qubits: [...wires] },
  };
}

export function clearCircuit(circuit: QuantumCircuit): QuantumCircuit {
  return { ...circuit, ops: [] };
}

/** Keeps gates that still fit and drops those on removed wires, reporting what happened. */
export function setNumQubits(circuit: QuantumCircuit, numQubits: number): AddOpResult {
  const n = clampQubits(numQubits);
  const kept: CircuitOp[] = [];
  let dropped = 0;
  for (const op of circuit.ops) {
    if (op.qubits.every(q => q < n)) kept.push(op);
    else dropped += 1;
  }
  const next = compactColumns({ ...circuit, numQubits: n, ops: kept });
  return {
    circuit: next,
    error: dropped
      ? `${dropped} gate${dropped > 1 ? 's' : ''} removed because they acted on qubits that no longer exist.`
      : undefined,
  };
}

export function validateCircuit(circuit: QuantumCircuit): CircuitIssue[] {
  const issues: CircuitIssue[] = [];
  if (circuit.numQubits < MIN_QUBITS || circuit.numQubits > MAX_QUBITS) {
    issues.push({
      severity: 'error',
      message: `A circuit must have between ${MIN_QUBITS} and ${MAX_QUBITS} qubits (found ${circuit.numQubits}).`,
    });
  }
  const seenIds = new Set<string>();
  circuit.ops.forEach(op => {
    const def = GATE_DEFS[op.type];
    if (!def) {
      issues.push({
        severity: 'error',
        message: `Unsupported gate "${op.type}".`,
        opId: op.id,
        column: op.column,
      });
      return;
    }
    if (seenIds.has(op.id)) {
      issues.push({ severity: 'warning', message: `Duplicate gate id ${op.id}.`, opId: op.id });
    }
    seenIds.add(op.id);
    if (!Number.isInteger(op.column) || op.column < 0) {
      issues.push({
        severity: 'error',
        message: `Gate ${def.label} sits at an invalid column.`,
        opId: op.id,
      });
    }
    if (op.qubits.length !== def.arity) {
      issues.push({
        severity: 'error',
        message: `${def.name} expects ${def.arity} qubit(s) but is connected to ${op.qubits.length}.`,
        opId: op.id,
        column: op.column,
      });
      return;
    }
    if (new Set(op.qubits).size !== op.qubits.length) {
      issues.push({
        severity: 'error',
        message: `${def.name} is connected to the same qubit twice.`,
        opId: op.id,
        column: op.column,
      });
    }
    op.qubits.forEach(q => {
      if (!Number.isInteger(q) || q < 0 || q >= circuit.numQubits) {
        issues.push({
          severity: 'error',
          message: `${def.name} acts on q${q}, but the circuit only defines q0–q${circuit.numQubits - 1}.`,
          opId: op.id,
          column: op.column,
          qubit: q,
        });
      }
    });
  });

  const byColumn = new Map<number, CircuitOp[]>();
  circuit.ops.forEach(op => {
    const list = byColumn.get(op.column) ?? [];
    list.push(op);
    byColumn.set(op.column, list);
  });
  byColumn.forEach((ops, column) => {
    for (let i = 0; i < ops.length; i++) {
      for (let j = i + 1; j < ops.length; j++) {
        if (wireConflicts(ops[i].qubits, ops[j].qubits)) {
          issues.push({
            severity: 'error',
            message: `${GATE_DEFS[ops[i].type].label} and ${GATE_DEFS[ops[j].type].label} overlap on q${ops[
              i
            ].qubits.filter(q => ops[j].qubits.includes(q)).join(' and q')} in the same time step.`,
            column,
            opId: ops[i].id,
          });
        }
      }
    }
  });

  return issues;
}

export function circuitHasGate(circuit: QuantumCircuit, type: GateType): boolean {
  return circuit.ops.some(op => op.type === type);
}

export function countGate(circuit: QuantumCircuit, type: GateType): number {
  return circuit.ops.filter(op => op.type === type).length;
}

export function circuitDepth(circuit: QuantumCircuit): number {
  return circuit.ops.length === 0 ? 0 : lastColumn(circuit) + 1;
}

/** Safe JSON shape used by persistence, projects, and the (future) REST API. */
export interface SerializedCircuit {
  id?: string;
  name: string;
  numQubits: number;
  ops: { type: string; qubits: number[]; column: number }[];
}

export function serializeCircuit(circuit: QuantumCircuit): SerializedCircuit {
  return {
    id: circuit.id,
    name: circuit.name,
    numQubits: circuit.numQubits,
    ops: orderedOps(circuit).map(op => ({
      type: op.type,
      qubits: [...op.qubits],
      column: op.column,
    })),
  };
}

/**
 * Rebuilds a circuit from stored/imported data, returning readable issues instead of
 * throwing when the payload is malformed.
 */
export function deserializeCircuit(
  data: unknown,
  fallbackName = 'Imported circuit',
): { circuit: QuantumCircuit; issues: string[] } {
  const issues: string[] = [];
  const raw = (data ?? {}) as Partial<SerializedCircuit>;
  const numQubits = clampQubits(Number(raw.numQubits ?? 1));
  if (raw.numQubits !== numQubits) {
    issues.push(`Qubit count ${String(raw.numQubits)} was clamped to ${numQubits}.`);
  }
  const ops: CircuitOp[] = [];
  const rawOps = Array.isArray(raw.ops) ? raw.ops : [];
  rawOps.forEach((entry, index) => {
    const type = String((entry as { type?: unknown })?.type ?? '').toUpperCase();
    const qubits = Array.isArray((entry as { qubits?: unknown }).qubits)
      ? ((entry as { qubits: unknown[] }).qubits.map(Number) as number[])
      : [];
    const column = Number((entry as { column?: unknown }).column ?? index);
    if (!isGateType(type)) {
      issues.push(`Skipped unknown gate "${type}" at position ${index + 1}.`);
      return;
    }
    const def = GATE_DEFS[type];
    if (qubits.length !== def.arity || qubits.some(q => !Number.isInteger(q) || q < 0 || q >= numQubits)) {
      issues.push(`Skipped ${def.label} at position ${index + 1}: it has invalid qubit targets.`);
      return;
    }
    ops.push({ id: newId('op'), type, qubits, column: Number.isInteger(column) && column >= 0 ? column : index });
  });
  return {
    circuit: compactColumns({
      id: newId('circuit'),
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : fallbackName,
      numQubits,
      ops,
    }),
    issues,
  };
}
