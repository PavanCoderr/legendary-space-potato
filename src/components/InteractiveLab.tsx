import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Play } from 'lucide-react';
import { GATE_DEFS, type GateType } from '../quantum/gates';
import type { Lesson } from '../data/types';
import { useApp } from '../state/StoreProvider';
import { describeState } from '../services/analysis';
import { BlochSphere } from './BlochSphere';
import { CircuitGrid } from './CircuitGrid';
import { GateHint, GatePalette } from './GatePalette';
import { ProbabilityBars } from './SimulationResults';
import { Badge, Card } from './ui';

/**
 * The interactive part of a lesson.
 *
 * It drives the *shared* circuit, so whatever the learner builds here is exactly what the
 * Circuit Builder, Simulator and tutor will show afterwards. Completion is decided from
 * observable behaviour (gates used / measured correlation), never from a timer.
 */
export function InteractiveLab({
  lesson,
  onComplete,
  completed,
}: {
  lesson: Lesson;
  onComplete: () => void;
  completed: boolean;
}) {
  const { state, actions } = useApp();
  const [usedGates, setUsedGates] = useState<GateType[]>([]);
  const notifiedRef = useRef(false);

  const availableGates = lesson.interactive.availableGates.filter((gate): gate is GateType =>
    Object.prototype.hasOwnProperty.call(GATE_DEFS, gate),
  );

  const result = state.simulation.result;

  const correlationSatisfied = useMemo(() => {
    if (!result) return false;
    const outcomes = result.measurement.buckets.filter(bucket => bucket.count > 0).map(bucket => bucket.label).sort();
    if (outcomes.length !== 2) return false;
    const [a, b] = outcomes;
    return (a === '|00⟩' && b === '|11⟩') || (a === '|01⟩' && b === '|10⟩');
  }, [result]);

  const satisfied = useMemo(() => {
    switch (lesson.interactive.completionCheck) {
      case 'always':
        return result !== null;
      case 'entangled':
        return Boolean(result && result.bloch.some(vector => vector.isMixed));
      case 'measured-correlation':
        return correlationSatisfied;
      case 'touched-all-gates':
      default:
        return availableGates.every(gate => usedGates.includes(gate));
    }
  }, [availableGates, correlationSatisfied, lesson.interactive.completionCheck, result, usedGates]);

  useEffect(() => {
    if (satisfied && !notifiedRef.current) {
      notifiedRef.current = true;
      onComplete();
    }
    if (!satisfied) notifiedRef.current = false;
  }, [satisfied, onComplete]);

  const place = (type: GateType, qubits: number[], column: number) => {
    actions.addGate(type, qubits, column);
    setUsedGates(prev => (prev.includes(type) ? prev : [...prev, type]));
  };

  return (
    <Card
      title={lesson.interactive.title}
      subtitle={lesson.interactive.instructions}
      actions={
        <>
          <Badge tone={completed ? 'good' : 'default'}>{completed ? 'lab done' : 'lab open'}</Badge>
          <button className="btn-small" onClick={() => actions.clearCircuit()}>
            Clear
          </button>
          <button className="btn-small btn-primary" onClick={() => actions.runSimulation()}>
            <Play size={13} aria-hidden /> Run
          </button>
        </>
      }
    >
      <div className="grid sidebar-right" style={{ gap: 14 }}>
        <div>
          <CircuitGrid
            circuit={state.circuit}
            selectedOpId={state.selectedOpId}
            selectedGate={state.selectedGate}
            onPlace={place}
            onMove={(opId, column, qubits) => actions.moveGate(opId, column, qubits)}
            onSelectOp={actions.selectOp}
            onRemoveOp={actions.removeGate}
            extraColumns={1}
            showScale={false}
          />
          <div style={{ marginTop: 10 }}>
            <GatePalette
              selected={state.selectedGate}
              onSelect={actions.selectGate}
              gates={availableGates}
              disabled={false}
            />
            <div style={{ marginTop: 8 }}>
              <GateHint gate={state.selectedGate} />
            </div>
          </div>
          <div className="row tight" style={{ marginTop: 10 }}>
            <span className="tiny dim">Gates tried:</span>
            {availableGates.map(gate => (
              <Badge key={gate} tone={usedGates.includes(gate) ? 'good' : 'default'}>
                {gate}
              </Badge>
            ))}
          </div>
        </div>

        <div className="stack">
          <div>
            <div className="row between">
              <span className="tiny dim">Current state</span>
              {state.simulation.stale && <Badge tone="warn">circuit changed — run again</Badge>}
            </div>
            <div className="mono small">{result ? describeState(result) : 'not run yet'}</div>
          </div>
          {result && <ProbabilityBars result={result} limit={6} />}
          {result && <BlochSphere vector={result.bloch[0]} size={260} />}
          {satisfied && (
            <p className="row tight small" style={{ color: 'var(--good-ink)', margin: 0 }}>
              <CheckCircle2 size={14} aria-hidden />
              <span>{lesson.interactive.successNote}</span>
            </p>
          )}
          {!satisfied && (
            <p className="tiny dim" style={{ margin: 0 }}>
              Complete the objective above to mark this step done.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
