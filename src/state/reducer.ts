import { ACHIEVEMENTS, evaluateAchievements } from '../data/achievements';
import { getChallenge } from '../data/challenges';
import { LESSONS, getLesson } from '../data/lessons';
import { quizzesForLesson } from '../data/quizzes';
import type { LessonProgress } from '../data/types';
import {
  addOp,
  clearCircuit,
  deserializeCircuit,
  moveOp,
  newId,
  removeOp,
  setNumQubits,
  validateCircuit,
  type QuantumCircuit,
} from '../quantum/circuit';
import { createSeededRandom, runSimulation } from '../quantum/simulator';
import { circuitToCode } from '../quantum/code';
import { assessEntanglement } from '../services/analysis';
import { applySnapshot } from './persistence';
import { achievementStatsOf, lessonProgressOf } from './selectors';
import { blankProgress, dayKey, nowIso } from './defaults';
import type { Action, AppState } from './types';

const MAX_TUTOR_MESSAGES = 40;

function withProgress(
  state: AppState,
  lessonId: string,
  patch: (progress: LessonProgress) => Partial<LessonProgress>,
): AppState {
  const current = lessonProgressOf(state, lessonId);
  return {
    ...state,
    progress: { ...state.progress, [lessonId]: { ...current, ...patch(current) } },
  };
}

/** Registers learning activity for the day, which drives the practice streak. */
function touchActivity(state: AppState, extra: Partial<AppState['activity']> = {}): AppState['activity'] {
  const today = dayKey();
  const activeDays = state.activity.activeDays.includes(today)
    ? state.activity.activeDays
    : [...state.activity.activeDays, today].slice(-400);
  return { ...state.activity, ...extra, activeDays, lastActiveAt: nowIso() };
}

function toast(state: AppState, text: string, tone: 'info' | 'success' | 'error' = 'info'): AppState {
  return { ...state, toast: { id: newId('toast'), text, tone } };
}

function markCircuitDirty(state: AppState, circuit: QuantumCircuit, toastText?: string): AppState {
  const next: AppState = {
    ...state,
    circuit,
    simulation: { ...state.simulation, stale: state.simulation.ranAt !== null },
    codeDirty: true,
    selectedOpId: circuit.ops.some(op => op.id === state.selectedOpId) ? state.selectedOpId : null,
  };
  return toastText ? toast(next, toastText, 'error') : next;
}

function syncAchievements(state: AppState): AppState {
  const unlocked = evaluateAchievements(achievementStatsOf(state));
  const fresh = unlocked.filter(id => !state.achievements.includes(id));
  if (fresh.length === 0) return state;
  const names = fresh
    .map(id => ACHIEVEMENTS.find(a => a.id === id)?.name ?? id)
    .join(', ');
  return toast(
    { ...state, achievements: [...state.achievements, ...fresh] },
    `Achievement unlocked: ${names}`,
    'success',
  );
}

function completeLessonIfDone(state: AppState, lessonId: string): AppState {
  const lesson = getLesson(lessonId);
  const progress = lessonProgressOf(state, lessonId);
  if (!lesson || progress.status === 'completed') return state;
  const quizzes = quizzesForLesson(lessonId);
  const quizDone = quizzes.length === 0 || progress.quizCorrect >= quizzes.length;
  const ready = progress.conceptRead && progress.interactiveDone && progress.simulationRun && quizDone;
  if (!ready) return state;
  return {
    ...progress0(state, lessonId),
    user: { ...state.user, xp: state.user.xp + lesson.xp },
    activity: touchActivity(state, { lessonsCompleted: state.activity.lessonsCompleted + 1 }),
    toast: { id: newId('toast'), text: `Lesson complete: ${lesson.title} (+${lesson.xp} XP)`, tone: 'success' },
  };
}

function progress0(state: AppState, lessonId: string): AppState {
  return withProgress(state, lessonId, () => ({
    status: 'completed',
    completedAt: nowIso(),
    lastVisitedAt: nowIso(),
  }));
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'state/hydrate': {
      return applySnapshot({ ...state, hydrated: true }, action.persisted);
    }

    /**
     * Mocked authentication. A real deployment would exchange credentials for a token
     * here (see the /api/auth endpoints described in services/api.ts); today the session
     * only records who is learning and at what level.
     */
    case 'session/sign-in': {
      const name = action.name?.trim();
      return toast(
        {
          ...state,
          user: name ? { ...state.user, name: name.slice(0, 40) } : state.user,
          session: {
            signedIn: true,
            email: action.email.trim(),
            level: action.level,
            signedInAt: nowIso(),
            demo: action.demo ?? false,
          },
          activity: touchActivity(state),
        },
        `Welcome ${name ? name.slice(0, 40) : 'back'} — ${action.level} track.`,
        'success',
      );
    }

    case 'session/sign-out':
      return {
        ...state,
        session: { ...state.session, signedIn: false, demo: false, signedInAt: null },
        toast: { id: newId('toast'), text: 'Signed out. Your progress is still saved on this device.', tone: 'info' },
      };

    case 'session/set-level':
      return toast(
        { ...state, session: { ...state.session, level: action.level } },
        `Learning level set to ${action.level}.`,
        'info',
      );

    case 'user/rename':
      return { ...state, user: { ...state.user, name: action.name.slice(0, 40) || 'Learner' } };

    case 'user/add-xp':
      return toast(
        { ...state, user: { ...state.user, xp: state.user.xp + action.amount } },
        `+${action.amount} XP · ${action.reason}`,
        'success',
      );

    case 'progress/visit-lesson': {
      const lesson = getLesson(action.lessonId);
      if (!lesson) return state;
      const next = withProgress(
        {
          ...state,
          currentLessonId: action.lessonId,
          activity: touchActivity(state),
        },
        action.lessonId,
        () => ({
          status: lessonProgressOf(state, action.lessonId).status === 'completed' ? 'completed' : 'in-progress',
          startedAt: lessonProgressOf(state, action.lessonId).startedAt ?? nowIso(),
          lastVisitedAt: nowIso(),
        }),
      );
      return syncAchievements(next);
    }

    case 'progress/mark-step': {
      const step = action.step;
      const next = withProgress(state, action.lessonId, () => ({ [step]: true }));
      const visited: AppState = {
        ...next,
        activity: step === 'simulationRun' ? next.activity : touchActivity(next),
      };
      return syncAchievements(completeLessonIfDone(visited, action.lessonId));
    }

    case 'progress/complete-lesson': {
      const lesson = getLesson(action.lessonId);
      if (!lesson) return state;
      const progress = lessonProgressOf(state, action.lessonId);
      if (progress.status === 'completed') return state;
      const forced: AppState = {
        ...state,
        user: { ...state.user, xp: state.user.xp + lesson.xp },
        activity: touchActivity(state, { lessonsCompleted: state.activity.lessonsCompleted + 1 }),
        progress: {
          ...state.progress,
          [action.lessonId]: {
            ...progress,
            status: 'completed',
            conceptRead: true,
            completedAt: nowIso(),
            lastVisitedAt: nowIso(),
          },
        },
        toast: { id: newId('toast'), text: `Lesson complete: ${lesson.title} (+${lesson.xp} XP)`, tone: 'success' },
      };
      return syncAchievements(forced);
    }

    case 'progress/reset':
      return {
        ...state,
        progress: LESSONS.reduce(
          (acc, lesson) => ({ ...acc, [lesson.id]: blankProgress(lesson.id) }),
          {} as Record<string, LessonProgress>,
        ),
        quizAttempts: [],
        challengeAttempts: [],
        achievements: [],
        activity: {
          simulations: 0,
          lessonsCompleted: 0,
          quizzesTaken: 0,
          challengesPassed: 0,
          activeDays: [],
          lastActiveAt: null,
          totalShots: 0,
        },
        entanglementsBuilt: false,
        toast: { id: newId('toast'), text: 'Progress reset. Your projects and circuits were kept.', tone: 'info' },
      };

    case 'quiz/submit': {
      const attempt = action.attempt;
      const quizzes = quizzesForLesson(attempt.lessonId);
      const alreadyCorrect = state.quizAttempts.some(a => a.quizId === attempt.quizId && a.correct);
      const award = attempt.correct && !alreadyCorrect;
      let next: AppState = {
        ...state,
        quizAttempts: [...state.quizAttempts, attempt].slice(-300),
        activity: touchActivity(state, { quizzesTaken: state.activity.quizzesTaken + 1 }),
      };
      if (award) {
        next = { ...next, user: { ...next.user, xp: next.user.xp + 20 } };
      }
      next = withProgress(next, attempt.lessonId, () => {
        const correctForLesson = next.quizAttempts.filter(a => a.lessonId === attempt.lessonId && a.correct);
        return {
          quizCorrect: new Set(correctForLesson.map(a => a.quizId)).size,
          quizTotal: quizzes.length,
        };
      });
      next = toast(
        next,
        award
          ? `Correct — +20 XP. ${quizzes.find(q => q.id === attempt.quizId)?.explanation ?? ''}`
          : attempt.correct
            ? 'Correct (already counted, no extra XP).'
            : 'Not quite — read the explanation and try the other options.',
        attempt.correct ? 'success' : 'error',
      );
      return syncAchievements(completeLessonIfDone(next, attempt.lessonId));
    }

    case 'challenge/set-active':
      return { ...state, challengeId: action.challengeId, challengeChecks: null };

    case 'challenge/set-submitting':
      return { ...state, challengeSubmitting: action.submitting };

    /**
     * Runs the circuit with the challenge's shot count and validates it in one step, so
     * the checks and the result the learner sees are always computed from the same run.
     */
    case 'challenge/submit': {
      const challenge = getChallenge(action.challengeId);
      if (!challenge) return state;
      const ranState = reducer(state, { type: 'simulation/run', shots: action.shots ?? challenge.shots });
      const circuitIssues = validateCircuit(ranState.circuit);
      const checks =
        ranState.simulation.result === null
          ? [
              {
                id: 'simulation-error',
                label: 'Circuit could simulate',
                passed: false,
                detail:
                  circuitIssues.find(issue => issue.severity === 'error')?.message ??
                  ranState.simulation.issues[0]?.message ??
                  'The circuit could not be simulated.',
              },
            ]
          : challenge.validate({
              circuit: ranState.circuit,
              simulation: ranState.simulation.result,
            });
      const passed = checks.length > 0 && checks.every(check => check.passed);
      const attempt = {
        id: newId('challenge-attempt'),
        challengeId: challenge.id,
        passed,
        checks: checks.map(check => ({
          label: check.label,
          passed: check.passed,
          detail: check.detail,
        })),
        attemptedAt: nowIso(),
        xpAwarded: 0,
      };
      return reducer(ranState, {
        type: 'challenge/submit-result',
        attempt,
        challengeId: challenge.id,
        checks,
      });
    }

    case 'challenge/submit-result': {
      const challenge = getChallenge(action.challengeId);
      if (!challenge) return state;
      const alreadyPassed = state.challengeAttempts.some(
        a => a.challengeId === action.challengeId && a.passed,
      );
      const attempt = { ...action.attempt, xpAwarded: action.attempt.passed && !alreadyPassed ? challenge.xp : 0 };
      let next: AppState = {
        ...state,
        challengeAttempts: [...state.challengeAttempts, attempt].slice(-200),
        challengeChecks: action.checks,
        challengeSubmitting: false,
        activity: touchActivity(state, {
          challengesPassed:
            state.activity.challengesPassed + (attempt.passed && !alreadyPassed ? 1 : 0),
        }),
      };
      if (attempt.xpAwarded > 0) {
        next = { ...next, user: { ...next.user, xp: next.user.xp + attempt.xpAwarded } };
      }
      if (attempt.passed) {
        // Only the challenge checkpoint is marked here; the lesson completes through its
        // normal criteria (concept, lab, simulation, quiz) so the status stays honest.
        next = withProgress(next, challenge.lessonId, () => ({ challengePassed: true }));
        next = toast(
          next,
          attempt.xpAwarded > 0
            ? `Challenge passed: ${challenge.title} (+${attempt.xpAwarded} XP)`
            : `Challenge passed again: ${challenge.title}`,
          'success',
        );
      } else {
        next = toast(next, 'Not yet — read the failing checks below and try again.', 'error');
      }
      return syncAchievements(completeLessonIfDone(next, challenge.lessonId));
    }

    case 'circuit/set':
      return markCircuitDirty(state, action.circuit, action.toast);

    case 'circuit/add-op': {
      const outcome = addOp(state.circuit, action.gateType, action.qubits, action.column);
      if (outcome.error) return toast(state, outcome.error, 'error');
      return markCircuitDirty(state, outcome.circuit);
    }

    case 'circuit/remove-op':
      return markCircuitDirty(state, removeOp(state.circuit, action.opId));

    case 'circuit/move-op': {
      const outcome = moveOp(state.circuit, action.opId, action.column, action.qubits);
      if (outcome.error) return toast(state, outcome.error, 'error');
      return { ...markCircuitDirty(state, outcome.circuit), selectedOpId: action.opId };
    }

    case 'circuit/replace-op': {
      if (!state.circuit.ops.some(op => op.id === action.opId)) return state;
      const withoutOp = removeOp(state.circuit, action.opId);
      const outcome = addOp(withoutOp, action.next.type, action.next.qubits, action.next.column);
      if (outcome.error) return toast(state, outcome.error, 'error');
      return { ...markCircuitDirty(state, outcome.circuit), selectedOpId: outcome.op?.id ?? null };
    }

    case 'circuit/clear':
      return markCircuitDirty(state, clearCircuit(state.circuit), undefined);

    case 'circuit/rename':
      return { ...state, circuit: { ...state.circuit, name: action.name.slice(0, 60) || 'Untitled circuit' } };

    case 'circuit/set-qubits': {
      const outcome = setNumQubits(state.circuit, action.numQubits);
      const next = markCircuitDirty(state, outcome.circuit);
      return outcome.error ? toast(next, outcome.error, 'info') : next;
    }

    case 'circuit/load': {
      const { circuit, issues } = deserializeCircuit(action.serialized, action.serialized.name);
      const next = markCircuitDirty(state, circuit);
      if (issues.length > 0) return toast(next, issues[0], 'info');
      return next;
    }

    case 'circuit/select-op': {
      const op = state.circuit.ops.find(o => o.id === action.opId);
      return { ...state, selectedOpId: action.opId, selectedGate: op ? op.type : state.selectedGate };
    }

    case 'circuit/select-gate':
      return { ...state, selectedGate: action.gateType };

    case 'simulation/run': {
      const issues = validateCircuit(state.circuit);
      if (issues.some(issue => issue.severity === 'error')) {
        return {
          ...toast(state, issues[0].message, 'error'),
          simulation: { result: null, issues, stale: false, ranAt: null },
        };
      }
      const shots = action.shots ?? state.settings.shots;
      const seed = action.seed ?? (state.settings.useFixedSeed ? state.settings.seed : undefined);
      const outcome = runSimulation(state.circuit, {
        shots,
        random: seed === undefined ? undefined : createSeededRandom(seed),
      });
      if (!outcome.ok || !outcome.result) {
        return {
          ...toast(state, `Simulation failed: ${outcome.issues[0]?.message ?? 'unknown error'}`, 'error'),
          simulation: { result: null, issues: outcome.issues, stale: false, ranAt: null },
        };
      }
      const entanglement = assessEntanglement(outcome.result);
      const next: AppState = {
        ...state,
        simulation: { result: outcome.result, issues: outcome.issues, stale: false, ranAt: outcome.result.ranAt },
        activity: touchActivity(state, {
          simulations: state.activity.simulations + 1,
          totalShots: state.activity.totalShots + shots,
        }),
        entanglementsBuilt: state.entanglementsBuilt || entanglement.entangled,
      };
      const withLesson = state.currentLessonId
        ? withProgress(next, state.currentLessonId, () => ({ simulationRun: true }))
        : next;
      return syncAchievements(
        state.currentLessonId ? completeLessonIfDone(withLesson, state.currentLessonId) : withLesson,
      );
    }

    case 'simulation/clear':
      return { ...state, simulation: { result: null, issues: [], stale: false, ranAt: null } };

    case 'code/set':
      return { ...state, code: action.source, codeDirty: true };

    case 'code/apply': {
      const next = markCircuitDirty({ ...state, codeIssues: action.issues }, action.circuit);
      return { ...next, codeDirty: false };
    }

    case 'code/issues':
      return { ...state, codeIssues: action.issues };

    case 'code/set-mode': {
      if (action.mode === 'visual') return { ...state, builderMode: 'visual' };
      return { ...state, builderMode: 'code', code: state.codeDirty ? circuitToCode(state.circuit) : state.code };
    }

    case 'tutor/add':
      return { ...state, tutorMessages: [...state.tutorMessages, action.message].slice(-MAX_TUTOR_MESSAGES) };

    case 'tutor/update':
      return {
        ...state,
        tutorMessages: state.tutorMessages.map(message =>
          message.id === action.id ? { ...message, ...action.patch } : message,
        ),
      };

    case 'tutor/clear':
      return { ...state, tutorMessages: [] };

    case 'projects/create':
      return syncAchievements({
        ...state,
        projects: [action.project, ...state.projects],
        toast: { id: newId('toast'), text: `Project saved: ${action.project.name}`, tone: 'success' },
      });

    case 'projects/update':
      return {
        ...state,
        projects: state.projects.map(project =>
          project.id === action.id ? { ...project, ...action.patch, updatedAt: nowIso() } : project,
        ),
      };

    case 'projects/delete':
      return {
        ...state,
        projects: state.projects.filter(project => project.id !== action.id),
        toast: { id: newId('toast'), text: 'Project deleted.', tone: 'info' },
      };

    case 'projects/duplicate': {
      const source = state.projects.find(project => project.id === action.id);
      if (!source) return state;
      const copy = {
        ...source,
        id: newId('project'),
        name: `${source.name} (copy)`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        status: 'draft' as const,
      };
      return syncAchievements({
        ...state,
        projects: [copy, ...state.projects],
        toast: { id: newId('toast'), text: `Duplicated ${source.name}.`, tone: 'success' },
      });
    }

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'settings/update-ai':
      return {
        ...state,
        settings: { ...state.settings, aiProvider: { ...state.settings.aiProvider, ...action.patch } },
      };

    case 'toast':
      return toast(state, action.text, action.tone);

    case 'toast/clear':
      return { ...state, toast: null };

    default:
      return state;
  }
}

