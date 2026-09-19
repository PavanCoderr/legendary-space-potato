import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables, db } from './helpers';
import { signToken } from '../src/utils/jwt';

/**
 * E4 acceptance tests — backend lessons payload.
 *
 * Verifies that GET /api/lessons and GET /api/lessons/:id return the full
 * unpacked lesson metadata (video.youtubeId, objectives, xp, example.circuit,
 * concept, icon) and that the { lesson, progress } envelope is preserved.
 */
describe('Lessons API (E4)', () => {
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
      'lessons@example.com',
      passwordHash,
      'Lessons User',
      'Beginner',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    authToken = signToken({ userId: testUserId, email: 'lessons@example.com' });

    // Create activity record
    await database.run(
      'INSERT INTO activities (user_id, simulations, lessons_completed, quizzes_taken, challenges_passed, active_days, last_active_at, total_shots, updated_at) VALUES (?, 0, 0, 0, 0, ?, ?, 0, ?)',
      testUserId,
      JSON.stringify([]),
      new Date().toISOString(),
      new Date().toISOString(),
    );
  });

  afterAll(async () => {
    await cleanupTables();
  });

  it('GET /api/lessons returns 5 unpacked lessons with rich metadata', async () => {
    const res = await request(app)
      .get('/api/lessons')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(5);

    const qubits = res.body.find((l: any) => l.id === 'qubits');
    expect(qubits).toBeDefined();

    // video.youtubeId is a string
    expect(typeof qubits.video.youtubeId).toBe('string');

    // objectives is an array
    expect(Array.isArray(qubits.objectives)).toBe(true);
    expect(qubits.objectives.length).toBeGreaterThan(0);

    // xp is a number
    expect(typeof qubits.xp).toBe('number');
    expect(qubits.xp).toBeGreaterThan(0);

    // example.circuit is a serialized circuit object
    expect(qubits.example).toBeDefined();
    expect(typeof qubits.example.circuit).toBe('object');

    // concept is present (seeded into description JSON now)
    expect(qubits.concept).toBeDefined();

    // icon is a string (name)
    expect(typeof qubits.icon).toBe('string');
  });

  it('GET /api/lessons/:id returns { lesson, progress } envelope', async () => {
    const res = await request(app)
      .get('/api/lessons/qubits')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.lesson).toBeDefined();
    expect(res.body.progress).toBeDefined();

    // The lesson should carry the unpacked rich fields
    expect(typeof res.body.lesson.video.youtubeId).toBe('string');
    expect(Array.isArray(res.body.lesson.objectives)).toBe(true);
    expect(typeof res.body.lesson.xp).toBe('number');
    expect(res.body.lesson.concept).toBeDefined();
  });

  it('interactive.startCircuit is serialized in the lesson payload', async () => {
    const res = await request(app)
      .get('/api/lessons/qubits')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.lesson).toBeDefined();

    // The interactive block should include startCircuit (serialized circuit form)
    expect(res.body.lesson.interactive).toBeDefined();
    expect(res.body.lesson.interactive.startCircuit).toBeDefined();
    expect(typeof res.body.lesson.interactive.startCircuit).toBe('object');
    expect(Array.isArray(res.body.lesson.interactive.startCircuit.ops)).toBe(true);
  });
});
