import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables } from './helpers';

/**
 * Bug reproduction tests:
 * Bug 1: Wrong password accepted during login
 * Bug 2: New account shows previous account's progress
 */
describe('Bug Reproduction Tests', () => {
  beforeAll(async () => {
    await initTestDb();
  });

  afterAll(async () => {
    await cleanupTables();
  });

  // Clear tables before each test to avoid cross-contamination
  beforeEach(async () => {
    const database = await (await import('./helpers')).db();
    try { await database.run('DELETE FROM user_snapshots'); } catch {}
    try { await database.run('DELETE FROM lesson_progress'); } catch {}
    await database.run('DELETE FROM activities');
    try { await database.run('DELETE FROM projects'); } catch {}
    try { await database.run('DELETE FROM quiz_attempts'); } catch {}
    try { await database.run('DELETE FROM challenge_attempts'); } catch {}
    await database.run('DELETE FROM users');
  });

  describe('Bug 1: Wrong password should be rejected on login', () => {
    it('Test A: Create user with password "correct123", then login with "wrongpassword" should FAIL', async () => {
      // Step 1: Create a user with password "correct123"
      const signupRes = await request(app).post('/api/signup').send({
        email: 'bug1user@example.com',
        password: 'correct123',
        name: 'Bug One User',
        level: 'Beginner',
      });
      expect(signupRes.status).toBe(201);
      expect(signupRes.body.user.email).toBe('bug1user@example.com');
      expect(signupRes.body.token).toBeDefined();

      // Step 2: Attempt login with WRONG password "wrongpassword"
      const loginRes = await request(app).post('/api/login').send({
        email: 'bug1user@example.com',
        password: 'wrongpassword',
      });

      // Step 3: Assert that login FAILS
      expect(loginRes.status).toBe(401);
      expect(loginRes.body.error).toContain('Invalid credentials');
    });
  });

  describe('Bug 2: New account should NOT see previous account progress', () => {
    it('Test B: User A completes lesson, User B should have empty progress', async () => {
      // Step 1: Create User A
      const userARes = await request(app).post('/api/signup').send({
        email: 'userA@example.com',
        password: 'passwordA123',
        name: 'User A',
        level: 'Beginner',
      });
      expect(userARes.status).toBe(201);
      const userAToken = userARes.body.token;
      const userAId = userARes.body.user.id;

      // Step 2: Mark a lesson complete for User A
      const progressRes = await request(app)
        .post('/api/lessons/qubits/progress')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ action: 'concept_read' });
      expect(progressRes.status).toBe(200);
      expect(progressRes.body.progress.lesson_id).toBe('qubits');

      // Also save state for User A (to populate user_snapshots)
      const snapshot = {
        version: 1,
        user: { id: userAId, name: 'User A', email: 'userA@example.com', xp: 100 },
        session: { signedIn: true, email: 'userA@example.com', level: 'Beginner', demo: false },
        progress: { qubits: { status: 'completed', conceptRead: true, videoWatched: true, interactiveDone: true, simulationRun: true, tutorAsked: true, challengePassed: true, quizCorrect: 1, quizTotal: 1, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), lastVisitedAt: new Date().toISOString() } },
        quizAttempts: [],
        challengeAttempts: [],
        achievements: ['first-steps'],
        projects: [],
        currentLessonId: 'qubits',
        currentCircuit: { name: 'test', numQubits: 1, ops: [] },
        settings: { shots: 1024, useFixedSeed: false, seed: 42, autoRunOnChange: true, theme: 'dark', aiProvider: { mode: 'local', baseUrl: '', model: '', apiKey: '', temperature: 0.7 } },
        activity: { simulations: 1, lessonsCompleted: 1, quizzesTaken: 0, challengesPassed: 1, activeDays: [], lastActiveAt: null, totalShots: 50 },
        tutorHistory: [],
      };

      const saveRes = await request(app)
        .put('/api/state')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(snapshot);
      expect(saveRes.status).toBe(200);

      // Verify User A has progress
      const userAStateRes = await request(app)
        .get('/api/state')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(userAStateRes.status).toBe(200);
      // User A should see their progress
      expect(userAStateRes.body.activities).toBeDefined();

      // Step 3: Create User B
      const userBRes = await request(app).post('/api/signup').send({
        email: 'userB@example.com',
        password: 'passwordB123',
        name: 'User B',
        level: 'Beginner',
      });
      expect(userBRes.status).toBe(201);
      const userBToken = userBRes.body.token;

      // Step 4: Fetch User B's progress — should be EMPTY, not User A's data
      const userBStateRes = await request(app)
        .get('/api/state')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(userBStateRes.status).toBe(200);

      // User B's activities should show zero progress
      expect(userBStateRes.body.activities).toBeDefined();
      expect(userBStateRes.body.activities.lessons_completed).toBe(0);
      expect(userBStateRes.body.activities.challenges_passed).toBe(0);

      // User B should have no circuits
      expect(userBStateRes.body.circuits).toEqual([]);
    });
  });
});
