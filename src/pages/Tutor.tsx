import { GATE_DEFS, GATE_ORDER } from '../quantum/gates';
import { getLesson } from '../data/lessons';
import { getChallenge } from '../data/challenges';
import { navigate, route } from '../router';
import { useApp } from '../state/StoreProvider';
import { describeCircuit, describeState } from '../services/analysis';
import { TutorPanel } from '../components/TutorPanel';
import { Badge, Card, KeyValue } from '../components/ui';
import { Layout } from '../components/Layout';

export function TutorPage() {
  const { state } = useApp();
  const lesson = getLesson(state.currentLessonId);
  const challenge = getChallenge(state.challengeId);
  const result = state.simulation.result;

  return (
    <Layout
      routeName="tutor"
      title="AI Quantum Tutor"
      subtitle="A tutor that reads your lesson, circuit, selected gate, quantum state, result and challenge"
      actions={
        <>
          <Badge tone={state.settings.aiProvider.mode === 'local' ? 'default' : 'accent'}>
            {state.settings.aiProvider.mode === 'local' ? 'built-in (no key needed)' : state.settings.aiProvider.model}
          </Badge>
          <Badge>{state.tutorMessages.length} message(s)</Badge>
        </>
      }
    >
      <div className="grid sidebar-right">
        <TutorPanel route="tutor" height={620} />

        <div className="stack">
          <Card title="What the tutor can see" subtitle="Context is rebuilt for every question">
            <KeyValue label="Lesson" value={lesson ? lesson.title : 'none open'} />
            <KeyValue label="Circuit" value={`${state.circuit.numQubits} qubit(s), ${state.circuit.ops.length} gate(s)`} />
            <KeyValue label="Selected gate" value={state.selectedGate ? GATE_DEFS[state.selectedGate].name : 'none'} />
            <KeyValue
              label="Quantum state"
              value={result ? describeState(result) : 'not simulated yet'}
            />
            <KeyValue
              label="Result"
              value={result ? `${result.shots} shots · ${result.measurement.buckets.length} outcome(s)` : 'none'}
            />
            <KeyValue label="Challenge" value={challenge ? challenge.title : 'none'} />
            <KeyValue label="XP / streak" value={`${state.user.xp} XP · ${state.activity.activeDays.length} active day(s)`} />
            {result && <div className="tiny dim" style={{ marginTop: 8 }}>{describeCircuit(state.circuit)}</div>}
          </Card>

          <Card title="Actions" subtitle="Every action is computed from the context above">
            <ul className="list-plain small">
              <li>
                <strong>Explain this</strong> — teaches the concept, gate or state you are looking at.
              </li>
              <li>
                <strong>Why did this happen?</strong> — connects the last gate to the measured probabilities.
              </li>
              <li>
                <strong>Find my mistake</strong> — checks circuit validity, code issues, stale results and failing
                challenge checks.
              </li>
              <li>
                <strong>Give me a hint</strong> — reveals the next hint of the active challenge.
              </li>
              <li>
                <strong>Explain my circuit</strong> — replays the circuit gate by gate with real state changes.
              </li>
              <li>
                <strong>Explain the result</strong> — compares ideal probabilities with the sampled counts.
              </li>
              <li>
                <strong>Improve my code</strong> — finds exact gate identities (HH → nothing, HZH → X, SS → Z …).
              </li>
            </ul>
          </Card>

          <Card title="Gate reference" subtitle="What the tutor falls back on when you ask about a gate">
            <div className="stack" style={{ gap: 6 }}>
              {GATE_ORDER.map(type => (
                <div key={type} className="row tight">
                  <span className="mono" style={{ color: GATE_DEFS[type].color, width: 44 }}>
                    {GATE_DEFS[type].label}
                  </span>
                  <span className="tiny muted">{GATE_DEFS[type].blochEffect}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Jump back in" subtitle="The tutor is available on the pages where you need it">
            <div className="row tight">
              {lesson && (
                <button className="btn-small" onClick={() => navigate(route('lesson', lesson.id))}>
                  Back to lesson
                </button>
              )}
              <button className="btn-small" onClick={() => navigate('builder')}>
                Circuit Builder
              </button>
              <button className="btn-small" onClick={() => navigate('simulator')}>
                Simulator
              </button>
              <button className="btn-small" onClick={() => navigate('settings')}>
                Configure a model
              </button>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
