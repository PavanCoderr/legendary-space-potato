import {
  QuantumCircuit,
  SerializedCircuit,
  addOp,
  circuitDepth,
  createCircuit,
  orderedOps,
} from './circuit';
import { GATE_DEFS, GateType, isGateType } from './gates';

/**
 * Qiskit-style "quantum code" mode.
 *
 * `circuitToCode` is always available and mirrors the visual circuit exactly.
 * `parseCode` accepts the beginner subset of the Qiskit API that QubitVerse can
 * simulate, and reports readable issues for everything else rather than throwing.
 */
export interface CodeIssue {
  line: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface ParseCodeResult {
  circuit: QuantumCircuit | null;
  issues: CodeIssue[];
}

const HEADER = [
  '# QubitVerse code mode — Qiskit-compatible subset',
  '# Supported: QuantumCircuit(n), h, x, y, z, s, t, cx/cnot, measure, measure_all',
];

export function circuitToCode(circuit: QuantumCircuit): string {
  const lines: string[] = [...HEADER, '', `qc = QuantumCircuit(${circuit.numQubits})`];
  const ops = orderedOps(circuit);
  const measured = new Set(ops.filter(op => op.type === 'M').map(op => op.qubits[0]));
  const unitaryOps = ops.filter(op => op.type !== 'M');

  let previousColumn = -1;
  for (const op of unitaryOps) {
    if (previousColumn !== -1 && op.column !== previousColumn) lines.push('');
    if (op.column !== previousColumn && op.column > previousColumn + 1 && previousColumn !== -1) {
      lines.push(`# step ${op.column + 1}`);
    }
    lines.push(GATE_DEFS[op.type].toCode(op.qubits));
    previousColumn = op.column;
  }

  if (measured.size > 0) {
    if (unitaryOps.length > 0) lines.push('');
    if (measured.size === circuit.numQubits) {
      lines.push('qc.measure_all()');
    } else {
      [...measured]
        .sort((a, b) => a - b)
        .forEach(q => lines.push(`qc.measure(${q}, ${q})`));
    }
  }

  if (unitaryOps.length === 0 && measured.size === 0) {
    lines.push('', `# depth ${circuitDepth(circuit)} — add gates from the palette or type them here`);
  }
  return lines.join('\n');
}

const GATE_ALIASES: Record<string, GateType> = {
  h: 'H',
  x: 'X',
  y: 'Y',
  z: 'Z',
  s: 'S',
  t: 'T',
  cx: 'CNOT',
  cnot: 'CNOT',
};

function parseArgs(raw: string): { numbers: number[]; malformed: string | null } {
  const trimmed = raw.trim();
  if (trimmed === '') return { numbers: [], malformed: null };
  const numbers: number[] = [];
  for (const piece of trimmed.split(',')) {
    const value = piece.trim();
    if (value === '') continue;
    if (/^-?\d+$/.test(value)) {
      numbers.push(Number(value));
      continue;
    }
    if (/^\[.*\]$/.test(value)) {
      const inner = value.slice(1, -1).trim();
      if (inner === '') continue;
      for (const item of inner.split(',')) {
        const n = item.trim();
        if (/^-?\d+$/.test(n)) numbers.push(Number(n));
        else return { numbers, malformed: item.trim() };
      }
      continue;
    }
    // Keyword arguments such as qc.h(q=0) are accepted in spirit but not parsed.
    const kw = /^[a-zA-Z_]\w*\s*=\s*(-?\d+)$/.exec(value);
    if (kw) {
      numbers.push(Number(kw[1]));
      continue;
    }
    return { numbers, malformed: value };
  }
  return { numbers, malformed: null };
}

export function parseCode(source: string): ParseCodeResult {
  const issues: CodeIssue[] = [];
  let circuit: QuantumCircuit | null = null;
  let declaredQubits = 0;

  const rawLines = source.split(/\r?\n/);
  rawLines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.replace(/#.*$/, '').trim().replace(/;$/, '').trim();
    if (!line) return;

    // Circuit construction: `qc = QuantumCircuit(2)`
    const construction = /^(\w+)\s*=\s*QuantumCircuit\s*\(([^)]*)\)$/.exec(line);
    if (construction) {
      const { numbers, malformed } = parseArgs(construction[2]);
      if (malformed !== null || numbers.length === 0) {
        issues.push({
          line: lineNumber,
          severity: 'error',
          message: 'QuantumCircuit needs a qubit count, e.g. QuantumCircuit(2).',
        });
        return;
      }
      declaredQubits = numbers[0];
      if (numbers.length > 1) {
        issues.push({
          line: lineNumber,
          severity: 'warning',
          message: 'Classical bits are ignored; QubitVerse records measurement outcomes automatically.',
        });
      }
      circuit = createCircuit('Code circuit', declaredQubits);
      return;
    }

    if (!/^\w+\s*\./.test(line)) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: `Could not read "${line}". Use statements like qc.h(0), qc.cx(0, 1) or qc.measure_all().`,
      });
      return;
    }

    const callMatch = /^(\w+)\s*\.\s*(\w+)\s*\((.*)\)$/.exec(line);
    if (!callMatch) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: `Missing parentheses in "${line}".`,
      });
      return;
    }
    const [, register, methodRaw, argsRaw] = callMatch;
    const method = methodRaw.toLowerCase();

    if (!circuit) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: `Create the circuit first: ${register} = QuantumCircuit(n) before calling ${method}().`,
      });
      return;
    }

    if (method === 'measure_all') {
      for (let q = 0; q < declaredQubits; q++) {
        const outcome = addOp(circuit, 'M', [q]);
        if (outcome.error) {
          issues.push({ line: lineNumber, severity: 'error', message: outcome.error });
          return;
        }
        circuit = outcome.circuit;
      }
      return;
    }

    if (method === 'barrier' || method === 'reset' || method === 'initialize') {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: `${method}() is not supported by QubitVerse's lightweight simulator yet.`,
      });
      return;
    }

    if (method === 'measure') {
      const { numbers, malformed } = parseArgs(argsRaw);
      if (malformed !== null || numbers.length === 0) {
        issues.push({
          line: lineNumber,
          severity: 'error',
          message: 'measure() needs at least one qubit, e.g. qc.measure(0, 0).',
        });
        return;
      }
      const qubits = numbers.length > 1 && numbers.length % 2 === 0 ? numbers.slice(0, numbers.length / 2) : numbers;
      for (const qubit of qubits) {
        if (qubit < 0 || qubit >= circuit.numQubits) {
          issues.push({
            line: lineNumber,
            severity: 'error',
            message: `q${qubit} does not exist; the circuit declares ${circuit.numQubits} qubit(s).`,
          });
          continue;
        }
        const outcome = addOp(circuit, 'M', [qubit]);
        if (outcome.error) {
          issues.push({ line: lineNumber, severity: 'error', message: outcome.error });
          continue;
        }
        circuit = outcome.circuit;
      }
      return;
    }

    const type = GATE_ALIASES[method];
    if (!type) {
      const hint = isGateType(method.toUpperCase())
        ? ` did you mean ${GATE_DEFS[method.toUpperCase() as GateType].toCode([0]).replace('0', '0')}?`
        : '';
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: `Unsupported operation ${register}.${method}().${hint}`,
      });
      return;
    }

    const { numbers, malformed } = parseArgs(argsRaw);
    if (malformed !== null) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: `${method}() expects qubit indices, found "${malformed}".`,
      });
      return;
    }
    const def = GATE_DEFS[type];
    if (numbers.length !== def.arity) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: `${method}() needs ${def.arity} qubit${def.arity > 1 ? 's' : ''}, got ${numbers.length}.`,
      });
      return;
    }
    if (new Set(numbers).size !== numbers.length) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: `${method}() cannot use the same qubit twice.`,
      });
      return;
    }
    const outOfRange = numbers.find(q => q < 0 || q >= circuit!.numQubits);
    if (outOfRange !== undefined) {
      issues.push({
        line: lineNumber,
        severity: 'error',
        message: `q${outOfRange} does not exist; the circuit declares ${circuit.numQubits} qubit(s).`,
      });
      return;
    }
    // CNOT is written cx(control, target) in Qiskit; the model stores [target, control].
    const qubits = type === 'CNOT' ? [numbers[1], numbers[0]] : numbers;
    const outcome = addOp(circuit, type, qubits);
    if (outcome.error) {
      issues.push({ line: lineNumber, severity: 'error', message: outcome.error });
      return;
    }
    circuit = outcome.circuit;
  });

  if (!circuit && issues.length === 0) {
    issues.push({
      line: 1,
      severity: 'error',
      message: 'No circuit found. Start with qc = QuantumCircuit(2).',
    });
  }

  return { circuit, issues };
}

export function codeIssuesToMessages(issues: CodeIssue[]): string[] {
  return issues.map(issue => `Line ${issue.line}: ${issue.message}`);
}

/** Serialized form of a code-defined circuit (used when saving a project in code mode). */
export function codeToSerialized(source: string): SerializedCircuit | null {
  const { circuit } = parseCode(source);
  if (!circuit) return null;
  return {
    name: circuit.name,
    numQubits: circuit.numQubits,
    ops: orderedOps(circuit).map(op => ({ type: op.type, qubits: op.qubits, column: op.column })),
  };
}
