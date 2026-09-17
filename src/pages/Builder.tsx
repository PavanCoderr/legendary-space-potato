import { useState } from 'react';
import { SAMPLE_CIRCUITS } from '../data/presets';
import { navigate } from '../router';
import { Play } from 'lucide-react';
import { useApp } from '../state/StoreProvider';
import { GATE_DEFS } from '../quantum/gates';
import { circuitDepth, lastColumn, validateCircuit } from '../quantum/circuit';
import { circuitToCode } from '../quantum/code';
import { CircuitGrid } from '../components/CircuitGrid';
import { CircuitInspector } from '../components/CircuitInspector';
import { GateHint, GatePalette } from '../components/GatePalette';
import { BlochSphere } from '../components/BlochSphere';
import { ProbabilityBars } from '../components/SimulationResults';
import { Badge, Card, Field } from '../components/ui';
import { Layout } from '../components/Layout';

export function BuilderPage() {
  const { state, actions } = useApp();
  const [projectName, setProjectName] = useState(state.circuit.name);
  const [projectDescription, setProjectDescription] = useState('');
  const [projectStatus, setProjectStatus] = useState<'draft' | 'in-progress' | 'completed'>('draft');

  const circuit = state.circuit;
  const issues = validateCircuit(circuit);
  const errors = issues.filter(issue => issue.severity === 'error');
  const result = state.simulation.result;
  const code = state.codeDirty ? circuitToCode(circuit) : state.code;

  const loadProject = (id: string) => {
    const project = actions.openProject(id);
    if (project) actions.pushToast(`Opened ${project.name}.`, 'success');
  };

  return (
    <Layout
      routeName="builder"
      title="Circuit Builder"
      subtitle="Drag gates onto wires, or switch to code mode — both edit the same circuit"
      actions={
        <>
          <Badge>{circuit.numQubits} qubit(s)</Badge>
          <Badge>{circuit.ops.length} gate(s)</Badge>
          <Badge>depth {circuitDepth(circuit)}</Badge>
          {state.simulation.stale && <Badge tone="warn">result stale</Badge>}
        </>
      }
    >
      <Card tight>
        <div className="row between">
          <div className="row tight">
            <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
              <button
                className={`tab${state.builderMode === 'visual' ? ' active' : ''}`}
                onClick={() => actions.setBuilderMode('visual')}
              >
                Visual circuit
              </button>
              <button
                className={`tab${state.builderMode === 'code' ? ' active' : ''}`}
                onClick={() => actions.setBuilderMode('code')}
              >
                Quantum code
              </button>
            </div>
          </div>
          <div className="row tight">
            <label className="row tight tiny dim">
              shots
              <select
                style={{ width: 100 }}
                value={state.settings.shots}
                onChange={event => actions.updateSettings({ shots: Number(event.target.value) })}
              >
                {[100, 512, 1000, 4096, 10000].map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-small btn-primary" onClick={() => actions.runSimulation()}>
              <Play size={13} aria-hidden /> Run
            </button>
            <button className="btn-small" onClick={() => navigate('simulator')}>
              Full results
            </button>
          </div>
        </div>
      </Card>

      <div className="builder-layout">
        <div className="stack">
          <Card
            title={
              <input
                value={circuit.name}
                onChange={event => actions.renameCircuit(event.target.value)}
                style={{ background: 'transparent', border: 'none', padding: 0, fontWeight: 640, fontSize: '1rem' }}
                aria-label="Circuit name"
              />
            }
            subtitle="The name is used when you save a project"
            actions={
              <>
                <label className="row tight tiny dim">
                  qubits
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={circuit.numQubits}
                    style={{ width: 64 }}
                    onChange={event => actions.setQubits(Number(event.target.value))}
                  />
                </label>
                <button className="btn-small" onClick={() => actions.clearCircuit()}>
                  Clear gates
                </button>
                <button className="btn-small" onClick={() => actions.resetCircuit()} title="Restore the lesson/challenge starting circuit">
                  Reset circuit
                </button>
              </>
            }
          >
            {state.builderMode === 'visual' ? (
              <>
                <CircuitGrid
                  circuit={circuit}
                  selectedOpId={state.selectedOpId}
                  selectedGate={state.selectedGate}
                  onPlace={(type, qubits, column) => actions.addGate(type, qubits, column)}
                  onMove={(opId, column, qubits) => actions.moveGate(opId, column, qubits)}
                  onSelectOp={actions.selectOp}
                  onRemoveOp={actions.removeGate}
                />
                <div style={{ marginTop: 12 }}>
                  <GatePalette selected={state.selectedGate} onSelect={actions.selectGate} />
                  <div style={{ marginTop: 8 }}>
                    <GateHint gate={state.selectedGate} />
                  </div>
                </div>
              </>
            ) : (
              <div className="stack">
                <div className="row between">
                  <span className="tiny dim">
                    Write Qiskit-style code. “Apply to circuit” parses it with the same model the drag-and-drop
                    builder uses.
                  </span>
                  <div className="row tight">
                    <button className="btn-small" onClick={() => actions.setCode(circuitToCode(circuit))}>
                      Regenerate from circuit
                    </button>
                    <button className="btn-small btn-primary" onClick={() => actions.applyCode()}>
                      Apply to circuit
                    </button>
                  </div>
                </div>
                <textarea
                  rows={14}
                  value={state.code}
                  spellCheck={false}
                  onChange={event => actions.setCode(event.target.value)}
                  aria-label="Quantum code editor"
                />
                {state.codeIssues.length > 0 && (
                  <div className="stack" style={{ gap: 4 }}>
                    {state.codeIssues.map(issue => (
                      <div key={`${issue.line}-${issue.message}`} className="tiny" style={{ color: issue.severity === 'error' ? 'var(--bad-ink)' : 'var(--warn-ink)' }}>
                        line {issue.line}: {issue.message}
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <div className="tiny dim" style={{ marginBottom: 6 }}>
                    Circuit produced by the code currently in the editor
                  </div>
                  <CircuitGrid
                    circuit={circuit}
                    interactive={false}
                    extraColumns={1}
                    showScale={false}
                  />
                </div>
              </div>
            )}

            {errors.length > 0 && (
              <div className="card tight" style={{ marginTop: 12, marginBottom: 0, borderColor: 'rgba(255,95,122,0.45)' }}>
                <strong className="small" style={{ color: 'var(--bad-ink)' }}>
                  Circuit problem{errors.length > 1 ? 's' : ''}
                </strong>
                {errors.map(issue => (
                  <div key={issue.message} className="tiny muted">
                    {issue.message}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Result preview"
            subtitle="Run the circuit to update the shared simulation state"
            actions={
              <>
                {state.simulation.stale && <Badge tone="warn">circuit changed since the last run</Badge>}
                <button className="btn-small btn-primary" onClick={() => actions.runSimulation()}>
                  <Play size={13} aria-hidden /> Run circuit
                </button>
              </>
            }
          >
            {!result ? (
              <p className="muted small" style={{ margin: 0 }}>
                No result yet. Press Run and the probabilities, counts and Bloch sphere for this exact circuit appear
                here, in the Simulator, in the lessons and for the AI tutor.
              </p>
            ) : (
              <div className="split">
                <div>
                  <ProbabilityBars result={result} limit={8} />
                </div>
                <div>
                  <BlochSphere vector={result.bloch[0]} size={260} />
                </div>
              </div>
            )}
          </Card>

          <Card title="Executed operations" subtitle={`${circuit.ops.length} gate(s) · ${lastColumn(circuit) + 1} step(s)`}>
            {circuit.ops.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>Nothing to execute yet.</p>
            ) : (
              <div className="row tight">
                {circuit.ops
                  .slice()
                  .sort((a, b) => a.column - b.column)
                  .map(op => (
                    <Badge key={op.id} title={`step ${op.column + 1}`}>
                      {GATE_DEFS[op.type].label}(q{op.qubits.join(',q')})
                    </Badge>
                  ))}
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <CircuitInspector
            circuit={circuit}
            selectedOpId={state.selectedOpId}
            onReplaceGate={(opId, next) => actions.replaceGate(opId, next)}
            onMoveGate={(opId, column, qubits) => actions.moveGate(opId, column, qubits)}
            onRemoveGate={opId => actions.removeGate(opId)}
            onSelectOp={actions.selectOp}
            onSetQubits={actions.setQubits}
          />

          <Card title="Presets" subtitle="Ready-made circuits to study or modify">
            <div className="stack" style={{ gap: 6 }}>
              {SAMPLE_CIRCUITS.map(preset => (
                <button key={preset.id} className="btn-small" onClick={() => actions.loadPreset(preset.id)}>
                  {preset.name} — {preset.description}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Saved circuits" subtitle={`${state.projects.length} project(s)`}>
            {state.projects.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>No saved projects yet.</p>
            ) : (
              <div className="stack" style={{ gap: 6 }}>
                {state.projects.map(project => (
                  <button key={project.id} className="btn-small" onClick={() => loadProject(project.id)}>
                    {project.name} · {project.circuit.ops.length} gates
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="Save as project" subtitle="Stores the circuit and its code">
            <Field label="Name">
              <input value={projectName} onChange={event => setProjectName(event.target.value)} />
            </Field>
            <Field label="Description">
              <textarea
                rows={2}
                value={projectDescription}
                onChange={event => setProjectDescription(event.target.value)}
                placeholder="What are you exploring?"
              />
            </Field>
            <Field label="Status">
              <select value={projectStatus} onChange={event => setProjectStatus(event.target.value as typeof projectStatus)}>
                <option value="draft">draft</option>
                <option value="in-progress">in progress</option>
                <option value="completed">completed</option>
              </select>
            </Field>
            <div className="row tight">
              <button
                className="btn-primary"
                onClick={() => {
                  const project = actions.saveProject({
                    name: projectName || circuit.name,
                    description: projectDescription,
                    status: projectStatus,
                  });
                  actions.pushToast(`Saved project “${project.name}”.`, 'success');
                  navigate('projects');
                }}
              >
                Save project
              </button>
              <button
                className="btn-small"
                onClick={() => {
                  setProjectName(circuit.name);
                  setProjectDescription('');
                }}
              >
                Reset form
              </button>
            </div>
          </Card>

          <Card title="Generated code" subtitle="Always mirrors the visual circuit">
            <pre className="pre">{code}</pre>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
