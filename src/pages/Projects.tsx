import { useState } from 'react';
import { deserializeCircuit } from '../quantum/circuit';
import { circuitToCode } from '../quantum/code';
import { navigate } from '../router';
import { useApp } from '../state/StoreProvider';
import { CircuitGrid } from '../components/CircuitGrid';
import { Badge, Card, EmptyState, Field, Stat } from '../components/ui';
import { Layout } from '../components/Layout';

export function ProjectsPage() {
  const { state, actions } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<'draft' | 'in-progress' | 'completed'>('draft');
  const [filter, setFilter] = useState<'all' | 'draft' | 'in-progress' | 'completed'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(state.projects[0]?.id ?? null);

  const projects = state.projects
    .filter(project => filter === 'all' || project.status === filter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const selected = state.projects.find(project => project.id === selectedId) ?? projects[0] ?? null;
  const selectedCircuit = selected ? deserializeCircuit(selected.circuit, selected.name).circuit : null;

  return (
    <Layout
      routeName="projects"
      title="Projects"
      subtitle="Saved circuits with their code, status and history"
      actions={
        <>
          <Badge>{state.projects.length} project(s)</Badge>
          <Badge tone="accent">
            {state.projects.filter(project => project.status === 'completed').length} completed
          </Badge>
        </>
      }
    >
      <div className="grid cols-4" style={{ gap: 12 }}>
        <Stat label="Projects" value={state.projects.length} hint="Bell state, Grover and more ship with the app" />
        <Stat label="Drafts" value={state.projects.filter(project => project.status === 'draft').length} />
        <Stat label="In progress" value={state.projects.filter(project => project.status === 'in-progress').length} />
        <Stat label="Completed" value={state.projects.filter(project => project.status === 'completed').length} />
      </div>

      <div className="grid sidebar-right">
        <div className="stack">
          <Card
            title="Create a project from the current circuit"
            subtitle={`${state.circuit.numQubits} qubit(s), ${state.circuit.ops.length} gate(s) — saved with its generated code`}
          >
            <div className="grid cols-2" style={{ gap: 12 }}>
              <Field label="Name">
                <input
                  value={name}
                  placeholder={state.circuit.name}
                  onChange={event => setName(event.target.value)}
                />
              </Field>
              <Field label="Status">
                <select value={status} onChange={event => setStatus(event.target.value as typeof status)}>
                  <option value="draft">draft</option>
                  <option value="in-progress">in progress</option>
                  <option value="completed">completed</option>
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea
                rows={2}
                value={description}
                placeholder="What is this circuit for?"
                onChange={event => setDescription(event.target.value)}
              />
            </Field>
            <Field label="Tags" hint="Comma separated, e.g. entanglement, bell, reference">
              <input value={tags} onChange={event => setTags(event.target.value)} />
            </Field>
            <div className="row tight">
              <button
                className="btn-primary"
                onClick={() => {
                  const project = actions.saveProject({
                    name: name || state.circuit.name,
                    description,
                    tags: tags
                      .split(',')
                      .map(tag => tag.trim())
                      .filter(Boolean),
                    status,
                  });
                  setSelectedId(project.id);
                  setName('');
                  setDescription('');
                  setTags('');
                  actions.pushToast(`Saved “${project.name}”.`, 'success');
                }}
              >
                Save project
              </button>
              <button className="btn-small btn-ghost" onClick={() => navigate('builder')}>
                Back to builder
              </button>
            </div>
          </Card>

          <Card
            title="Your projects"
            subtitle="Open loads the circuit into the shared builder state"
            actions={
              <select style={{ width: 160 }} value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
                <option value="all">All statuses</option>
                <option value="draft">Drafts</option>
                <option value="in-progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            }
          >
            {projects.length === 0 ? (
              <EmptyState title="No projects here" body="Change the filter or save the current circuit as a project." />
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {projects.map(project => (
                  <div
                    key={project.id}
                    className="card tight"
                    style={{
                      marginBottom: 0,
                      borderColor: project.id === selected?.id ? 'rgba(124,92,255,0.55)' : undefined,
                    }}
                  >
                    <div className="row between">
                      <div>
                        <div className="row tight">
                          <strong className="small">{project.name}</strong>
                          <Badge tone={project.status === 'completed' ? 'good' : project.status === 'in-progress' ? 'warn' : 'default'}>
                            {project.status}
                          </Badge>
                          {project.tags.map(tag => (
                            <Badge key={tag}>#{tag}</Badge>
                          ))}
                        </div>
                        <div className="tiny muted">{project.description || 'No description'}</div>
                        <div className="tiny dim">
                          {project.circuit.numQubits} qubit(s) · {project.circuit.ops.length} gates · created{' '}
                          {new Date(project.createdAt).toLocaleDateString()} · modified{' '}
                          {new Date(project.updatedAt).toLocaleDateString()}
                          {project.lessonId ? ` · from lesson ${project.lessonId}` : ''}
                        </div>
                      </div>
                      <div className="row tight">
                        <button className="btn-small" onClick={() => setSelectedId(project.id)}>
                          Preview
                        </button>
                        <button
                          className="btn-small btn-primary"
                          onClick={() => {
                            actions.openProject(project.id);
                            navigate('builder');
                          }}
                        >
                          Open
                        </button>
                        <button
                          className="btn-small"
                          onClick={() => {
                            const next = window.prompt('Rename project', project.name);
                            if (next) actions.updateProject(project.id, { name: next });
                          }}
                        >
                          Rename
                        </button>
                        <button className="btn-small" onClick={() => actions.duplicateProject(project.id)}>
                          Duplicate
                        </button>
                        <button
                          className="btn-small btn-bad"
                          onClick={() => {
                            if (window.confirm(`Delete “${project.name}”? This cannot be undone.`)) {
                              actions.deleteProject(project.id);
                              if (selectedId === project.id) setSelectedId(null);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="row tight" style={{ marginTop: 8 }}>
                      <label className="row tight tiny dim">
                        status
                        <select
                          style={{ width: 140 }}
                          value={project.status}
                          onChange={event =>
                            actions.updateProject(project.id, {
                              status: event.target.value as 'draft' | 'in-progress' | 'completed',
                            })
                          }
                        >
                          <option value="draft">draft</option>
                          <option value="in-progress">in progress</option>
                          <option value="completed">completed</option>
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          {selected && selectedCircuit ? (
            <>
              <Card title={selected.name} subtitle={selected.description || 'No description'}>
                <CircuitGrid circuit={selectedCircuit} interactive={false} extraColumns={1} />
                <div className="row tight" style={{ marginTop: 10 }}>
                  <button
                    className="btn-small btn-primary"
                    onClick={() => {
                      actions.openProject(selected.id);
                      navigate('builder');
                    }}
                  >
                    Open in builder
                  </button>
                  <button
                    className="btn-small"
                    onClick={() => {
                      actions.openProject(selected.id);
                      actions.runSimulation();
                      navigate('simulator');
                    }}
                  >
                    Open and run
                  </button>
                </div>
              </Card>
              <Card title="Saved code" subtitle="Kept in sync with the stored circuit">
                <pre className="pre">{selected.code || circuitToCode(selectedCircuit)}</pre>
              </Card>
            </>
          ) : (
            <Card title="Preview" subtitle="Select a project to inspect it">
              <p className="muted small" style={{ margin: 0 }}>
                The Bell State, Superposition Experiment, Quantum Teleportation and Grover Search projects ship with
                QubitVerse so you always have working circuits to study.
              </p>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
