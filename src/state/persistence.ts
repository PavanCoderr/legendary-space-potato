import type { LessonProgress, Project, TutorMessage } from '../data/types';
import { LESSONS } from '../data/lessons';
import { deserializeCircuit, serializeCircuit } from '../quantum/circuit';
import {
  DEFAULT_SESSION,
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  STORAGE_VERSION,
  blankProgress,
  createInitialState,
  nowIso,
} from './defaults';
import type { AppState, PersistedSnapshot } from './types';

/**
 * Local persistence layer.
 *
 * Storage is deliberately isolated behind these three functions so swapping in a REST
 * or Flask backend later means replacing this module with an API client that returns the
 * same snapshot shape (see services/api.ts).
 */
export function snapshotFromState(state: AppState): PersistedSnapshot {
  return {
    version: STORAGE_VERSION,
    user: state.user,
    session: state.session,
    progress: state.progress,
    quizAttempts: state.quizAttempts.slice(-200),
    challengeAttempts: state.challengeAttempts.slice(-200),
    achievements: state.achievements,
    projects: state.projects,
    currentLessonId: state.currentLessonId,
    currentCircuit: serializeCircuit(state.circuit),
    settings: state.settings,
    activity: state.activity,
    tutorHistory: state.tutorMessages.slice(-40),
  };
}

export function saveSnapshot(snapshot: PersistedSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('[qubitverse] could not persist state', error);
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[qubitverse] could not clear state', error);
  }
}

export function loadSnapshot(): PersistedSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as PersistedSnapshot;
  } catch (error) {
    console.warn('[qubitverse] ignoring unreadable saved state', error);
    return null;
  }
}

/** Merges a stored snapshot onto the defaults, tolerating missing or corrupt fields. */
export function applySnapshot(base: AppState, snapshot: Partial<PersistedSnapshot>): AppState {
  const issues: string[] = [];
  const progress: Record<string, LessonProgress> = { ...base.progress };
  if (snapshot.progress && typeof snapshot.progress === 'object') {
    for (const lesson of LESSONS) {
      const stored = (snapshot.progress as Record<string, LessonProgress>)[lesson.id];
      progress[lesson.id] = stored ? { ...blankProgress(lesson.id), ...stored } : progress[lesson.id];
    }
  } else {
    issues.push('Saved lesson progress was unreadable; starting a fresh progress record.');
  }

  let projects: Project[] = base.projects;
  if (Array.isArray(snapshot.projects)) {
    projects = snapshot.projects
      .filter((project): project is Project => Boolean(project && project.circuit))
      .map(project => ({
        ...project,
        tags: Array.isArray(project.tags) ? project.tags : [],
        status: project.status ?? 'draft',
        createdAt: project.createdAt ?? nowIso(),
        updatedAt: project.updatedAt ?? nowIso(),
      }));
  }

  const { circuit, issues: circuitIssues } = deserializeCircuit(
    snapshot.currentCircuit ?? serializeCircuit(base.circuit),
    'Recovered circuit',
  );
  issues.push(...circuitIssues);

  return {
    ...base,
    user: {
      ...base.user,
      ...(snapshot.user ?? {}),
      // Guard against null/empty name from backend or stale snapshots
      name: (snapshot.user?.name && typeof snapshot.user.name === 'string' && snapshot.user.name.trim())
        ? snapshot.user.name.trim()
        : base.user.name,
    },
    session: { ...DEFAULT_SESSION, ...(snapshot.session ?? {}) },
    progress,
    quizAttempts: Array.isArray(snapshot.quizAttempts) ? snapshot.quizAttempts : [],
    challengeAttempts: Array.isArray(snapshot.challengeAttempts) ? snapshot.challengeAttempts : [],
    achievements: Array.isArray(snapshot.achievements) ? snapshot.achievements : [],
    projects,
    currentLessonId: snapshot.currentLessonId ?? null,
    circuit,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(snapshot.settings ?? {}),
      aiProvider: { ...DEFAULT_SETTINGS.aiProvider, ...(snapshot.settings?.aiProvider ?? {}) },
    },
    activity: { ...base.activity, ...(snapshot.activity ?? {}) },
    tutorMessages: Array.isArray(snapshot.tutorHistory)
      ? (snapshot.tutorHistory.slice(-40) as TutorMessage[])
      : [],
    simulation: { ...base.simulation, stale: circuit.ops.length > 0 },
    codeIssues: [],
    toast: issues.length
      ? { id: 'hydrate', text: issues[0], tone: 'info' }
      : null,
  };
}

export function loadInitialState(): AppState {
  const base = createInitialState();
  const snapshot = loadSnapshot();
  return snapshot ? applySnapshot(base, snapshot) : base;
}

export { STORAGE_KEY, STORAGE_VERSION };
