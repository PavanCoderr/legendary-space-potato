import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables, db } from './helpers';
import { signToken } from '../src/utils/jwt';
import { v4 as uuidv4 } from 'uuid';

describe('XP & Streak System', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await initTestDb();

    const database = await db();
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('password123', 10);
    testUserId = uuidv4();
    await database.run(
      'INSERT INTO users (id, email, password_hash, name, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      testUserId,
      'xp-test@example.com',
      passwordHash,
      'XP Test User',
      'Beginner',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    authToken = signToken({ userId: testUserId, email: 'xp-test@example.com' });
  });

  afterAll(async () => {
    await cleanupTables();
  });

  it('should award XP on first correct quiz answer', async () => {
    // Submit a correct answer to quiz 'qubits-1'
    const res = await request(app)
      .post('/api/quiz/submit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ quizId: 'qubits-1', selectedIndex: 1, correct: true });

    expect(res.status).toBe(200);
    expect(res.body.recorded).toBe(true);
    expect(res.body.xpAwarded).toBeGreaterThan(0);
  });

  it('should NOT award XP for duplicate correct quiz answer (idempotency)', async () => {
    // Submit the same correct answer again — should NOT award XP
    const res = await request(app)
      .post('/api/quiz/submit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ quizId: 'qubits-1', selectedIndex: 1, correct: true });

    expect(res.status).toBe(200);
    expect(res.body.recorded).toBe(true);
    expect(res.body.xpAwarded).toBeUndefined();

    // Verify only ONE ledger row exists for this quiz
    const database = await db();
    const rows = await database.all(
      'SELECT COUNT(*) as count FROM xp_ledger WHERE user_id = ? AND source_type = ? AND source_id = ?',
      testUserId, 'quiz_correct', 'qubits-1',
    );
    expect(rows[0].count).toBe(1);
  });

  it('should expose XP and streak via GET /state', async () => {
    const res = await request(app)
      .get('/state')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.xp).toBeGreaterThan(0);
    expect(res.body.streak).toBeGreaterThanOrEqual(0);
    expect(res.body.achievements).toBeInstanceOf(Array);
    expect(res.body.levelInfo).toHaveProperty('level');
  });

  it('should cascade delete user progress when user is deleted (FK enforcement)', async () => {
    const database = await db();
    const victimId = uuidv4();

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('victim123', 10);
    await database.run(
      'INSERT INTO users (id, email, password_hash, name, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      victimId,
      'victim@example.com',
      passwordHash,
      'Victim User',
      'Beginner',
      new Date().toISOString(),
      new Date().toISOString(),
    );

    // Add some progress
    await database.run(
      'INSERT INTO activities (user_id, simulations, lessons_completed, quizzes_taken, challenges_passed, active_days, last_active_at, total_shots, updated_at) VALUES (?, 0, 0, 0, 0, ?, ?, 0, ?)',
      victimId, JSON.stringify([]), new Date().toISOString(), new Date().toISOString(),
    );
    await database.run(
      'INSERT INTO lesson_progress (id, user_id, lesson_id, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      uuidv4(), victimId, 'qubits', 'completed', new Date().toISOString(), new Date().toISOString(),
    );

    // Delete the user
    await database.run('DELETE FROM users WHERE id = ?', victimId);

    // Verify cascade
    const activities = await database.all('SELECT * FROM activities WHERE user_id = ?', victimId);
    const lessonProgress = await database.all('SELECT * FROM lesson_progress WHERE user_id = ?', victimId);

    expect(activities).toHaveLength(0);
    expect(lessonProgress).toHaveLength(0);
  });
});
