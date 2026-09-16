import { useState } from 'react';
import type { SimulationResult } from '../quantum/simulator';
import { GATE_DEFS } from '../quantum/gates';
import { formatComplex } from '../quantum/complex';
import type { QuantumCircuit } from '../quantum/circuit';
import { circuitDepth } from '../quantum/circuit';
import { evolveStepByStep, gateHistogram, measurementSummary, simulationWarnings } from '../services/analysis';
import { Badge, Card, EmptyState } from './ui';
import { BlochSphere } from './BlochSphere';

/** Ideal probabilities with the measured counts overlaid as a marker. */
export function ProbabilityBars({ result, limit = 12 }: { result: SimulationResult; limit?: number }) {
  const measured = new Map(result.measurement.buckets.map(bucket => [bucket.label, bucket]));
  const entries = result.probabilities
    .filter(entry => entry.probability > 1e-9)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit);

  if (entries.length === 0) {
    return <p className="muted small">No basis states have non-zero amplitude.</p>;
  }

  return (
    <div className="bars">
      {entries.map(entry => {
        const bucket = measured.get(entry.label);
        return (
          <div className="bar-row" key={entry.label}>
            <span className="mono">{entry.label}</span>
            <span className="bar-track" title={`ideal ${(entry.probability * 100).toFixed(2)}%`}>
              <span className="bar-fill" style={{ width: `${Math.max(1, entry.probability * 100)}%` }} />
              {bucket && <span className="bar-ideal" style={{ left: `${bucket.measuredProbability * 100}%` }} />}
            </span>
            <span className="mono tiny right">
              {(entry.probability * 100).toFixed(1)}%
              {bucket && <span className="dim"> · {bucket.count}</span>}
            </span>
          </div>
        );
      })}
      <p className="tiny dim" style={{ margin: 0 }}>
        Filled bar = ideal |amplitude|² · orange marker = measured share of {result.shots} shots · grey number =
        raw count.
      </p>
    </div>
  );
}

export function MeasurementTable({ result }: { result: SimulationResult }) {
  const rows = measurementSummary(result);
  return (
    <table>
      <thead>
        <tr>
          <th>Outcome</th>
          <th>Count</th>
          <th>Measured</th>
          <th>Ideal</th>
          <th>Expected count</th>
          <th>Δ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.label}>
            <td className="mono">{row.label}</td>
            <td className="mono">{row.count}</td>
            <td className="mono">{row.percent.toFixed(1)}%</td>
            <td className="mono dim">{(row.expected / result.shots * 100).toFixed(1)}%</td>
            <td className="mono dim">{row.expected.toFixed(1)}</td>
            <td className="mono" style={{ color: Math.abs(row.deviation) > 3 * Math.sqrt(result.shots) ? 'var(--warn-ink)' : undefined }}>
              {row.deviation >= 0 ? '+' : ''}
              {row.deviation.toFixed(0)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StateVectorTable({ result, limit = 16 }: { result: SimulationResult; limit?: number }) {
  const rows = result.amplitudes.filter(entry => Math.abs(entry.real) > 1e-9 || Math.abs(entry.imag) > 1e-9).slice(0, limit);
  if (rows.length === 0) return <p className="muted small">The state vector is empty.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Basis</th>
          <th>Amplitude</th>
          <th>Probability</th>
          <th>Phase</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(entry => (
          <tr key={entry.label}>
            <td className="mono">{entry.label}</td>
            <td className="mono">{formatComplex({ re: entry.real, im: entry.imag })}</td>
            <td className="mono">{(entry.probability * 100).toFixed(2)}%</td>
            <td>
              <span className="row tight">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    display: 'inline-block',
                    background: `hsl(${((entry.phase + Math.PI) / (Math.PI * 2)) * 360}, 80%, 60%)`,
                  }}
                  title={`phase ${(entry.phase * 180 / Math.PI).toFixed(0)}° · hue encodes the complex phase`}
                />
                <span className="mono tiny dim">{((entry.phase * 180) / Math.PI).toFixed(0)}°</span>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One Bloch sphere per qubit with the reduced-state details. */
export function BlochPanel({ result }: { result: SimulationResult }) {
  const [selected, setSelected] = useState(0);
  const vector = result.bloch[Math.min(selected, result.bloch.length - 1)];
  if (!vector) return null;
  return (
    <div>
      <div className="row tight" style={{ marginBottom: 8 }}>
        {result.bloch.map((entry, index) => (
          <button
            key={index}
            className={`btn-small${selected === index ? ' btn-primary' : ''}`}
            onClick={() => setSelected(index)}
            title={`Show q${index}`}
          >
            q{index}
            <span className="tiny dim"> |r|={entry.magnitude.toFixed(2)}</span>
          </button>
        ))}
      </div>
      <BlochSphere
        vector={vector}
        caption={`q${selected} · θ=${((vector.theta * 180) / Math.PI).toFixed(0)}° φ=${((vector.phi * 180) / Math.PI).toFixed(0)}° |r|=${vector.magnitude.toFixed(3)}`}
      />
      <div className="split" style={{ marginTop: 10 }}>
        <div>
          <div className="tiny dim">Bloch vector (q{selected})</div>
          <div className="mono small">
            x={vector.x.toFixed(3)} y={vector.y.toFixed(3)} z={vector.z.toFixed(3)}
          </div>
        </div>
        <div>
          <div className="tiny dim">Purity Tr(ρ²)</div>
          <div className="mono small">{vector.purity.toFixed(3)}</div>
        </div>
      </div>
      {vector.isMixed && (
        <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
          The vector is shorter than the sphere radius, so q{selected} is not in a pure state of its own — it is
          entangled with (or has been measured alongside) the other qubits.
        </p>
      )}
    </div>
  );
}

export function PerQubitTable({ result }: { result: SimulationResult }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Qubit</th>
          <th>P(0)</th>
          <th>P(1)</th>
          <th>Zeros</th>
          <th>Ones</th>
        </tr>
      </thead>
      <tbody>
        {result.measurement.qubitOutcomes.map(outcome => (
          <tr key={outcome.qubit}>
            <td className="mono">q{outcome.qubit}</td>
            <td className="mono">{(outcome.p0 * 100).toFixed(2)}%</td>
            <td className="mono">{(outcome.p1 * 100).toFixed(2)}%</td>
            <td className="mono dim">{outcome.zeros}</td>
            <td className="mono dim">{outcome.ones}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function WarningList({ result }: { result: SimulationResult }) {
  const warnings = simulationWarnings(result);
  if (warnings.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {warnings.map(warning => (
        <div key={warning} className="row tight">
          <Badge tone="warn">note</Badge>
          <span className="small muted">{warning}</span>
        </div>
      ))}
    </div>
  );
}

export function ResultSummary({ result }: { result: SimulationResult }) {
  const states = result.probabilities.filter(entry => entry.probability > 1e-9);
  return (
    <div className="grid cols-4" style={{ gap: 10 }}>
      <div className="card tight">
        <div className="tiny dim">Shots</div>
        <div className="stat-value">{result.shots}</div>
      </div>
      <div className="card tight">
        <div className="tiny dim">Non-zero outcomes</div>
        <div className="stat-value">{states.length}</div>
      </div>
      <div className="card tight">
        <div className="tiny dim">Gates (excl. M)</div>
        <div className="stat-value">{result.unitaryCount}</div>
      </div>
      <div className="card tight">
        <div className="tiny dim">Depth</div>
        <div className="stat-value">{result.operations.reduce((max, op) => Math.max(max, op.column + 1), 0)}</div>
      </div>
    </div>
  );
}

/** Gate-by-gate history computed with the same evolution code as a real run. */
export function StepTimeline({ circuit }: { circuit: QuantumCircuit }) {
  const steps = evolveStepByStep(circuit);
  if (steps.length === 0) return <p className="muted small">Add gates to see the state evolve step by step.</p>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {steps.map(step => (
        <div key={`${step.op.id}-${step.index}`} className="card tight" style={{ marginBottom: 0 }}>
          <div className="row between">
            <div className="row tight">
              <Badge tone="accent">{step.index + 1}</Badge>
              <span
                className="mono"
                style={{ color: GATE_DEFS[step.op.type].color, fontWeight: 700 }}
              >
                {step.label}
              </span>
              <span className="mono small muted">q{step.op.qubits.join(', q')}</span>
            </div>
            <span className="mono tiny dim">{step.code}</span>
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            {step.states
              .slice(0, 4)
              .map(entry => `${entry.label} ${(entry.probability * 100).toFixed(1)}%`)
              .join(' · ')}
          </div>
          <div className="tiny dim">
            {step.qubits.map(entry => `q${entry.qubit}: P(1)=${(entry.p1 * 100).toFixed(1)}%`).join(' · ')}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GateHistogram({ circuit }: { circuit: QuantumCircuit }) {
  const histogram = gateHistogram(circuit);
  if (histogram.length === 0) return <p className="muted small">No gates yet.</p>;
  return (
    <div className="row tight">
      {histogram.map(entry => (
        <Badge key={entry.type} title={GATE_DEFS[entry.type as keyof typeof GATE_DEFS]?.name}>
          {entry.type} × {entry.count}
        </Badge>
      ))}
      <Badge>depth {circuitDepth(circuit)}</Badge>
    </div>
  );
}

/** Full results block reused by the Simulator page and the lesson runner. */
export function SimulationReport({ result }: { result: SimulationResult }) {
  if (result.operations.length === 0) {
    return (
      <EmptyState
        title="Nothing to show"
        body="The circuit was empty, so the register stayed in |0…0⟩. Add gates and run again."
      />
    );
  }
  return (
    <div className="stack">
      <ResultSummary result={result} />
      <div className="split">
        <Card title="Probabilities" subtitle="Ideal state-vector probabilities with measured counts">
          <ProbabilityBars result={result} />
        </Card>
        <Card title="Measurement results" subtitle={`Sampled from the final state · ${result.shots} shots`}>
          <MeasurementTable result={result} />
        </Card>
      </div>
      <div className="split">
        <Card title="Quantum state" subtitle="Amplitudes of the final state vector">
          <StateVectorTable result={result} />
          <WarningList result={result} />
        </Card>
        <Card title="Bloch sphere" subtitle="Reduced state of each qubit">
          <BlochPanel result={result} />
        </Card>
      </div>
      <Card title="Per-qubit marginals" subtitle="What each wire reads on its own">
        <PerQubitTable result={result} />
      </Card>
    </div>
  );
}
