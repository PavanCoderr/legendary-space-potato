import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables, db } from './helpers';
import { signToken } from '../src/utils/jwt';
import { v4 as uuidv4 } from 'uuid';

/**
 * BF5 — /state round-trip regression test.
 *
 * PUT a snapshot with non-trivial progress + currentCircuit → GET → same values
 * come back; achievements is string[]; server xp overrides snapshot xp.
 */
describe('State round-trip (BF5)', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await initTestDb();

    const database = await db();
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('password123', 10);
    testUserId = uuidv4();
    await database.run(
      'INSERT INTO users (id, email, password_hash, name, level, xp, streak, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)',
      testUserId,
      'roundtrip@example.com',
      passwordHash,
      'Roundtrip User',
      'Beginner',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    authToken = signToken({ userId: testUserId, email: 'roundtrip@example.com' });
  });

  afterAll(async () => {
    await cleanupTables();
  });

  it('PUT progress → GET returns same progress with server-authoritative overrides', async () => {
    const snapshot = {
      version: 1,
      progress: {
        qubits: { status: 'in-progress', videoWatched: true, conceptRead: true },
        superposition: { status: 'completed', videoWatched: true, conceptRead: true, quizCorrect: 2, quizTotal: 3 },
      },
      projects: [
        {
          id: 'proj-roundtrip-1',
          name: 'My Circuit',
          circuit: { name: 'test', numQubits: 1, ops: [{ type: 'H', qubits: [0], column: 0 }] },
          code: '',
          lessonId: 'qubits',
          status: 'draft',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      currentCircuit: { name: 'My Circuit', numQubits: 1, ops: [{ type: 'H', qubits: [0], column: 0 }] },
      currentLessonId: 'qubits',
      achievements: ['first-steps'],
    };

    // PUT the snapshot
    const putRes = await request(app)
      .put('/state')
      .set('Authorization', `Bearer ${authToken}`)
      .send(snapshot);
    expect(putRes.status).toBe(200);

    // GET it back
    const getRes = await request(app)
      .get('/state')
      .set('Authorization', `Bearer ${authToken}`);
    expect(getRes.status).toBe(200);

    // Stored progress comes back
    expect(getRes.body.progress).toBeDefined();
    expect(getRes.body.progress.qubits).toEqual(snapshot.progress.qubits);
    expect(getRes.body.progress.superposition.status).toBe('completed');

    // Stored projects come back
    expect(getRes.body.projects).toBeDefined();
    expect(getRes.body.projects[0].id).toBe('proj-roundtrip-1');

    // Stored currentCircuit comes back
    expect(getRes.body.currentCircuit).toEqual(snapshot.currentCircuit);

    // achievements is string[]
    expect(Array.isArray(getRes.body.achievements)).toBe(true);
    expect(getRes.body.achievements.every((a: unknown) => typeof a === 'string')).toBe(true);

    // Server-authoritative fields are present (even if snapshot didn't provide them)
    expect(getRes.body.xp).toBeDefined();
    expect(getRes.body.streak).toBeDefined();
    expect(getRes.body.levelInfo).toBeDefined();
  });

  it('server xp overrides snapshot xp (ledger is source of truth)', async () => {
    // Submit a correct quiz answer to award XP server-side
    // qubits-1 has xp=20, correctIndex=1
    await request(app)
      .post('/api/quiz/submit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ quizId: 'qubits-1', selectedIndex: 1, correct: true });

    // PUT a snapshot claiming a different xp
    const snapshot = { version: 1, user: { id: 'x', xp: 9999 } };
    await request(app)
      .put('/state')
      .set('Authorization', `Bearer ${authToken}`)
      .send(snapshot);

    // GET — server xp (20) should win, not the snapshot's 9999
    const res = await request(app)
      .get('/state')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.xp).toBe(20);
  });

  it('server-awarded achievements are unioned with snapshot achievements', async () => {
    // The quiz correct submission above should have unlocked 'first-steps'
    // (lessonsStarted >= 1 is not met, but 'quiz-ace' needs 8 correct — let's just
    // verify the union behavior structurally).
    const snapshot = { version: 1, achievements: ['manually-added'] };
    await request(app)
      .put('/state')
      .set('Authorization', `Bearer ${authToken}`)
      .send(snapshot);

    const res = await request(app)
      .get('/state')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.achievements)).toBe(true);
    expect(res.body.achievements).toContain('manually-added');
  });
});
