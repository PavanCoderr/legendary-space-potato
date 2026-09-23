import type {
  ActivityLog,
  AiProviderSettings,
  AppSettings,
  ChallengeAttempt,
  ChallengeCheck,
  LearningLevel,
  LessonProgress,
  Project,
  QuizAttempt,
  Session,
  SimulatorRun,
  TutorMessage,
  User,
} from '../data/types';
import type { CircuitOp, GateType, QuantumCircuit, SerializedCircuit } from '../quantum';
import type { CodeIssue } from '../quantum/code';

/**
 * Runtime state.
 *
 * The circuit lives here once: the builder, simulator, visualizations, tutor and
 * practice system all read `state.circuit`, so they can never disagree about what is
 * loaded. Everything in `PersistedState` (see data/types.ts) is serialised to
 * localStorage; the fields marked "transient" are recomputed on every page load.
 */
export interface AppState {
  /** Persisted */
  user: User;
  session: Session;
  progress: Record<string, LessonProgress>;
  quizAttempts: QuizAttempt[];
  challengeAttempts: ChallengeAttempt[];
  achievements: string[];
  projects: Project[];
  currentLessonId: string | null;
  circuit: QuantumCircuit;
  settings: AppSettings;
  activity: ActivityLog;

  /** Persisted, capped length */
  tutorMessages: TutorMessage[];

  /** Transient */
  selectedGate: GateType | null;
  selectedOpId: string | null;
  simulation: SimulatorRun;
  code: string;
  codeIssues: CodeIssue[];
  codeDirty: boolean;
  builderMode: 'visual' | 'code';
  challengeId: string | null;
  challengeChecks: ChallengeCheck[] | null;
  challengeSubmitting: boolean;
  entanglementsBuilt: boolean;
  toast: { id: string; text: string; tone: 'info' | 'success' | 'error' } | null;
  hydrated: boolean;
}

export type Action =
  | { type: 'state/hydrate'; persisted: Partial<PersistedSnapshot> }
  | { type: 'session/sign-in'; email: string; name?: string; level: LearningLevel; demo?: boolean; authToken?: string | null; showWelcome?: boolean }
  | { type: 'session/sign-out' }
  | { type: 'session/set-level'; level: LearningLevel }
  | { type: 'user/rename'; name: string }
  | { type: 'user/add-xp'; amount: number; reason: string }
  | { type: 'progress/visit-lesson'; lessonId: string }
  | {
      type: 'progress/mark-step';
      lessonId: string;
      step: 'conceptRead' | 'videoWatched' | 'interactiveDone' | 'simulationRun' | 'tutorAsked';
    }
  | { type: 'progress/complete-lesson'; lessonId: string }
  | { type: 'progress/reset' }
  | { type: 'quiz/submit'; attempt: QuizAttempt }
  | { type: 'challenge/submit'; challengeId: string; shots?: number }
  | { type: 'challenge/submit-result'; attempt: ChallengeAttempt; challengeId: string; checks: ChallengeCheck[] }
  | { type: 'challenge/submit-from-server'; attempt: ChallengeAttempt; challengeId: string; checks: ChallengeCheck[] }
  | { type: 'challenge/set-active'; challengeId: string | null }
  | { type: 'challenge/set-submitting'; submitting: boolean }
  | { type: 'circuit/set'; circuit: QuantumCircuit; toast?: string }
  | { type: 'circuit/add-op'; gateType: GateType; qubits: number[]; column?: number }
  | { type: 'circuit/remove-op'; opId: string }
  | { type: 'circuit/move-op'; opId: string; column: number; qubits?: number[] }
  | { type: 'circuit/clear' }
  | { type: 'circuit/rename'; name: string }
  | { type: 'circuit/set-qubits'; numQubits: number }
  | { type: 'circuit/load'; serialized: SerializedCircuit }
  | { type: 'circuit/select-op'; opId: string | null }
  | { type: 'circuit/select-gate'; gateType: GateType | null }
  | { type: 'circuit/replace-op'; opId: string; next: Omit<CircuitOp, 'id'> }
  | { type: 'simulation/run'; shots?: number; seed?: number }
  | { type: 'simulation/clear' }
  | { type: 'code/set'; source: string }
  | { type: 'code/apply'; circuit: QuantumCircuit; issues: CodeIssue[] }
  | { type: 'code/issues'; issues: CodeIssue[] }
  | { type: 'code/set-mode'; mode: 'visual' | 'code' }
  | { type: 'tutor/add'; message: TutorMessage }
  | { type: 'tutor/update'; id: string; patch: Partial<TutorMessage> }
  | { type: 'tutor/clear' }
  | { type: 'projects/create'; project: Project }
  | { type: 'projects/update'; id: string; patch: Partial<Project> }
  | { type: 'projects/delete'; id: string }
  | { type: 'projects/duplicate'; id: string }
  | { type: 'settings/update'; patch: Partial<AppSettings> }
  | { type: 'settings/update-ai'; patch: Partial<AiProviderSettings> }
  | { type: 'toast'; text: string; tone: 'info' | 'success' | 'error' }
  | { type: 'toast/clear' };

/** What actually gets written to storage. */
export interface PersistedSnapshot {
  version: number;
  user: User;
  session: Session;
  progress: Record<string, LessonProgress>;
  quizAttempts: QuizAttempt[];
  challengeAttempts: ChallengeAttempt[];
  achievements: string[];
  projects: Project[];
  currentLessonId: string | null;
  currentCircuit: SerializedCircuit;
  settings: AppSettings;
  activity: ActivityLog;
  tutorHistory: TutorMessage[];
}
