import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * E3 drift test — keeps the frontend and backend quiz banks in sync.
 *
 * The project deliberately maintains two copies of the quiz data:
 *   - src/data/quizzes.ts        (bundled with the Vite/Roll front end, read-only fallback)
 *   - backend/src/data/quizzes.ts (served live by the QNode HTTP API)
 *
 * They must always stay aligned. If someone edits one and not the other the
 * normalizer in src/services/api.ts would serve stale questions while the API
 * serves fresh ones, so this test fails fast instead.
 */

const ROOT = join(process.cwd());
const FRONTEND = readFileSync(join(ROOT, 'src/data/quizzes.ts'), 'utf-8');
const BACKEND = readFileSync(join(ROOT, 'backend/src/data/quizzes.ts'), 'utf-8');

/**
 * Pull just the array literal out of each module so we can compare apples to
 * apples without importing either side (the import paths / types differ).
 */
function extractIds(source: string): string[] {
  // match every `{ id: '<value>'` occurrence — ids are unique strings
  const re = /id:\s*['"]([^'"]+)['"]/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

describe('quiz bank parity (E3 drift test)', () => {
  it('same number of quizzes in frontend and backend', () => {
    const f = extractIds(FRONTEND);
    const b = extractIds(BACKEND);
    expect(f).toEqual(b);
    expect(f.length).toBeGreaterThan(0);
  });

  it('every frontend id exists in backend', () => {
    const f = new Set(extractIds(FRONTEND));
    const b = new Set(extractIds(BACKEND));
    [...f].forEach(id => expect(b.has(id), `frontend id "${id}" missing from backend`).toBe(true));
  });

  it('every backend id exists in frontend', () => {
    const f = new Set(extractIds(FRONTEND));
    const b = new Set(extractIds(BACKEND));
    [...b].forEach(id => expect(f.has(id), `backend id "${id}" missing from frontend`).toBe(true));
  });

  it('the E6 batch of 10 quizzes is present in both files', () => {
    const expectedIds = [
      'qubits-3',
      'qubits-4',
      'qubits-5',
      'superposition-3',
      'superposition-4',
      'superposition-5',
      'entanglement-3',
      'entanglement-4',
      'gates-3',
      'gates-4',
    ];
    const f = new Set(extractIds(FRONTEND));
    const b = new Set(extractIds(BACKEND));
    expectedIds.forEach(id => {
      expect(f.has(id), `E6 quiz "${id}" missing from frontend`).toBe(true);
      expect(b.has(id), `E6 quiz "${id}" missing from backend`).toBe(true);
    });
  });
});
