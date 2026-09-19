import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables, db } from './helpers';
import { signToken } from '../src/utils/jwt';

describe('User State Endpoints', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await initTestDb();

    const database = await db();
    const { v4: uuidv4 } = await import('uuid');
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('password123', 10);
    testUserId = uuidv4();
    await database.run(
      'INSERT INTO users (id, email, password_hash, name, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      testUserId,
      'state@example.com',
      passwordHash,
      'State User',
      'Beginner',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    authToken = signToken({ userId: testUserId, email: 'state@example.com' });
  });

  afterAll(async () => {
    await cleanupTables();
  });

  it('should get user state via GET /state', async () => {
    const res = await request(app)
      .get('/state')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('state@example.com');
    expect(res.body.activities).toBeDefined();
    expect(res.body.circuits).toBeInstanceOf(Array);
  });

  it('should reject GET /state without auth', async () => {
    const res = await request(app).get('/state');
    expect(res.status).toBe(401);
  });

  it('should save state via PUT /state', async () => {
    const snapshot = {
      version: 1,
      user: { id: 'test', name: 'Test', email: 'test@test.com', xp: 100 },
      session: { signedIn: true, email: 'test@test.com', level: 'Beginner', signedInAt: null, demo: false },
      progress: {},
      quizAttempts: [],
      challengeAttempts: [],
      achievements: [],
      projects: [{ id: 'proj-1', name: 'Test Circuit', circuit: { name: 'test', numQubits: 1, ops: [] }, code: '', lessonId: null, status: 'draft', tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      currentLessonId: 'qubits',
      currentCircuit: { name: 'My Circuit', numQubits: 1, ops: [{ type: 'H', qubits: [0], column: 0 }] },
      settings: { shots: 1024, useFixedSeed: false, seed: 42, autoRunOnChange: true, theme: 'dark', aiProvider: { mode: 'local', baseUrl: '', model: '', apiKey: '', temperature: 0.7 } },
      activity: { simulations: 1, lessonsCompleted: 0, quizzesTaken: 0, challengesPassed: 0, activeDays: [], lastActiveAt: null, totalShots: 100 },
      tutorHistory: [],
    };

    const res = await request(app)
      .put('/state')
      .set('Authorization', `Bearer ${authToken}`)
      .send(snapshot);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject PUT /state without auth', async () => {
    const res = await request(app).put('/state').send({ version: 1 });
    expect(res.status).toBe(401);
  });

  it('should clear state via DELETE /state', async () => {
    // First save some state
    await request(app)
      .put('/state')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ version: 1, test: true });

    // Then delete it
    const res = await request(app)
      .delete('/state')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject DELETE /state without auth', async () => {
    const res = await request(app).delete('/state');
    expect(res.status).toBe(401);
  });

  it('should also accept PUT /api/state (mounted under /api)', async () => {
    const res = await request(app)
      .put('/api/state')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ version: 1, test: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should also accept DELETE /api/state (mounted under /api)', async () => {
    const res = await request(app)
      .delete('/api/state')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('round-trips lesson progress: PUT progress → GET returns same progress', async () => {
    // Store a snapshot with lesson progress
    const snapshot = {
      version: 1,
      progress: {
        qubits: { status: 'in-progress', videoWatched: true, conceptRead: true },
        superposition: { status: 'completed', videoWatched: true, conceptRead: true, quizCorrect: 2, quizTotal: 3 },
      },
      projects: [
        { id: 'proj-roundtrip', name: 'My Circuit', circuit: { name: 'test', numQubits: 1, ops: [] }, code: '', lessonId: 'qubits', status: 'draft', tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
      achievements: ['first-steps'],
      currentCircuit: { name: 'My Circuit', numQubits: 1, ops: [{ type: 'H', qubits: [0], column: 0 }] },
    };

    const putRes = await request(app)
      .put('/state')
      .set('Authorization', `Bearer ${authToken}`)
      .send(snapshot);

    expect(putRes.status).toBe(200);

    // GET the state back and verify progress round-trips
    const getRes = await request(app)
      .get('/state')
      .set('Authorization', `Bearer ${authToken}`);

    expect(getRes.status).toBe(200);
    // The stored snapshot fields should come back
    expect(getRes.body.progress).toBeDefined();
    expect(getRes.body.progress.qubits).toEqual(snapshot.progress.qubits);
    expect(getRes.body.progress.superposition.status).toBe('completed');
    expect(getRes.body.projects).toBeDefined();
    expect(getRes.body.projects[0].id).toBe('proj-roundtrip');
    // Server-authoritative fields are present alongside the snapshot
    expect(getRes.body.xp).toBeDefined();
    expect(getRes.body.streak).toBeDefined();
    expect(getRes.body.levelInfo).toBeDefined();
    expect(Array.isArray(getRes.body.achievements)).toBe(true);
  });
});
