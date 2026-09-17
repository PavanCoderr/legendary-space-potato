import { useEffect } from 'react';
import { Play, Sparkles } from 'lucide-react';
import { circuitToCode } from '../quantum/code';
import { validateCircuit } from '../quantum/circuit';
import { navigate } from '../router';
import { useApp } from '../state/StoreProvider';
import { describeState, formatInitialState, formatStateVector } from '../services/analysis';
import { SimulationReport, StepTimeline } from '../components/SimulationResults';
import { CircuitGrid } from '../components/CircuitGrid';
import { BlochSphere } from '../components/BlochSphere';
import { Badge, Card, Field } from '../components/ui';
import { Layout } from '../components/Layout';

export function SimulatorPage() {
  const { state, actions } = useApp();
  const circuit = state.circuit;
  const result = state.simulation.result;
  const issues = validateCircuit(circuit).filter(issue => issue.severity === 'error');
  const stale = state.simulation.stale;

  // Optional auto-run: reruns whenever the circuit changes after a previous run.
  useEffect(() => {
    if (!state.settings.autoRunOnChange || !stale || issues.length > 0) return;
    const handle = window.setTimeout(() => actions.runSimulation(), 400);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, state.settings.autoRunOnChange, issues.length]);

  return (
    <Layout
      routeName="simulator"
      title="Simulator"
      subtitle="Lightweight state-vector simulation with real measurement sampling"
      actions={
        <>
          <Badge>{circuit.numQubits} qubit(s)</Badge>
          <Badge>{circuit.ops.length} gate(s)</Badge>
          {stale && <Badge tone="warn">result stale</Badge>}
          {result && <Badge tone="good">{result.shots} shots</Badge>}
        </>
      }
    >
      <div className="stack">
        <Card
          title="Run controls"
          subtitle="Everything here feeds the same shared simulation state used by the lessons, builder and tutor"
          actions={
            <>
              <button className="btn-small btn-primary" onClick={() => actions.runSimulation()}>
                <Play size={13} aria-hidden /> Run circuit
              </button>
              <button className="btn-small" onClick={() => actions.clearSimulation()} disabled={!result}>
                Clear result
              </button>
              <button className="btn-small btn-ghost" onClick={() => navigate('builder')}>
                Edit in Builder
              </button>
            </>
          }
        >
          <div className="grid cols-4" style={{ gap: 10 }}>
            <Field label="Shots">
              <select
                value={state.settings.shots}
                onChange={event => actions.updateSettings({ shots: Number(event.target.value) })}
              >
                {[100, 512, 1000, 4096, 10000].map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reproducible sampling" hint="Fixes the PRNG seed so counts repeat exactly">
              <select
                value={state.settings.useFixedSeed ? 'fixed' : 'random'}
                onChange={event => actions.updateSettings({ useFixedSeed: event.target.value === 'fixed' })}
              >
                <option value="random">random seed (true randomness)</option>
                <option value="fixed">fixed seed</option>
              </select>
            </Field>
            <Field label="Seed">
              <input
                type="number"
                value={state.settings.seed}
                disabled={!state.settings.useFixedSeed}
                onChange={event => actions.updateSettings({ seed: Number(event.target.value) })}
              />
            </Field>
            <Field label="Auto-run on change">
              <select
                value={state.settings.autoRunOnChange ? 'on' : 'off'}
                onChange={event => actions.updateSettings({ autoRunOnChange: event.target.value === 'on' })}
              >
                <option value="off">off (run manually)</option>
                <option value="on">on</option>
              </select>
            </Field>
          </div>

          {issues.length > 0 && (
            <div className="card tight" style={{ marginTop: 12, marginBottom: 0, borderColor: 'rgba(255,95,122,0.45)' }}>
              <strong className="small" style={{ color: 'var(--bad-ink)' }}>
                Cannot simulate this circuit yet
              </strong>
              {issues.map(issue => (
                <div key={issue.message} className="tiny muted">
                  {issue.message}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Circuit" subtitle="The circuit being simulated (read-only here)">
          <CircuitGrid circuit={circuit} interactive={false} extraColumns={1} />
          <div className="grid cols-2" style={{ marginTop: 12 }}>
            <div>
              <div className="tiny dim" style={{ marginBottom: 4 }}>
                Code
              </div>
              <pre className="pre">{circuitToCode(circuit)}</pre>
            </div>
            <div>
              <div className="tiny dim" style={{ marginBottom: 4 }}>
                Bloch vectors after the run
              </div>
              {result ? (
                <div className="split">
                  {result.bloch.slice(0, 2).map((vector, index) => (
                    <BlochSphere key={index} vector={vector} size={220} caption={`q${index}`} />
                  ))}
                </div>
              ) : (
                <p className="muted small">Run the circuit to see the state vectors.</p>
              )}
            </div>
          </div>
        </Card>

        <Card title="State" subtitle="The register before and after the run, in Dirac notation">
          <div className="grid cols-2">
            <div>
              <div className="tiny dim" style={{ marginBottom: 4 }}>
                Initial state
              </div>
              <code className="katex-ish">{formatInitialState(circuit.numQubits)}</code>
              <div className="tiny dim" style={{ marginTop: 4 }}>
                Every qubit starts in |0⟩ — that is the substrate the circuit acts on.
              </div>
            </div>
            <div>
              <div className="tiny dim" style={{ marginBottom: 4 }}>
                Final state
              </div>
              <code className="katex-ish">{result ? formatStateVector(result) : '—'}</code>
              <div className="tiny dim" style={{ marginTop: 4 }}>
                {result
                  ? describeState(result)
                  : `Run the circuit to evolve ${formatInitialState(circuit.numQubits)} into its final state.`}
              </div>
            </div>
          </div>
        </Card>

        {result ? (
          <SimulationReport result={result} />
        ) : (
          <Card title="Results" subtitle="Nothing simulated yet">
            <p className="muted small" style={{ margin: 0 }}>
              Press <strong>Run circuit</strong> to evolve the state vector and sample {state.settings.shots} shots
              from the Born rule. The numbers are computed live — nothing is hard-coded.
            </p>
          </Card>
        )}

        <Card title="Step-by-step evolution" subtitle="Replays each gate on the state vector without sampling">
          <StepTimeline circuit={circuit} />
        </Card>

        <Card
          title="Next steps"
          subtitle="The result is available to every other area of the app"
          actions={
            <>
              <button className="btn-small" onClick={() => navigate('tutor')}>
                <Sparkles size={13} aria-hidden /> Ask the tutor about this result
              </button>
              <button
                className="btn-small"
                onClick={() => {
                  actions.saveProject({
                    name: `${circuit.name} run`,
                    description: `Saved from the simulator after ${result?.shots ?? state.settings.shots} shots.`,
                  });
                  navigate('projects');
                }}
              >
                Save circuit as a project
              </button>
            </>
          }
        >
          <ul className="list-plain tiny">
            <li>Measurement gates execute at the end of the circuit, matching Qiskit’s measure_all().</li>
            <li>Counts vary between runs because sampling is genuinely random — the ideal probabilities do not.</li>
            <li>Use a fixed seed when you want two runs to line up exactly (useful for screenshots or debugging).</li>
          </ul>
        </Card>
      </div>
    </Layout>
  );
}
