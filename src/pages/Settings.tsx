import { useRef, useState } from 'react';
import { API_MODE_LABEL } from '../services/api';
import { navigate } from '../router';
import { useApp } from '../state/StoreProvider';
import { snapshotFromState } from '../state/persistence';
import type { PersistedSnapshot } from '../state/types';
import { Badge, Card, Field } from '../components/ui';
import { Layout } from '../components/Layout';
import { ThemeSetting } from '../components/ThemeToggle';

export function SettingsPage() {
  const { state, actions } = useApp();
  const [name, setName] = useState(state.user.name);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const provider = state.settings.aiProvider;

  const exportState = () => {
    const snapshot = snapshotFromState(state);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `qubitverse-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    actions.pushToast('Exported your QubitVerse state as JSON.', 'success');
  };

  const importState = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<PersistedSnapshot>;
        if (!parsed || typeof parsed !== 'object') throw new Error('Not a QubitVerse export.');
        actions.importState(parsed);
        setImportError(null);
        actions.pushToast('Imported saved state.', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setImportError(message);
        actions.pushToast(`Import failed: ${message}`, 'error');
      }
    };
    reader.onerror = () => setImportError('The file could not be read.');
    reader.readAsText(file);
  };

  return (
    <Layout
      routeName="settings"
      title="Settings"
      subtitle="Simulator defaults, AI provider, profile and local data"
      actions={<Badge>{API_MODE_LABEL}</Badge>}
    >
      <div className="grid cols-2">
        <Card title="Profile" subtitle="Shown on the dashboard">
          <Field label="Display name">
            <input value={name} onChange={event => setName(event.target.value)} />
          </Field>
          <div className="row tight">
            <button
              className="btn-primary"
              onClick={() => {
                actions.setName(name);
                actions.pushToast('Name updated.', 'success');
              }}
            >
              Save name
            </button>
            <span className="tiny dim">
              Account created {new Date(state.user.createdAt).toLocaleDateString()} · {state.user.xp} XP earned
            </span>
          </div>
        </Card>

        <Card title="Appearance" subtitle="Light, dark, or follow your operating system">
          <Field label="Colour theme">
            <ThemeSetting />
          </Field>
          <p className="tiny dim" style={{ margin: 0 }}>
            The choice is saved with your other settings and applied before the app paints, so the
            background never flashes the wrong colour on reload.
          </p>
        </Card>

        <Card title="Simulator" subtitle="Defaults used by every Run button">
          <Field label="Default shots">
            <select
              value={state.settings.shots}
              onChange={event => actions.updateSettings({ shots: Number(event.target.value) })}
            >
              {[100, 512, 1000, 4096, 10000].map(value => (
                <option key={value} value={value}>
                  {value} shots
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sampling">
            <select
              value={state.settings.useFixedSeed ? 'fixed' : 'random'}
              onChange={event => actions.updateSettings({ useFixedSeed: event.target.value === 'fixed' })}
            >
              <option value="random">Random every run (true measurement randomness)</option>
              <option value="fixed">Fixed seed (reproducible counts)</option>
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
          <Field label="Auto-run when the circuit changes">
            <select
              value={state.settings.autoRunOnChange ? 'on' : 'off'}
              onChange={event => actions.updateSettings({ autoRunOnChange: event.target.value === 'on' })}
            >
              <option value="off">Off — run manually</option>
              <option value="on">On — keep the results fresh</option>
            </select>
          </Field>
        </Card>

        <Card
          title="AI tutor provider"
          subtitle="The built-in tutor needs no key; connect any OpenAI-compatible endpoint to use your own model"
        >
          <Field label="Mode">
            <select
              value={provider.mode}
              onChange={event => actions.updateAiSettings({ mode: event.target.value as typeof provider.mode })}
            >
              <option value="local">Built-in tutor (rule based, offline)</option>
              <option value="openai-compatible">OpenAI-compatible API</option>
            </select>
          </Field>
          <Field label="Base URL" hint="For example https://api.openai.com/v1 or http://localhost:11434/v1">
            <input
              value={provider.baseUrl}
              disabled={provider.mode === 'local'}
              onChange={event => actions.updateAiSettings({ baseUrl: event.target.value })}
            />
          </Field>
          <Field label="Model">
            <input
              value={provider.model}
              disabled={provider.mode === 'local'}
              onChange={event => actions.updateAiSettings({ model: event.target.value })}
            />
          </Field>
          <Field label="API key" hint="Stored only in this browser (localStorage). Never sent anywhere except your provider.">
            <input
              type="password"
              value={provider.apiKey}
              disabled={provider.mode === 'local'}
              onChange={event => actions.updateAiSettings({ apiKey: event.target.value })}
            />
          </Field>
          <Field label={`Temperature: ${provider.temperature.toFixed(1)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={provider.temperature}
              onChange={event => actions.updateAiSettings({ temperature: Number(event.target.value) })}
            />
          </Field>
          <div className="row tight">
            <button
              className="btn-small btn-primary"
              onClick={() => {
                void actions.askTutor(
                  'Give me one sentence about the state of my current circuit.',
                  'explain-result',
                  'settings',
                );
                navigate('tutor');
              }}
            >
              Send a test question
            </button>
            <span className="tiny dim">
              {provider.mode === 'local'
                ? 'Answers are computed from your circuit and result by the built-in engine.'
                : 'If the request fails, QubitVerse falls back to the built-in answer.'}
            </span>
          </div>
        </Card>

        <Card title="Data" subtitle={API_MODE_LABEL}>
          <p className="small muted">
            Progress, projects, settings and the tutor history are persisted in this browser. Everything is
            versioned and validated on load; malformed data is skipped with a readable warning instead of crashing.
          </p>
          <div className="row tight">
            <button className="btn-small" onClick={exportState}>
              Export state (JSON)
            </button>
            <button className="btn-small" onClick={() => fileRef.current?.click()}>
              Import state
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) importState(file);
                event.target.value = '';
              }}
            />
            <button
              className="btn-small btn-bad"
              onClick={() => {
                if (window.confirm('Reset progress, projects, settings and tutor history to the initial state?')) {
                  actions.resetEverything();
                }
              }}
            >
              Reset everything
            </button>
          </div>
          {importError && <p className="tiny" style={{ color: 'var(--bad-ink)' }}>{importError}</p>}
          <div className="stack" style={{ gap: 4, marginTop: 10 }}>
            <div className="tiny dim">
              Stored: {Object.keys(state.progress).length} lesson records · {state.quizAttempts.length} quiz attempts ·{' '}
              {state.challengeAttempts.length} challenge attempts · {state.projects.length} projects ·{' '}
              {state.tutorMessages.length} tutor messages
            </div>
            <div className="tiny dim">
              Simulation activity: {state.activity.simulations} runs · {state.activity.totalShots.toLocaleString()} shots
            </div>
          </div>
        </Card>

        <Card title="Architecture notes" subtitle="How QubitVerse is put together">
          <ul className="list-plain small">
            <li>
              <strong>Simulation</strong> — a state-vector engine in <code>src/quantum</code> (unitary gates, Born-rule
              sampling, reduced density matrices for the Bloch spheres). No hard-coded results anywhere.
            </li>
            <li>
              <strong>One circuit</strong> — the builder, simulator, lessons, practice and tutor all read the same
              circuit from a single store, so they can never disagree.
            </li>
            <li>
              <strong>Services</strong> — <code>services/api.ts</code> is the backend boundary; setting
              <code> VITE_API_BASE_URL</code> switches state, simulation and tutor calls to HTTP.
            </li>
            <li>
              <strong>AI</strong> — <code>services/tutor.ts</code> holds the offline engine, <code>services/llm.ts</code>
              wraps any OpenAI-compatible model behind the same interface.
            </li>
          </ul>
        </Card>
      </div>
    </Layout>
  );
}
