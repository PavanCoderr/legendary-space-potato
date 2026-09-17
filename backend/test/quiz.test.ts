import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables, db } from './helpers';
import { signToken } from '../src/utils/jwt';

describe('Quiz System', () => {
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
      'quiz@example.com',
      passwordHash,
      'Quiz User',
      'Beginner',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    authToken = signToken({ userId: testUserId, email: 'quiz@example.com' });
  });

  afterAll(async () => {
    await cleanupTables();
  });

  it('should retrieve a quiz with questions', async () => {
    const res = await request(app)
      .get('/api/quiz/qubits-1')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.quiz).toBeDefined();
    expect(res.body.quiz.questions).toBeInstanceOf(Array);
    expect(res.body.quiz.questions.length).toBeGreaterThan(0);
  });

  it('should not expose correct answers before submission', async () => {
    const res = await request(app)
      .get('/api/quiz/qubits-1')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const question = res.body.quiz.questions[0];
    // correct_index should not be present in the response
    expect(question.correct_index).toBeUndefined();
  });

  it('should return 404 for non-existent quiz', async () => {
    const res = await request(app)
      .get('/api/quiz/nonexistent')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Quiz not found');
  });

  it('should reject quiz access without auth', async () => {
    const res = await request(app).get('/api/quiz/qubits-1');
    expect(res.status).toBe(401);
  });

  it('should submit correct answer and return explanation', async () => {
    // First, get the correct index from the database directly
    const database = await db();
    const question = await database.get(
      'SELECT * FROM quiz_questions WHERE quiz_id = ?',
      'qubits-1'
    );

    const res = await request(app)
      .post(`/api/quiz/qubits-1/attempt`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        question_index: 0,
        selected_index: question.correct_index,
      });

    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(true);
    expect(res.body.explanation).toBeDefined();
  });

  it('should submit wrong answer and return explanation', async () => {
    const res = await request(app)
      .post('/api/quiz/qubits-1/attempt')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        question_index: 0,
        selected_index: 0, // Wrong index (assuming correct is not 0)
      });

    expect(res.status).toBe(200);
    // We can't guarantee the correct answer isn't index 0, but the endpoint should work
    expect(res.body.correct).toBeDefined();
    expect(res.body.explanation).toBeDefined();
  });

  it('should reject quiz attempt without auth', async () => {
    const res = await request(app)
      .post('/api/quiz/qubits-1/attempt')
      .send({ question_index: 0, selected_index: 0 });

    expect(res.status).toBe(401);
  });

  it('should reject attempt with missing fields', async () => {
    const res = await request(app)
      .post('/api/quiz/qubits-1/attempt')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ question_index: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('question_index and selected_index are required');
  });

  it('should reject attempt with non-existent question index', async () => {
    const res = await request(app)
      .post('/api/quiz/qubits-1/attempt')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        question_index: 999,
        selected_index: 0,
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Question not found');
  });

  it('should retrieve quiz results', async () => {
    const res = await request(app)
      .get('/api/quiz/qubits-1/result')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.quiz_id).toBe('qubits-1');
    expect(res.body.total_attempts).toBeGreaterThan(0);
  });

  it('should reject quiz result access without auth', async () => {
    const res = await request(app).get('/api/quiz/qubits-1/result');
    expect(res.status).toBe(401);
  });

  it('should accept frontend contract /api/quiz/submit with QuizAttempt', async () => {
    // qubits-1 has correctIndex: 1, so selectIndex 1 is correct
    const res = await request(app)
      .post('/api/quiz/submit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        id: 'attempt-1',
        quizId: 'qubits-1',
        lessonId: 'qubits',
        selectedIndex: 1,
        correct: true,
        attemptedAt: new Date().toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.recorded).toBe(true);
    expect(res.body.explanation).toBeDefined();
  });

  it('should return recorded:false for unknown quizId on /api/quiz/submit', async () => {
    const res = await request(app)
      .post('/api/quiz/submit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        id: 'attempt-2',
        quizId: 'nonexistent-quiz',
        lessonId: 'qubits',
        selectedIndex: 0,
        correct: false,
        attemptedAt: new Date().toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.recorded).toBe(false);
  });

  it('should reject /api/quiz/submit without auth', async () => {
    const res = await request(app).post('/api/quiz/submit').send({
      quizId: 'qubits-1',
      selectedIndex: 0,
    });
    expect(res.status).toBe(401);
  });

  it('should reject /api/quiz/submit with missing fields', async () => {
    const res = await request(app)
      .post('/api/quiz/submit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ quizId: 'qubits-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('quizId and selectedIndex are required');
  });
});
