import { useEffect, useState } from 'react';
import { Check, Play, ShieldCheck, X } from 'lucide-react';
import type { Challenge } from '../data/types';
import { navigate } from '../router';
import { useApp } from '../state/StoreProvider';
import { CircuitGrid } from './CircuitGrid';
import { GatePalette } from './GatePalette';
import { Badge, Card, ProgressBar } from './ui';

/**
 * Runs a practice challenge against the shared circuit.
 *
 * "Submit" re-simulates with the challenge's shot count and evaluates the validator
 * functions in data/challenges.ts, so the pass/fail checks describe the learner's actual
 * quantum state — nothing is hard-coded.
 */
export function ChallengePanel({ challenge }: { challenge: Challenge }) {
  const { state, actions } = useApp();
  const [revealedHints, setRevealedHints] = useState(0);
  const isActive = state.challengeId === challenge.id;
  const checks = isActive ? state.challengeChecks : null;
  const attempts = state.challengeAttempts.filter(attempt => attempt.challengeId === challenge.id);
  const passed = attempts.some(attempt => attempt.passed);
  const result = isActive ? state.simulation.result : null;

  useEffect(() => {
    setRevealedHints(0);
  }, [challenge.id]);

  const passedCount = checks?.filter(check => check.passed).length ?? 0;
  const total = checks?.length ?? 0;

  return (
    <div className="stack">
      <Card
        title={challenge.title}
        subtitle={challenge.brief}
        actions={
          <>
            <Badge tone={challenge.difficulty === 'hard' ? 'bad' : challenge.difficulty === 'medium' ? 'warn' : 'default'}>
              {challenge.difficulty}
            </Badge>
            <Badge tone={passed ? 'good' : 'accent'}>{passed ? 'passed' : `+${challenge.xp} XP`}</Badge>
          </>
        }
      >
        <div className="row tight" style={{ marginBottom: 10 }}>
          <Badge>{challenge.shots} shots</Badge>
          <Badge>{attempts.length} attempt(s)</Badge>
          {isActive && state.simulation.stale && <Badge tone="warn">result is stale</Badge>}
        </div>

        <h4 style={{ marginBottom: 6 }}>Objectives</h4>
        <ul className="list-plain" style={{ marginBottom: 12 }}>
          {challenge.objectives.map(objective => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>

        {!isActive ? (
          <button
            className="btn-primary"
            onClick={() => actions.openChallenge(challenge.id)}
          >
            Load challenge starter circuit
          </button>
        ) : (
          <>
            <CircuitGrid
              circuit={state.circuit}
              selectedOpId={state.selectedOpId}
              selectedGate={state.selectedGate}
              onPlace={(type, qubits, column) => actions.addGate(type, qubits, column)}
              onMove={(opId, column, qubits) => actions.moveGate(opId, column, qubits)}
              onSelectOp={actions.selectOp}
              onRemoveOp={actions.removeGate}
              extraColumns={2}
            />
            <div style={{ marginTop: 10 }}>
              <GatePalette selected={state.selectedGate} onSelect={actions.selectGate} />
            </div>

            <div className="row tight" style={{ marginTop: 12 }}>
              <button className="btn-small" onClick={() => actions.runSimulation(challenge.shots)}>
                <Play size={13} aria-hidden /> Run ({challenge.shots} shots)
              </button>
              <button
                className="btn-small btn-accent"
                onClick={() => actions.submitChallenge()}
                disabled={state.challengeSubmitting}
              >
                <ShieldCheck size={13} aria-hidden />
                {state.challengeSubmitting ? 'Checking…' : 'Submit for validation'}
              </button>
              <button className="btn-small btn-ghost" onClick={() => navigate('builder')}>
                Open in Circuit Builder
              </button>
              <button className="btn-small btn-ghost" onClick={() => actions.resetCircuit()}>
                Reset to starter
              </button>
              <button className="btn-small btn-ghost" onClick={() => actions.clearCircuit()}>
                Clear
              </button>
            </div>

            {result && (
              <p className="tiny muted" style={{ marginTop: 10, marginBottom: 0 }}>
                Last run: {result.measurement.buckets
                  .slice(0, 4)
                  .map(bucket => `${bucket.label} × ${bucket.count}`)
                  .join(' · ')}{' '}
                over {result.shots} shots.
              </p>
            )}
          </>
        )}
      </Card>

      <Card title="Validation" subtitle={checks ? `${passedCount}/${total} requirements met` : 'Submit the circuit to run the checks'}>
        {checks && (
          <>
            <ProgressBar value={passedCount} max={total} label="Requirements" hint={`${passedCount}/${total}`} />
            <div style={{ marginTop: 10 }}>
              {checks.map(check => (
                <div className="check" key={check.id}>
                  <span className={`check-mark ${check.passed ? 'pass' : 'fail'}`}>
                    {check.passed ? <Check size={12} aria-hidden /> : <X size={12} aria-hidden />}
                  </span>
                  <span>
                    <strong className="small">{check.label}</strong>
                    <div className="tiny muted">{check.detail}</div>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {!checks && <p className="muted small" style={{ margin: 0 }}>Expected outcome: {challenge.expectedOutcome}</p>}
        {checks && (
          <p className="tiny dim" style={{ marginTop: 10, marginBottom: 0 }}>
            Expected outcome: {challenge.expectedOutcome}
          </p>
        )}
      </Card>

      <Card title="Hints" subtitle="Reveal them one at a time — no XP penalty, but try it yourself first">
        <div className="stack" style={{ gap: 8 }}>
          {challenge.hints.slice(0, revealedHints).map((hint, index) => (
            <div key={hint} className="card tight" style={{ marginBottom: 0 }}>
              <span className="tiny dim">Hint {index + 1}</span>
              <div className="small">{hint}</div>
            </div>
          ))}
          {revealedHints < challenge.hints.length ? (
            <button className="btn-small" onClick={() => setRevealedHints(count => count + 1)}>
              Reveal hint {revealedHints + 1} of {challenge.hints.length}
            </button>
          ) : (
            <p className="tiny muted" style={{ margin: 0 }}>All hints revealed. The AI tutor can give you a nudge too.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
