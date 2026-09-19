import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables, db } from './helpers';
import { signToken } from '../src/utils/jwt';

describe('Learning Progress', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await initTestDb();

    const database = await db();
    // Create a test user directly
    const { v4: uuidv4 } = await import('uuid');
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('password123', 10);
    testUserId = uuidv4();
    await database.run(
      'INSERT INTO users (id, email, password_hash, name, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      testUserId,
      'progress@example.com',
      passwordHash,
      'Progress User',
      'Beginner',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    authToken = signToken({ userId: testUserId, email: 'progress@example.com' });

    // Create default activity record
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

  it('should list all lessons', async () => {
    const res = await request(app)
      .get('/api/lessons')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    // Check that actual lessons are included
    const lessonIds = res.body.map((l: any) => l.id);
    expect(lessonIds).toContain('qubits');
    expect(lessonIds).toContain('superposition');
    expect(lessonIds).toContain('entanglement');
    expect(lessonIds).toContain('gates');
    expect(lessonIds).toContain('algorithms');
  });

  it('should list lessons without authentication', async () => {
    const res = await request(app).get('/api/lessons');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });

  it('should get a lesson with concepts', async () => {
    const res = await request(app)
      .get('/api/lessons/qubits')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.lesson).toBeDefined();
    expect(res.body.lesson.id).toBe('qubits');
    expect(res.body.lesson.title).toBe('Qubits');
    expect(res.body.lesson.concepts).toBeInstanceOf(Array);
    expect(res.body.lesson.concepts.length).toBeGreaterThan(0);
  });

  it('should return 404 for non-existent lesson', async () => {
    const res = await request(app)
      .get('/api/lessons/nonexistent')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Lesson not found');
  });

  it('should reject getting lesson without auth', async () => {
    const res = await request(app).get('/api/lessons/qubits');
    expect(res.status).toBe(401);
  });

  it('should track lesson progress for concept_read', async () => {
    const res = await request(app)
      .post('/api/lessons/qubits/progress')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'concept_read' });

    expect(res.status).toBe(200);
    expect(res.body.progress.lesson_id).toBe('qubits');
    expect(res.body.progress.concept_read).toBe(1);
  });

  it('should track lesson progress for video_watched', async () => {
    const res = await request(app)
      .post('/api/lessons/qubits/progress')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'video_watched' });

    expect(res.status).toBe(200);
    expect(res.body.progress.video_watched).toBe(1);
  });

  it('should update status to completed when all steps done', async () => {
    // Complete all progress steps for qubits lesson
    for (const action of ['concept_read', 'video_watched', 'interactive_done', 'simulation_run', 'tutor_asked']) {
      await request(app)
        .post('/api/lessons/qubits/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action });
    }

    // Complete the challenge
    await request(app)
      .post('/api/lessons/qubits/progress')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'challenge_passed' });

    const res = await request(app)
      .get('/state/progress/lesson/qubits')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.progress.status).toBe('completed');
    expect(res.body.progress.status).toBe('completed');
  });

  it('should reject progress update without auth', async () => {
    const res = await request(app)
      .post('/api/lessons/qubits/progress')
      .send({ action: 'concept_read' });
    expect(res.status).toBe(401);
  });

  it('should reject invalid action', async () => {
    const res = await request(app)
      .post('/api/lessons/qubits/progress')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'invalid_action' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid or missing action');
  });
});
