import { GATE_DEFS, GATE_ORDER, type GateType } from '../quantum/gates';

/** Palette used by the builder and by the lesson labs. */
export function GatePalette({
  selected,
  onSelect,
  gates = GATE_ORDER,
  disabled = false,
}: {
  selected: GateType | null;
  onSelect: (gate: GateType | null) => void;
  gates?: GateType[];
  disabled?: boolean;
}) {
  return (
    <div className="palette">
      {gates.map(type => {
        const def = GATE_DEFS[type];
        return (
          <button
            key={type}
            type="button"
            className={`palette-item${selected === type ? ' active' : ''}`}
            disabled={disabled}
            draggable={!disabled}
            title={`${def.name} — ${def.description}`}
            onClick={() => onSelect(selected === type ? null : type)}
            onDragStart={event => {
              event.dataTransfer.setData(
                'application/qubitverse-gate',
                JSON.stringify({ kind: 'new', gate: type }),
              );
              event.dataTransfer.effectAllowed = 'copy';
              onSelect(type);
            }}
          >
            <span className="palette-glyph" style={{ color: def.color }}>
              {def.label}
            </span>
            <span className="palette-label">{def.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Legend explaining the currently selected gate. */
export function GateHint({ gate }: { gate: GateType | null }) {
  if (!gate) {
    return (
      <p className="tiny dim" style={{ margin: 0 }}>
        Select a gate, then click a wire slot to place it — or drag the gate onto the circuit. Placing a CNOT
        puts the target on the wire you drop it on and the control on the neighbouring wire; use the inspector to
        choose the wires exactly.
      </p>
    );
  }
  const def = GATE_DEFS[gate];
  return (
    <div className="tiny">
      <strong style={{ color: def.color }}>{def.name}</strong>{' '}
      <span className="muted">{def.description}</span>
      <div className="dim" style={{ marginTop: 3 }}>
        {def.blochEffect}
      </div>
    </div>
  );
}
