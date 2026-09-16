import type { LucideIcon } from 'lucide-react';
import type { SerializedCircuit } from '../quantum/circuit';
import type { SimulationResult } from '../quantum/simulator';

/**
 * Domain model for QubitVerse.
 *
 * Everything here is plain data so it can be persisted to localStorage today and sent
 * to a backend later without changing the UI. Behaviour that needs computation
 * (challenge validation, achievements) is expressed as small predicates that receive
 * the data they need instead of reading global state.
 */
export type TopicId =
  | 'fundamentals'
  | 'gates'
  | 'circuit-building'
  | 'algorithms'
  | 'programming';

export interface Topic {
  id: TopicId;
  name: string;
  shortName: string;
  description: string;
  color: string;
}

export interface User {
  id: string;
  name: string;
  createdAt: string;
  xp: number;
}

/** Where a learner places themselves when they sign up. */
export type LearningLevel = 'Beginner' | 'Intermediate' | 'Advanced';

/**
 * Mocked session.
 *
 * There is no backend yet, so signing in simply records who is using the app and at
 * what level. Nothing here is a credential: the password is never stored. When the Flask
 * service arrives this becomes a token plus a user record (see services/api.ts).
 */
export interface Session {
  signedIn: boolean;
  email: string;
  level: LearningLevel;
  signedInAt: string | null;
  /** True while the app is running on the built-in demo account. */
  demo: boolean;
}

/** Stored shape of everything the app remembers between sessions. */
export interface PersistedState {
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

export interface AppSettings {
  shots: number;
  /** Reproducible measurement sampling. */
  useFixedSeed: boolean;
  seed: number;
  autoRunOnChange: boolean;
  /** Colour scheme of the interface; 'system' follows the OS preference. */
  theme: Theme;
  aiProvider: AiProviderSettings;
}

export type Theme = 'light' | 'dark' | 'system';

export interface AiProviderSettings {
  /** 'local' uses the built-in rule-based tutor and needs no API key. */
  mode: 'local' | 'openai-compatible';
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
}

export interface ActivityLog {
  simulations: number;
  lessonsCompleted: number;
  quizzesTaken: number;
  challengesPassed: number;
  /** ISO dates (YYYY-MM-DD) with any learning activity, used for the streak. */
  activeDays: string[];
  lastActiveAt: string | null;
  totalShots: number;
}

export type LessonStatus = 'not-started' | 'in-progress' | 'completed';

export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  conceptRead: boolean;
  videoWatched: boolean;
  interactiveDone: boolean;
  simulationRun: boolean;
  tutorAsked: boolean;
  challengePassed: boolean;
  quizCorrect: number;
  quizTotal: number;
  startedAt: string | null;
  completedAt: string | null;
  lastVisitedAt: string | null;
}

export type InteractiveKind = 'state-explorer' | 'entanglement-lab' | 'gate-tour' | 'algorithm-lab';

export interface LessonInteractive {
  kind: InteractiveKind;
  title: string;
  instructions: string;
  /** Gates the learner may apply in the embedded lab. */
  availableGates: string[];
  startCircuit: SerializedCircuit;
  /** Shown after the learner runs the lab at least once. */
  successNote: string;
  /** Optional success test used to mark the step as done. */
  completionCheck: 'always' | 'touched-all-gates' | 'entangled' | 'measured-correlation';
}

export interface LessonExample {
  title: string;
  circuit: SerializedCircuit;
  shots: number;
  explanation: string;
  /** What the numbers should look like, phrased for the learner. */
  expectation: string;
}

export interface LessonVideo {
  /**
   * YouTube video id, or a full URL pasted from the browser — both are accepted
   * (`dQw4w9WgXcQ`, `https://youtu.be/dQw4w9WgXcQ`, `watch?v=…`, `/embed/…`, `/shorts/…`).
   */
  youtubeId: string;
  title: string;
  /** Display duration, e.g. "12:45". */
  duration: string;
  /** Shown under the player so the learner knows what to listen for. */
  summary: string;
  chapters: { at: string; label: string }[];
}

/**
 * One named lesson inside a module.
 *
 * The module page renders these as the lesson navigator, so adding a lesson to the
 * curriculum is a data edit — no component changes (see data/lessons.ts).
 */
export interface LessonOutlineItem {
  title: string;
  minutes: number;
  summary: string;
}

export interface Lesson {
  id: string;
  title: string;
  topic: TopicId;
  level: 'beginner' | 'intermediate' | 'advanced';
  minutes: number;
  xp: number;
  summary: string;
  /** Lucide icon shown on the module card; the whole app draws from one icon set. */
  icon: LucideIcon;
  locked: boolean;
  prerequisites: string[];
  objectives: string[];
  /** The teaching video for this module — the "Watch" stage of the lesson flow. */
  video: LessonVideo;
  /** The module's named lessons, shown in the topic page navigator. */
  outline: LessonOutlineItem[];
  concept: {
    heading: string;
    paragraphs: string[];
    keyPoints: string[];
    math?: { expression: string; caption: string }[];
  };
  interactive: LessonInteractive;
  example: LessonExample;
  visualization: { focus: string; notes: string[] };
  aiPrompts: { label: string; prompt: string }[];
  quizIds: string[];
  challengeId: string;
  nextLessonId: string | null;
}

export interface Quiz {
  id: string;
  lessonId: string;
  topic: TopicId;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  xp: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  lessonId: string;
  selectedIndex: number;
  correct: boolean;
  attemptedAt: string;
}

export interface ChallengeCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ChallengeContext {
  circuit: import('../quantum/circuit').QuantumCircuit;
  simulation: SimulationResult | null;
}

export interface Challenge {
  id: string;
  lessonId: string;
  topic: TopicId;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  xp: number;
  brief: string;
  objectives: string[];
  hints: string[];
  shots: number;
  starterCircuit: SerializedCircuit;
  expectedOutcome: string;
  solutionCode: string;
  /** Pure function: same circuit + simulation always produce the same checks. */
  validate: (context: ChallengeContext) => ChallengeCheck[];
}

export interface ChallengeAttempt {
  id: string;
  challengeId: string;
  passed: boolean;
  checks: { label: string; passed: boolean; detail: string }[];
  attemptedAt: string;
  xpAwarded: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  circuit: SerializedCircuit;
  code: string;
  lessonId: string | null;
  status: 'draft' | 'in-progress' | 'completed';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AchievementStats {
  lessonsCompleted: number;
  lessonsStarted: number;
  quizzesCorrect: number;
  quizzesTaken: number;
  challengesPassed: number;
  simulations: number;
  projectsCreated: number;
  xp: number;
  streak: number;
  entanglementsBuilt: boolean;
  /** Module ids the learner has finished, for achievements that name a specific module. */
  completedLessons: string[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  xpBonus: number;
  isUnlocked: (stats: AchievementStats) => boolean;
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'tutor';
  text: string;
  createdAt: string;
  /** What the tutor looked at when composing the answer. */
  contextSummary?: string;
  action?: string;
  followUps?: string[];
  source: 'local' | 'remote';
  pending?: boolean;
  error?: string;
}

/** Snapshot of everything the tutor is allowed to see. */
export interface TutorContext {
  route: string;
  lesson: Lesson | null;
  circuit: import('../quantum/circuit').QuantumCircuit;
  selectedGate: string | null;
  simulation: SimulationResult | null;
  simulationStale: boolean;
  challenge: Challenge | null;
  challengeAttempts: number;
  lastChallengeChecks: ChallengeCheck[] | null;
  lastCodeIssues: string[];
  progress: LessonProgress | null;
  xp: number;
  streak: number;
}

export interface SimulatorRun {
  result: SimulationResult | null;
  issues: { severity: 'error' | 'warning'; message: string }[];
  /** True when the circuit changed after this result was produced. */
  stale: boolean;
  ranAt: number | null;
}
