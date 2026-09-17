import { LESSONS } from '../data/lessons';
import type { AiProviderSettings, Lesson, QuizAttempt } from '../data/types';
import type { QuantumCircuit } from '../quantum/circuit';
import { runSimulation, type SimulationOptions, type SimulationResult } from '../quantum/simulator';
import { clearSnapshot, loadSnapshot, saveSnapshot } from '../state/persistence';
import type { PersistedSnapshot } from '../state/types';
import { localTutorReply, type TutorReply, type TutorRequest } from './tutor';
import { remoteTutorReply } from './llm';
import bcrypt from 'bcryptjs';

/**
 * Application API boundary.
 *
 * The UI never touches localStorage or `fetch` directly — it goes through this interface.
 * Today everything is served locally (browser storage + the TypeScript state-vector
 * simulator + the rule-based tutor), and setting `VITE_API_BASE_URL` switches state,
 * simulation and tutor calls to HTTP.
 *
 * ## Contract for the future Python / Flask backend
 *
 * | Method | Endpoint | Body | Returns |
 * | --- | --- | --- | --- |
 * | `loadState`     | `GET  /state`          | —               | `PersistedSnapshot` |
 * | `saveState`     | `PUT  /state`          | snapshot        | — |
 * | `clearState`    | `DELETE /state`        | —               | — |
 * | `runSimulation` | `POST /api/simulate`   | `{ circuit, shots, seed }` | `SimulationResult` |
 * | `fetchLessons`  | `GET  /api/lessons`    | —               | `Lesson[]` |
 * | `saveProgress`  | `POST /api/progress`   | snapshot        | — |
 * | `submitQuiz`    | `POST /api/quiz/submit`| `QuizAttempt`   | `{ recorded, explanation? }` |
 * | `askTutor`      | `POST /api/ai/explain` | `{ prompt, action, context }` | `TutorReply` |
 * | `askHint`       | `POST /api/ai/hint`    | `{ prompt, action, context }` | `TutorReply` |
 * | `signup`        | `POST /api/signup`     | `{ email, password, name, level }` | `{ user, token }` |
 * | `login`         | `POST /api/login`      | `{ email, password }` | `{ user, token }` |
 * | `logout`        | `POST /api/logout`     | — (Bearer token) | `{ success }` |
 *
 * Anything the backend does not implement yet falls back to the local implementation, so
 * the app keeps working while the service is built out one endpoint at a time.
 */
export interface QubitVerseApi {
  readonly kind: 'local' | 'http';
  loadState(): Promise<PersistedSnapshot | null>;
  saveState(snapshot: PersistedSnapshot): Promise<void>;
  clearState(): Promise<void>;
  runSimulation(circuit: QuantumCircuit, options?: SimulationOptions): Promise<SimulationResult>;
  askTutor(request: TutorRequest, provider: AiProviderSettings): Promise<TutorReply>;
  /** AI Tutor "hint" quick action — its own endpoint so a backend can tune the prompt. */
  askHint(request: TutorRequest, provider: AiProviderSettings): Promise<TutorReply>;
  /** The curriculum, so a backend can eventually serve lessons instead of bundling them. */
  fetchLessons(): Promise<Lesson[]>;
  /** Progress sync. Named separately from saveState to match the documented endpoint. */
  saveProgress(snapshot: PersistedSnapshot): Promise<void>;
  submitQuiz(attempt: QuizAttempt): Promise<{ recorded: boolean; explanation?: string }>;
  /** Authenticate (signup or login) with the backend, returning user + JWT token. */
  signup(email: string, password: string, name?: string, level?: string): Promise<{ user: any; token: string }>;
  login(email: string, password: string): Promise<{ user: any; token: string }>;
  /** End the session, discarding the JWT token. */
  logout(): Promise<void>;
}

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  level: string;
  createdAt: string;
}

const LOCAL_USERS_KEY = 'qubitverse.local-users.v1';

/** In-memory cache of localStorage-stored local users, hydrated on first use. */
let localUsers: Map<string, StoredUser> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function hydrateLocalUsers(): Map<string, StoredUser> {
  if (localUsers) return localUsers;
  localUsers = new Map<string, StoredUser>();
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const key of Object.keys(parsed)) localUsers.set(key, parsed[key]);
      }
    }
  } catch {
    /* ignore corrupt data — start fresh */
  }
  return localUsers;
}

function persistLocalUsers(): void {
  try {
    const obj: Record<string, StoredUser> = {};
    for (const [k, v] of localUsers!) obj[k] = v;
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(obj));
  } catch {
    /* ignore read-only storage */
  }
}

export function clearLocalUsers(): void {
  localUsers = null;
  try { localStorage.removeItem(LOCAL_USERS_KEY); } catch {}
}

export function createLocalApi(): QubitVerseApi {
  // Ensure the cache is hydrated before any method runs.
  hydrateLocalUsers();
  return {
    kind: 'local',
    async loadState() {
      return loadSnapshot();
    },
    async saveState(snapshot) {
      saveSnapshot(snapshot);
    },
    async clearState() {
      clearSnapshot();
    },
    async runSimulation(circuit, options) {
      const outcome = runSimulation(circuit, options);
      if (!outcome.ok || !outcome.result) {
        throw new Error(outcome.issues.map(issue => issue.message).join(' '));
      }
      return outcome.result;
    },
    async askTutor(request, provider) {
      if (provider.mode === 'openai-compatible') return remoteTutorReply(request, provider);
      return localTutorReply(request);
    },
    async askHint(request, provider) {
      const hintRequest: TutorRequest = { ...request, action: request.action ?? 'hint' };
      if (provider.mode === 'openai-compatible') return remoteTutorReply(hintRequest, provider);
      return localTutorReply(hintRequest);
    },
    async fetchLessons() {
      // The curriculum is bundled today; a backend can return the same shape later.
      return LESSONS;
    },
    async saveProgress(snapshot) {
      saveSnapshot(snapshot);
    },
    async submitQuiz(attempt) {
      // Answer checking happens in the reducer against the local quiz bank.
      return { recorded: false, explanation: attempt.correct ? 'Correct.' : 'Not quite.' };
    },
    // Local-only mode: password hashes are stored in localStorage and compared with
    // bcrypt, so a wrong password is genuinely rejected even without a backend.
    async signup(email, password, name, level) {
      if (!email || !password) throw new Error('Email and password are required');
      if (password.length < 6) throw new Error('Your password needs at least 6 characters.');

      const users = hydrateLocalUsers();
      const existing = users.get(email);
      if (existing) throw new Error('User already exists');

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = crypto.randomUUID();
      const record: StoredUser = { id: userId, email, passwordHash, name: name ?? email.split('@')[0], level: level ?? 'Beginner', createdAt: nowIso() };
      users.set(email, record);
      persistLocalUsers();
      return { user: { id: userId, email, name: record.name, level: record.level }, token: `local-${userId}` };
    },
    async login(email, password) {
      if (!email || !password) throw new Error('Email and password are required');
      if (password.length < 6) throw new Error('Your password needs at least 6 characters.');

      const users = hydrateLocalUsers();
      const record = users.get(email);
      if (!record) throw new Error('Invalid credentials');

      const ok = await bcrypt.compare(password, record.passwordHash);
      if (!ok) throw new Error('Invalid credentials');

      return { user: { id: record.id, email: record.email, name: record.name, level: record.level }, token: `local-${record.id}` };
    },
    async logout() {
      clearLocalUsers();
      try { localStorage.removeItem(LOCAL_USERS_KEY); } catch {}
    },
  };
}

const API_BASE = import.meta.env?.VITE_API_BASE_URL as string | undefined;

// In-memory copy of the current JWT. The frontend stores it in localStorage
// and the StoreProvider keeps this in sync so every fetch call is authenticated.
let authToken: string | null = null;
try {
  authToken = localStorage.getItem('qubitverse.auth.token');
} catch {
  /* SSR or blocked localStorage — token stays null */
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) {
    localStorage.setItem('qubitverse.auth.token', token);
  } else {
    localStorage.removeItem('qubitverse.auth.token');
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

/** HTTP implementation: a Flask service can implement these routes directly. */
export function createHttpApi(baseUrl: string): QubitVerseApi {
  const local = createLocalApi();
  const root = baseUrl.replace(/\/$/, '');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  });

  const post = async <T>(path: string, body: unknown, label: string): Promise<T> => {
    const response = await fetch(`${root}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`POST ${label} → ${response.status}`);
    return (await response.json()) as T;
  };

  return {
    kind: 'http',
    async loadState() {
      try {
        const response = await fetch(`${root}/state`, {
          headers: authHeaders(),
        });
        if (!response.ok) throw new Error(`GET /state → ${response.status}`);
        const payload = (await response.json()) as PersistedSnapshot | null;
        return payload ?? local.loadState();
      } catch (error) {
        console.warn('[qubitverse] backend unavailable, using local state', error);
        return local.loadState();
      }
    },
    async saveState(snapshot) {
      try {
        await fetch(`${root}/state`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(snapshot),
        });
      } catch (error) {
        console.warn('[qubitverse] backend save failed, keeping local copy', error);
      }
      await local.saveState(snapshot);
    },
    async clearState() {
      try {
        await fetch(`${root}/state`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
      } catch {
        /* ignore — the local copy is cleared below */
      }
      await local.clearState();
    },
    async runSimulation(circuit, options) {
      try {
        return await post<SimulationResult>(
          '/api/simulate',
          { circuit, shots: options?.shots },
          '/api/simulate',
        );
      } catch (error) {
        console.warn('[qubitverse] remote simulation unavailable, using the local simulator', error);
        return local.runSimulation(circuit, options);
      }
    },
    async askTutor(request, provider) {
      if (provider.mode === 'openai-compatible') return remoteTutorReply(request, provider);
      try {
        return await post<TutorReply>('/api/ai/explain', request, '/api/ai/explain');
      } catch (error) {
        console.warn('[qubitverse] remote tutor unavailable, using the built-in tutor', error);
        return local.askTutor(request, provider);
      }
    },
    async askHint(request, provider) {
      try {
        return await post<TutorReply>('/api/ai/hint', request, '/api/ai/hint');
      } catch (error) {
        console.warn('[qubitverse] remote hint unavailable, using the built-in tutor', error);
        return local.askHint(request, provider);
      }
    },
    async fetchLessons() {
      try {
        const response = await fetch(`${root}/api/lessons`, {
          headers: authHeaders(),
        });
        if (!response.ok) throw new Error(`GET /api/lessons → ${response.status}`);
        const payload = (await response.json()) as Lesson[];
        return Array.isArray(payload) && payload.length > 0 ? payload : local.fetchLessons();
      } catch (error) {
        console.warn('[qubitverse] remote lessons unavailable, using the bundled curriculum', error);
        return local.fetchLessons();
      }
    },
    async saveProgress(snapshot) {
      try {
        await post('/api/progress', snapshot, '/api/progress');
      } catch (error) {
        console.warn('[qubitverse] remote progress sync failed, keeping local copy', error);
      }
      await local.saveProgress(snapshot);
    },
    async submitQuiz(attempt) {
      try {
        return await post<{ recorded: boolean; explanation?: string }>('/api/quiz/submit', attempt, '/api/quiz/submit');
      } catch (error) {
        console.warn('[qubitverse] remote quiz submission failed, keeping the local answer', error);
        return local.submitQuiz(attempt);
      }
    },
    async signup(email, password, name, level) {
      const response = await fetch(`${root}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, level }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? `Signup failed → ${response.status}`);
      }
      const payload = (await response.json()) as { user: any; token: string };
      setAuthToken(payload.token);
      return payload;
    },
    async login(email, password) {
      const response = await fetch(`${root}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? 'Invalid credentials');
      }
      const payload = (await response.json()) as { user: any; token: string };
      setAuthToken(payload.token);
      return payload;
    },
    async logout() {
      if (authToken) {
        try {
          await fetch(`${root}/api/logout`, {
            method: 'POST',
            headers: authHeaders(),
          });
        } catch {
          /* ignore — token is cleared locally regardless */
        }
      }
      setAuthToken(null);
    },
  };
}

/** The API instance the app uses: HTTP when configured, local otherwise. */
export const api: QubitVerseApi = API_BASE ? createHttpApi(API_BASE) : createLocalApi();

export const API_MODE_LABEL = api.kind === 'http' ? `Connected to ${API_BASE}` : 'Local storage + in-browser simulator';
