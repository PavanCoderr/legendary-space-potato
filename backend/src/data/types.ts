import type { SerializedCircuit } from '../quantum/circuit';
import type { SimulationResult } from '../quantum/simulator';

/**
 * Domain model for QubitVerse (backend-compatible).
 *
 * This is a subset of the frontend types, adapted for the backend:
 * - `icon` is a string (icon name) instead of a LucideIcon component,
 *   so the backend never imports react or lucide-react.
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

export type LearningLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Session {
  signedIn: boolean;
  email: string;
  level: LearningLevel;
  signedInAt: string | null;
  demo: boolean;
  authToken: string | null;
}

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
  useFixedSeed: boolean;
  seed: number;
  autoRunOnChange: boolean;
  theme: Theme;
  aiProvider: AiProviderSettings;
}

export type Theme = 'light' | 'dark' | 'system';

export interface AiProviderSettings {
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
  availableGates: string[];
  startCircuit: SerializedCircuit;
  successNote: string;
  completionCheck: 'always' | 'touched-all-gates' | 'entangled' | 'measured-correlation';
}

export interface LessonExample {
  title: string;
  circuit: SerializedCircuit;
  shots: number;
  explanation: string;
  expectation: string;
}

export interface LessonVideo {
  youtubeId: string;
  title: string;
  duration: string;
  summary: string;
  chapters: { at: string; label: string }[];
}

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
  /** Icon name (e.g. "CircleDot") — backend stores the name, frontend resolves to a component. */
  icon: { displayName: string; name: string } | string | null;
  locked: boolean;
  prerequisites: string[];
  objectives: string[];
  video: LessonVideo;
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
  completedLessons: string[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpBonus: number;
  isUnlocked: (stats: AchievementStats) => boolean;
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'tutor';
  text: string;
  createdAt: string;
  contextSummary?: string;
  action?: string;
  followUps?: string[];
  source: 'local' | 'remote';
  pending?: boolean;
  error?: string;
}

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
  stale: boolean;
  ranAt: number | null;
}
