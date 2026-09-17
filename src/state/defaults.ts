import { ACHIEVEMENTS } from '../data/achievements';
import { LESSONS } from '../data/lessons';
import { SAMPLE_PROJECTS } from '../data/projects';
import type { AppSettings, LessonProgress, Session } from '../data/types';
import { createCircuit, newId } from '../quantum/circuit';
import type { AppState } from './types';

export const STORAGE_VERSION = 1;
export const STORAGE_KEY = 'qubitverse.state.v1';

export const DEFAULT_SETTINGS: AppSettings = {
  shots: 1000,
  useFixedSeed: false,
  seed: 42,
  autoRunOnChange: false,
  theme: 'dark',
  aiProvider: {
    mode: 'local',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
    temperature: 0.4,
  },
};

/**
 * The built-in demo learner.
 *
 * QubitVerse ships signed in as this account so every area is explorable without a
 * backend. Signing out (profile menu) returns you to the landing page and the login
 * screen, which is the mocked replacement for a real auth service.
 */
export const DEFAULT_SESSION: Session = {
  signedIn: true,
  email: 'alex@qubitverse.dev',
  level: 'Beginner',
  signedInAt: null,
  demo: true,
  authToken: null,
};

export function nowIso(): string {
  return new Date().toISOString();
}

/** Local calendar day key (YYYY-MM-DD) used for streaks. */
export function dayKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function blankProgress(lessonId: string): LessonProgress {
  return {
    lessonId,
    status: 'not-started',
    conceptRead: false,
    videoWatched: false,
    interactiveDone: false,
    simulationRun: false,
    tutorAsked: false,
    challengePassed: false,
    quizCorrect: 0,
    quizTotal: 0,
    startedAt: null,
    completedAt: null,
    lastVisitedAt: null,
  };
}

export function initialProgress(): Record<string, LessonProgress> {
  return LESSONS.reduce(
    (acc, lesson) => ({ ...acc, [lesson.id]: blankProgress(lesson.id) }),
    {} as Record<string, LessonProgress>,
  );
}

export function createInitialState(): AppState {
  return {
    user: {
      id: newId('user'),
      name: 'Alex Rivera',
      createdAt: nowIso(),
      xp: 0,
    },
    session: DEFAULT_SESSION,
    progress: initialProgress(),
    quizAttempts: [],
    challengeAttempts: [],
    achievements: [],
    projects: SAMPLE_PROJECTS.map(project => ({ ...project })),
    currentLessonId: null,
    circuit: createCircuit('Untitled circuit', 2),
    settings: DEFAULT_SETTINGS,
    activity: {
      simulations: 0,
      lessonsCompleted: 0,
      quizzesTaken: 0,
      challengesPassed: 0,
      activeDays: [],
      lastActiveAt: null,
      totalShots: 0,
    },
    tutorMessages: [],

    selectedGate: null,
    selectedOpId: null,
    simulation: { result: null, issues: [], stale: false, ranAt: null },
    code: '',
    codeIssues: [],
    codeDirty: true,
    builderMode: 'visual',
    challengeId: null,
    challengeChecks: null,
    challengeSubmitting: false,
    entanglementsBuilt: false,
    toast: null,
    hydrated: true,
  };
}

export function allAchievementIds(): string[] {
  return ACHIEVEMENTS.map(a => a.id);
}
