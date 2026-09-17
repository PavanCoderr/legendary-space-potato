import { useMemo, useState, type DragEvent } from 'react';
import { GATE_DEFS, type GateType } from '../quantum/gates';
import type { CircuitOp, QuantumCircuit } from '../quantum/circuit';
import { lastColumn } from '../quantum/circuit';

const ROW_HEIGHT = 46;
const SLOT_WIDTH = 56;

export interface CircuitGridProps {
  circuit: QuantumCircuit;
  selectedOpId?: string | null;
  selectedGate?: GateType | null;
  /** Called when a new gate should be created. */
  onPlace?: (type: GateType, qubits: number[], column: number) => void;
  /** Called when an existing gate is dropped somewhere else. */
  onMove?: (opId: string, column: number, qubits?: number[]) => void;
  onSelectOp?: (opId: string | null) => void;
  onRemoveOp?: (opId: string) => void;
  extraColumns?: number;
  interactive?: boolean;
  showScale?: boolean;
}

/** Chooses the second wire for a two-qubit gate dropped on `qubit`. */
function partnerWire(qubit: number, numQubits: number): number | null {
  if (numQubits < 2) return null;
  if (qubit === 0) return 1;
  return qubit - 1;
}

/**
 * The visual circuit.
 *
 * Every cell is a drop target and the circuit's internal representation is what drives
 * the rendering — there is no separate "drawn" state to get out of sync. Each column is
 * one time step; the builder, simulator, tutor and lessons all read the same
 * `QuantumCircuit` object.
 */
export function CircuitGrid({
  circuit,
  selectedOpId,
  selectedGate,
  onPlace,
  onMove,
  onSelectOp,
  onRemoveOp,
  extraColumns = 2,
  interactive = true,
  showScale = true,
}: CircuitGridProps) {
  const [hoverCell, setHoverCell] = useState<{ qubit: number; column: number } | null>(null);

  const columnCount = Math.max(4, lastColumn(circuit) + 1 + extraColumns);
  const columns = useMemo(() => Array.from({ length: columnCount }, (_, index) => index), [columnCount]);

  const opAt = (qubit: number, column: number): CircuitOp | undefined =>
    circuit.ops.find(op => op.column === column && op.qubits.includes(qubit));

  const payload = (event: DragEvent): { kind: 'new'; gate: GateType } | { kind: 'move'; opId: string } | null => {
    const raw = event.dataTransfer.getData('application/qubitverse-gate');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    const legacy = event.dataTransfer.getData('text/plain');
    if (legacy === 'move') return null;
    return null;
  };

  const handleDrop = (event: DragEvent, qubit: number, column: number) => {
    event.preventDefault();
    setHoverCell(null);
    if (!interactive) return;
    const data = payload(event);
    if (!data) return;

    if (data.kind === 'new') {
      const arity = GATE_DEFS[data.gate].arity;
      if (arity === 1) {
        onPlace?.(data.gate, [qubit], column);
        return;
      }
      const partner = partnerWire(qubit, circuit.numQubits);
      if (partner === null) {
        onPlace?.(data.gate, [qubit, qubit], column); // surfaces a readable error upstream
        return;
      }
      onPlace?.(data.gate, [qubit, partner], column);
      return;
    }

    const op = circuit.ops.find(entry => entry.id === data.opId);
    if (!op) return;
    if (op.qubits.length === 1) {
      onMove?.(op.id, column, [qubit]);
      return;
    }
    const partner = partnerWire(qubit, circuit.numQubits);
    onMove?.(op.id, column, partner === null ? undefined : [qubit, partner]);
  };

  const handleCellClick = (qubit: number, column: number) => {
    if (!interactive) return;
    const existing = opAt(qubit, column);
    if (existing) {
      onSelectOp?.(existing.id === selectedOpId ? null : existing.id);
      return;
    }
    if (selectedGate) {
      handleDropLike(selectedGate, qubit, column);
    } else {
      onSelectOp?.(null);
    }
  };

  const handleDropLike = (gate: GateType, qubit: number, column: number) => {
    const arity = GATE_DEFS[gate].arity;
    if (arity === 1) {
      onPlace?.(gate, [qubit], column);
      return;
    }
    const partner = partnerWire(qubit, circuit.numQubits);
    onPlace?.(gate, partner === null ? [qubit, qubit] : [qubit, partner], column);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedOpId) return;
    const op = circuit.ops.find(entry => entry.id === selectedOpId);
    if (!op) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onRemoveOp?.(op.id);
      return;
    }
    if (event.key === 'Escape') {
      onSelectOp?.(null);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onMove?.(op.id, op.column + 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onMove?.(op.id, Math.max(0, op.column - 1));
    }
    if (event.key === 'ArrowUp' && op.qubits.length === 1 && op.qubits[0] > 0) {
      event.preventDefault();
      onMove?.(op.id, op.column, [op.qubits[0] - 1]);
    }
    if (event.key === 'ArrowDown' && op.qubits.length === 1 && op.qubits[0] < circuit.numQubits - 1) {
      event.preventDefault();
      onMove?.(op.id, op.column, [op.qubits[0] + 1]);
    }
  };

  const qubits = Array.from({ length: circuit.numQubits }, (_, index) => index);

  return (
    <div className="circuit-scroll">
      <div
        style={{ display: 'flex', outline: 'none' }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Quantum circuit grid"
      >
        <div>
          {showScale && <div style={{ height: 18 }} />}
          {qubits.map(qubit => (
            <div key={qubit} className="wire-label" style={{ height: ROW_HEIGHT }}>
              q{qubit}
            </div>
          ))}
        </div>

        {columns.map(column => {
          const opsInColumn = circuit.ops.filter(op => op.column === column);
          return (
            <div key={column} style={{ position: 'relative', width: SLOT_WIDTH }}>
              {showScale && (
                <div className="tiny dim center" style={{ height: 18 }}>
                  {column + 1}
                </div>
              )}
              {/* CNOT connector lines behind the gates */}
              {opsInColumn
                .filter(op => op.qubits.length === 2)
                .map(op => {
                  const top = Math.min(op.qubits[0], op.qubits[1]) * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const height = Math.abs(op.qubits[1] - op.qubits[0]) * ROW_HEIGHT;
                  return (
                    <span
                      key={`link-${op.id}`}
                      className="cnot-link"
                      style={{ top, height, marginTop: showScale ? 18 : 0 }}
                    />
                  );
                })}

              {qubits.map(qubit => {
                const op = opAt(qubit, column);
                const isControl = op && op.qubits.length === 2 && op.qubits[1] === qubit;
                const isHovered = hoverCell?.column === column && hoverCell?.qubit === qubit;
                return (
                  <div
                    key={qubit}
                    className={`wire slot${isHovered && interactive ? ' drop-target' : ''}`}
                    style={{ height: ROW_HEIGHT }}
                    // Interaction hooks only: a read-only preview (lesson example, code preview)
                    // must not advertise drop targets it cannot accept.
                    data-qubit={interactive ? qubit : undefined}
                    data-column={interactive ? column : undefined}
                    onDragOver={event => {
                      if (!interactive) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = op ? 'move' : 'copy';
                      setHoverCell({ qubit, column });
                    }}
                    onDragLeave={() => setHoverCell(null)}
                    onDrop={event => {
                      handleDrop(event, qubit, column);
                      onSelectOp?.(null);
                    }}
                    onClick={() => handleCellClick(qubit, column)}
                    role="button"
                    tabIndex={-1}
                    title={
                      op
                        ? `${GATE_DEFS[op.type].name} on q${op.qubits.join(', q')} — step ${column + 1}`
                        : `Empty slot on q${qubit}, step ${column + 1}`
                    }
                  >
                    {op && op.qubits.length === 1 && (
                      <span
                        className={`gate${op.id === selectedOpId ? ' selected' : ''}`}
                        style={{ background: GATE_DEFS[op.type].color }}
                        draggable={interactive}
                        onDragStart={event => {
                          event.dataTransfer.setData(
                            'application/qubitverse-gate',
                            JSON.stringify({ kind: 'move', opId: op.id }),
                          );
                          event.dataTransfer.effectAllowed = 'move';
                          onSelectOp?.(op.id);
                        }}
                      >
                        {GATE_DEFS[op.type].label}
                      </span>
                    )}
                    {op && op.qubits.length === 2 && isControl && (
                      <span
                        className={`gate control${op.id === selectedOpId ? ' selected' : ''}`}
                        style={{ background: GATE_DEFS[op.type].color }}
                        draggable={interactive}
                        onDragStart={event => {
                          event.dataTransfer.setData(
                            'application/qubitverse-gate',
                            JSON.stringify({ kind: 'move', opId: op.id }),
                          );
                          event.dataTransfer.effectAllowed = 'move';
                          onSelectOp?.(op.id);
                        }}
                        title="CNOT control"
                      />
                    )}
                    {op && op.qubits.length === 2 && !isControl && (
                      <span
                        className={`gate-target${op.id === selectedOpId ? ' selected' : ''}`}
                        draggable={interactive}
                        onDragStart={event => {
                          event.dataTransfer.setData(
                            'application/qubitverse-gate',
                            JSON.stringify({ kind: 'move', opId: op.id }),
                          );
                          event.dataTransfer.effectAllowed = 'move';
                          onSelectOp?.(op.id);
                        }}
                        title="CNOT target"
                      >
                        <span className="mono tiny">X</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {circuit.ops.length === 0 && (
        <p className="tiny dim" style={{ marginTop: 8 }}>
          The circuit is empty. Drag a gate from the palette onto a slot, or pick a gate and click a slot.
        </p>
      )}
    </div>
  );
}
