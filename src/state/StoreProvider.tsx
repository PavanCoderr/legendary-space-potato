import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import { getChallenge } from '../data/challenges';
import { getLesson } from '../data/lessons';
import { SAMPLE_CIRCUITS } from '../data/presets';
import type { AppSettings, LearningLevel, Project, Quiz, TutorMessage } from '../data/types';
import { circuitToCode, parseCode, type CodeIssue } from '../quantum/code';
import {
  cloneCircuit,
  createCircuit,
  deserializeCircuit,
  newId,
  serializeCircuit,
  type GateType,
  type QuantumCircuit,
  type SerializedCircuit,
} from '../quantum/circuit';
import { api } from '../services/api';
import type { TutorAction } from '../services/tutor';
import { DEFAULT_SETTINGS, nowIso } from './defaults';
import { loadInitialState, snapshotFromState } from './persistence';
import { reducer } from './reducer';
import { lessonProgressOf, streakOf } from './selectors';
import { applyTheme, applyThemeAnimated, watchSystemTheme } from './theme';
import type { Action, AppState, PersistedSnapshot } from './types';

export interface StoreActions {
  /** Lessons, quizzes and progress */
  visitLesson: (lessonId: string) => void;
  markStep: (
    lessonId: string,
    step: 'conceptRead' | 'videoWatched' | 'interactiveDone' | 'simulationRun' | 'tutorAsked',
  ) => void;
  completeLesson: (lessonId: string) => void;
  resetProgress: () => void;
  submitQuiz: (quiz: Quiz, selectedIndex: number) => void;

  /** Circuit editing — every one of these goes through the shared circuit */
  addGate: (gateType: GateType, qubits: number[], column?: number) => void;
  removeGate: (opId: string) => void;
  moveGate: (opId: string, column: number, qubits?: number[]) => void;
  replaceGate: (opId: string, next: { type: GateType; qubits: number[]; column: number }) => void;
  clearCircuit: () => void;
  resetCircuit: () => void;
  loadCircuit: (serialized: SerializedCircuit) => void;
  loadPreset: (presetId: string, navigateTo?: string) => void;
  setQubits: (numQubits: number) => void;
  renameCircuit: (name: string) => void;
  selectGate: (gateType: GateType | null) => void;
  selectOp: (opId: string | null) => void;

  /** Simulation */
  runSimulation: (shots?: number, seed?: number) => void;
  clearSimulation: () => void;

  /** Code mode */
  setCode: (source: string) => void;
  applyCode: () => CodeIssue[];
  regenerateCode: () => string;
  setBuilderMode: (mode: 'visual' | 'code') => void;

  /** Tutor */
  askTutor: (prompt: string, action?: TutorAction, route?: string) => Promise<void>;
  clearTutor: () => void;

  /** Practice */
  openChallenge: (challengeId: string | null) => void;
  submitChallenge: () => void;
  openLessonChallenge: (lessonId: string) => void;

  /** Projects */
  saveProject: (input: { name: string; description: string; tags?: string[]; status?: Project['status'] }) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  duplicateProject: (id: string) => void;
  deleteProject: (id: string) => void;
  openProject: (id: string) => Project | null;

  /** Session — authenticates against the backend when configured */
  signIn: (input: { email: string; password: string; name?: string; level: LearningLevel; demo?: boolean }) => Promise<boolean>;
  signOut: () => Promise<void>;
  setLearningLevel: (level: LearningLevel) => void;

  /** User + settings */
  setName: (name: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateAiSettings: (patch: Partial<AppSettings['aiProvider']>) => void;
  pushToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
  dismissToast: () => void;
  resetEverything: () => Promise<void>;
  importState: (snapshot: Partial<PersistedSnapshot>) => void;
}

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  actions: StoreActions;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Builds the context object the tutor is allowed to read. */
function tutorContext(state: AppState, route: string) {
  const challenge = getChallenge(state.challengeId);
  return {
    route,
    lesson: state.currentLessonId ? (getLesson(state.currentLessonId) ?? null) : null,
    circuit: state.circuit,
    selectedGate: state.selectedGate,
    simulation: state.simulation.result,
    simulationStale: state.simulation.stale,
    challenge,
    challengeAttempts: challenge
      ? state.challengeAttempts.filter(attempt => attempt.challengeId === challenge.id).length
      : 0,
    lastChallengeChecks: state.challengeChecks,
    lastCodeIssues: state.codeIssues.map(issue => `Line ${issue.line}: ${issue.message}`),
    progress: state.currentLessonId ? lessonProgressOf(state, state.currentLessonId) : null,
    xp: state.user.xp,
    streak: streakOf(state),
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist (debounced) — the whole app state lives in one snapshot.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      void api.saveState(snapshotFromState(state));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [state]);

  // Toasts clear themselves so notifications never block the UI.
  useEffect(() => {
    if (!state.toast) return;
    const handle = window.setTimeout(() => dispatch({ type: 'toast/clear' }), 6500);
    return () => window.clearTimeout(handle);
  }, [state.toast]);

  // The theme is applied outside React (on <html>) so every surface — landing, auth and the
  // app shell — switches together, and 'system' keeps following the OS preference. The first
  // application (page load) is instant; later switches cross-fade via applyThemeAnimated.
  const themeMounted = useRef(false);
  useEffect(() => {
    const apply = themeMounted.current ? applyThemeAnimated : applyTheme;
    apply(state.settings.theme);
    themeMounted.current = true;
    if (state.settings.theme !== 'system') return undefined;
    return watchSystemTheme(() => applyThemeAnimated('system'));
  }, [state.settings.theme]);

  const actions = useMemo<StoreActions>(() => {
    const loadSerialized = (serialized: SerializedCircuit) => {
      dispatch({ type: 'circuit/load', serialized });
      const { circuit } = deserializeCircuit(serialized, serialized.name);
      dispatch({ type: 'code/set', source: circuitToCode(circuit) });
    };

    return {
      visitLesson: lessonId => dispatch({ type: 'progress/visit-lesson', lessonId }),
      markStep: (lessonId, step) => dispatch({ type: 'progress/mark-step', lessonId, step }),
      completeLesson: lessonId => dispatch({ type: 'progress/complete-lesson', lessonId }),
      resetProgress: () => dispatch({ type: 'progress/reset' }),
      submitQuiz: (quiz, selectedIndex) =>
        dispatch({
          type: 'quiz/submit',
          attempt: {
            id: newId('quiz-attempt'),
            quizId: quiz.id,
            lessonId: quiz.lessonId,
            selectedIndex,
            correct: selectedIndex === quiz.correctIndex,
            attemptedAt: nowIso(),
          },
        }),

      addGate: (gateType, qubits, column) => dispatch({ type: 'circuit/add-op', gateType, qubits, column }),
      removeGate: opId => dispatch({ type: 'circuit/remove-op', opId }),
      moveGate: (opId, column, qubits) => dispatch({ type: 'circuit/move-op', opId, column, qubits }),
      replaceGate: (opId, next) => dispatch({ type: 'circuit/replace-op', opId, next }),
      clearCircuit: () => dispatch({ type: 'circuit/clear' }),
      resetCircuit: () => {
        const current = stateRef.current;
        const challenge = getChallenge(current.challengeId);
        if (challenge && challenge.starterCircuit.ops.length > 0) {
          loadSerialized(challenge.starterCircuit);
          dispatch({ type: 'toast', text: 'Circuit reset to the challenge starter.', tone: 'info' });
          return;
        }
        loadSerialized({
          name: current.circuit.name,
          numQubits: current.circuit.numQubits,
          ops: [],
        });
        dispatch({ type: 'toast', text: 'Circuit reset.', tone: 'info' });
      },
      loadCircuit: loadSerialized,
      loadPreset: presetId => {
        const preset = SAMPLE_CIRCUITS.find(entry => entry.id === presetId);
        if (!preset) {
          dispatch({ type: 'toast', text: `Unknown preset “${presetId}”.`, tone: 'error' });
          return;
        }
        loadSerialized(preset.build());
        dispatch({ type: 'toast', text: `Loaded preset: ${preset.name}`, tone: 'success' });
      },
      setQubits: numQubits => dispatch({ type: 'circuit/set-qubits', numQubits }),
      renameCircuit: name => dispatch({ type: 'circuit/rename', name }),
      selectGate: gateType => dispatch({ type: 'circuit/select-gate', gateType }),
      selectOp: opId => dispatch({ type: 'circuit/select-op', opId }),

      runSimulation: (shots, seed) => dispatch({ type: 'simulation/run', shots, seed }),
      clearSimulation: () => dispatch({ type: 'simulation/clear' }),

      setCode: source => dispatch({ type: 'code/set', source }),
      applyCode: () => {
        const { circuit, issues } = parseCode(stateRef.current.code);
        if (circuit && issues.every(issue => issue.severity !== 'error')) {
          dispatch({ type: 'code/apply', circuit, issues });
          dispatch({
            type: 'toast',
            text: `Code applied: ${circuit.numQubits} qubit(s), ${circuit.ops.length} gate(s).`,
            tone: 'success',
          });
        } else {
          dispatch({ type: 'code/issues', issues });
          dispatch({
            type: 'toast',
            text: issues[0] ? `Line ${issues[0].line}: ${issues[0].message}` : 'The code could not be parsed.',
            tone: 'error',
          });
        }
        return issues;
      },
      regenerateCode: () => {
        const source = circuitToCode(stateRef.current.circuit);
        dispatch({ type: 'code/set', source });
        dispatch({ type: 'code/apply', circuit: stateRef.current.circuit, issues: [] });
        return source;
      },
      setBuilderMode: mode => dispatch({ type: 'code/set-mode', mode }),

      askTutor: async (prompt, action, route = '') => {
        const current = stateRef.current;
        const userMessage: TutorMessage = {
          id: newId('tutor'),
          role: 'user',
          text: prompt,
          createdAt: nowIso(),
          action,
          source: 'local',
        };
        const pendingId = newId('tutor');
        dispatch({ type: 'tutor/add', message: userMessage });
        dispatch({
          type: 'tutor/add',
          message: {
            id: pendingId,
            role: 'tutor',
            text: 'Thinking about your circuit…',
            createdAt: nowIso(),
            source: 'local',
            pending: true,
          },
        });
        if (current.currentLessonId) {
          dispatch({ type: 'progress/mark-step', lessonId: current.currentLessonId, step: 'tutorAsked' });
        }
        try {
          const reply = await api.askTutor(
            { prompt, action, context: tutorContext(current, route) },
            current.settings.aiProvider,
          );
          dispatch({
            type: 'tutor/update',
            id: pendingId,
            patch: {
              text: reply.text,
              followUps: reply.followUps,
              contextSummary: reply.contextSummary,
              source: reply.source,
              error: reply.error,
              pending: false,
            },
          });
        } catch (error) {
          dispatch({
            type: 'tutor/update',
            id: pendingId,
            patch: {
              text: 'Something went wrong while building an answer.',
              error: error instanceof Error ? error.message : String(error),
              pending: false,
            },
          });
        }
      },
      clearTutor: () => dispatch({ type: 'tutor/clear' }),

      openChallenge: challengeId => {
        dispatch({ type: 'challenge/set-active', challengeId });
        const challenge = getChallenge(challengeId);
        if (challenge) loadSerialized(challenge.starterCircuit);
      },
      submitChallenge: () => {
        const challengeId = stateRef.current.challengeId;
        if (!challengeId) {
          dispatch({ type: 'toast', text: 'Open a challenge before submitting.', tone: 'error' });
          return;
        }
        dispatch({ type: 'challenge/set-submitting', submitting: true });
        dispatch({ type: 'challenge/submit', challengeId });
      },
      openLessonChallenge: lessonId => {
        const lesson = getLesson(lessonId);
        if (!lesson) return;
        const challenge = getChallenge(lesson.challengeId);
        if (!challenge) {
          dispatch({ type: 'toast', text: 'This lesson has no challenge yet.', tone: 'info' });
          return;
        }
        dispatch({ type: 'challenge/set-active', challengeId: challenge.id });
        loadSerialized(challenge.starterCircuit);
      },

      saveProject: input => {
        const current = stateRef.current;
        const project: Project = {
          id: newId('project'),
          name: input.name.trim() || 'Untitled project',
          description: input.description.trim(),
          circuit: serializeCircuit(current.circuit),
          code: current.code.trim() || circuitToCode(current.circuit),
          lessonId: current.currentLessonId,
          status: input.status ?? 'draft',
          tags: input.tags ?? [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        dispatch({ type: 'projects/create', project });
        return project;
      },
      updateProject: (id, patch) => dispatch({ type: 'projects/update', id, patch }),
      duplicateProject: id => dispatch({ type: 'projects/duplicate', id }),
      deleteProject: id => dispatch({ type: 'projects/delete', id }),
      openProject: id => {
        const project = stateRef.current.projects.find(entry => entry.id === id);
        if (!project) {
          dispatch({ type: 'toast', text: 'That project no longer exists.', tone: 'error' });
          return null;
        }
        loadSerialized(project.circuit);
        dispatch({ type: 'code/set', source: project.code || circuitToCode(stateRef.current.circuit) });
        dispatch({ type: 'projects/update', id, patch: {} });
        return project;
      },

      signIn: async ({ email, password, name, level, demo }) => {
        // Demo mode signs in locally without hitting any auth store.
        if (demo) {
          dispatch({ type: 'session/sign-in', email, name, level, demo: true, authToken: null });
          return true;
        }

        try {
          // Try login first; only fall back to signup when the user doesn't exist.
          // A wrong password must NOT trigger signup — it should fail with an error.
          let result;
          try {
            result = await api.login(email, password);
          } catch (loginError) {
            // Distinguish "user not found" (fall back to signup) from "wrong password" (reject).
            const msg = loginError instanceof Error ? loginError.message : String(loginError);
            const userNotFound =
              msg.includes('not found') || msg.toLowerCase().includes('no such user');
            if (!userNotFound) throw loginError;
            result = await api.signup(email, password, name, level);
          }

          dispatch({
            type: 'session/sign-in',
            email: result.user.email,
            name: result.user.name ?? name,
            level: result.user.level ?? level,
            demo: false,
            authToken: result.token,
          });

          // Load the user's saved snapshot. In HTTP mode this is token-scoped server
          // state; in local mode it's the (already-cleared-on-sign-out) browser snapshot.
          const remoteState = await api.loadState();
          if (remoteState) {
            dispatch({ type: 'state/hydrate', persisted: remoteState });
            // The snapshot may carry a stale user/name from the browser's debounced
            // save; re-assert the identity returned by the auth endpoint so the freshly
            // signed-in user is always the one reflected on screen.
            dispatch({
              type: 'session/sign-in',
              email: result.user.email,
              name: result.user.name ?? name,
              level: result.user.level ?? level,
              demo: false,
              authToken: result.token,
            });
          }

          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          dispatch({
            type: 'toast',
            text: `Sign in failed: ${message}`,
            tone: 'error',
          });
          return false;
        }
      },
      signOut: async () => {
        // Dispatch first so the reducer resets all per-user state (progress, projects, etc.)
        // before the next debounced persist fires. If clearState() runs before the dispatch,
        // the 250ms debounced save will re-write the old (pre-clear) state back to localStorage.
        dispatch({ type: 'session/sign-out' });
        await api.logout();
        // Clear any locally persisted snapshot so the next user starts fresh.
        await api.clearState();
      },
      setLearningLevel: level => dispatch({ type: 'session/set-level', level }),

      setName: name => dispatch({ type: 'user/rename', name }),
      updateSettings: patch => dispatch({ type: 'settings/update', patch }),
      updateAiSettings: patch => dispatch({ type: 'settings/update-ai', patch }),
      pushToast: (text, tone = 'info') => dispatch({ type: 'toast', text, tone }),
      dismissToast: () => dispatch({ type: 'toast/clear' }),
      resetEverything: async () => {
        await api.clearState();
        dispatch({ type: 'progress/reset' });
        dispatch({ type: 'circuit/set', circuit: createCircuit('Untitled circuit', 2) });
        dispatch({ type: 'settings/update', patch: DEFAULT_SETTINGS });
        dispatch({ type: 'tutor/clear' });
      },
      importState: snapshot => dispatch({ type: 'state/hydrate', persisted: snapshot }),
    };
  }, []);

  const value = useMemo<StoreValue>(() => ({ state, dispatch, actions }), [state, actions]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}

/** Shorthand: the shared state plus the action helpers. */
export function useApp() {
  const { state, actions, dispatch } = useStore();
  return { state, actions, dispatch };
}

/** The circuit that every area of the app reads and writes. */
export function useCircuit(): QuantumCircuit {
  return useStore().state.circuit;
}

/** Clones the current circuit for a component that wants an isolated copy. */
export function useCircuitCopy(): QuantumCircuit {
  const { state } = useStore();
  return useMemo(() => cloneCircuit(state.circuit), [state.circuit]);
}

