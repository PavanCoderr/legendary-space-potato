import { GATE_DEFS, type GateType } from '../quantum/gates';
import type { QuantumCircuit } from '../quantum/circuit';
import { MAX_QUBITS, MIN_QUBITS, lastColumn, orderedOps } from '../quantum/circuit';
import { Badge, Card, Field } from './ui';

export interface CircuitInspectorProps {
  circuit: QuantumCircuit;
  selectedOpId: string | null;
  onReplaceGate: (opId: string, next: { type: GateType; qubits: number[]; column: number }) => void;
  onMoveGate: (opId: string, column: number, qubits?: number[]) => void;
  onRemoveGate: (opId: string) => void;
  onSelectOp: (opId: string | null) => void;
  onSetQubits: (numQubits: number) => void;
}

/** Wire/step editing for the selected gate, plus a readable operation list. */
export function CircuitInspector({
  circuit,
  selectedOpId,
  onReplaceGate,
  onMoveGate,
  onRemoveGate,
  onSelectOp,
  onSetQubits,
}: CircuitInspectorProps) {
  const op = circuit.ops.find(entry => entry.id === selectedOpId) ?? null;
  const ops = orderedOps(circuit);

  return (
    <div className="stack">
      <Card title="Selected gate" subtitle={op ? `Step ${op.column + 1}` : 'Click a gate in the circuit to edit it'}>
        {!op && <p className="muted small" style={{ margin: 0 }}>Nothing selected. Keyboard shortcuts work once a gate is selected: ← → move in time, ↑ ↓ change wire, Delete removes it.</p>}
        {op && (
          <div className="stack">
            <div className="row between">
              <Badge tone="accent">{GATE_DEFS[op.type].name}</Badge>
              <span className="mono tiny dim">{GATE_DEFS[op.type].toCode(op.qubits)}</span>
            </div>
            <Field label="Target wire">
              <select
                value={op.qubits[0]}
                onChange={event => {
                  const target = Number(event.target.value);
                  const qubits = op.qubits.length === 2 ? [target, op.qubits[1]] : [target];
                  if (qubits.length === 2 && qubits[0] === qubits[1]) return;
                  onReplaceGate(op.id, { type: op.type, qubits, column: op.column });
                }}
              >
                {Array.from({ length: circuit.numQubits }, (_, q) => (
                  <option key={q} value={q}>
                    q{q}
                  </option>
                ))}
              </select>
            </Field>
            {op.qubits.length === 2 && (
              <Field label="Control wire" hint="The control is the qubit that decides whether the target is flipped.">
                <select
                  value={op.qubits[1]}
                  onChange={event => {
                    const control = Number(event.target.value);
                    if (control === op.qubits[0]) return;
                    onReplaceGate(op.id, { type: op.type, qubits: [op.qubits[0], control], column: op.column });
                  }}
                >
                  {Array.from({ length: circuit.numQubits }, (_, q) => (
                    <option key={q} value={q}>
                      q{q}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Time step" hint="Steps run left to right. A slot can hold any gates that use different wires.">
              <input
                type="number"
                min={1}
                value={op.column + 1}
                onChange={event => onMoveGate(op.id, Math.max(0, Number(event.target.value) - 1))}
              />
            </Field>
            <div className="row tight">
              <button className="btn-small" onClick={() => onMoveGate(op.id, op.column + 1)}>
                Move later →
              </button>
              <button className="btn-small" onClick={() => onMoveGate(op.id, Math.max(0, op.column - 1))}>
                ← Move earlier
              </button>
              <button
                className="btn-small btn-bad"
                onClick={() => {
                  onRemoveGate(op.id);
                  onSelectOp(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Operation list"
        subtitle={`${circuit.ops.length} gate(s) · ${lastColumn(circuit) + 1} step(s)`}
        tight
      >
        {ops.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No operations yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Gate</th>
                <th>Wires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ops.map((entry, index) => (
                <tr
                  key={entry.id}
                  style={{ cursor: 'pointer', background: entry.id === selectedOpId ? 'rgba(124,92,255,0.12)' : undefined }}
                  onClick={() => onSelectOp(entry.id === selectedOpId ? null : entry.id)}
                >
                  <td className="mono dim">{index + 1}</td>
                  <td className="mono" style={{ color: GATE_DEFS[entry.type].color }}>
                    {GATE_DEFS[entry.type].label}
                  </td>
                  <td className="mono tiny">
                    {entry.qubits.length === 2
                      ? `q${entry.qubits[1]}⭢q${entry.qubits[0]}`
                      : `q${entry.qubits[0]}`}
                  </td>
                  <td className="right">
                    <span className="tiny dim">step {entry.column + 1}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Register" subtitle={`${MIN_QUBITS}–${MAX_QUBITS} qubits supported`} tight>
        <div className="row tight">
          <button
            className="btn-small"
            onClick={() => onSetQubits(circuit.numQubits - 1)}
            disabled={circuit.numQubits <= MIN_QUBITS}
          >
            − Remove qubit
          </button>
          <button
            className="btn-small"
            onClick={() => onSetQubits(circuit.numQubits + 1)}
            disabled={circuit.numQubits >= MAX_QUBITS}
          >
            + Add qubit
          </button>
          <Badge>{circuit.numQubits} qubit(s)</Badge>
        </div>
        <p className="tiny dim" style={{ marginTop: 8, marginBottom: 0 }}>
          Adding a qubit extends the register; reducing it removes gates that no longer fit and tells you how many
          were dropped.
        </p>
      </Card>
    </div>
  );
}
