import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables, db as getTestDb } from './helpers';
import { signToken } from '../src/utils/jwt';
import { CHALLENGES } from '../src/data/challenges';
import { v4 as uuidv4 } from 'uuid';

describe('Challenge routes', () => {
  let validToken: string;
  const testUserId = 'user-test-challenge';

  beforeAll(async () => {
    await initTestDb();
    // Ensure the test user exists
    const database = await getTestDb();
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('password123', 10);
    await database.run(
      'INSERT OR REPLACE INTO users (id, email, password_hash, name, level, xp, streak, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)',
      testUserId,
      'challenge@example.com',
      passwordHash,
      'Challenge Tester',
      'Beginner',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    validToken = signToken({ userId: testUserId, email: 'challenge@example.com' });
  });

  afterAll(async () => {
    await cleanupTables();
  });

  describe('GET /api/challenges (public)', () => {
    it('returns all challenges without auth', async () => {
      const res = await request(app).get('/api/challenges');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.challenges)).toBe(true);
      expect(res.body.challenges.length).toBeGreaterThan(0);
    });

    it('each challenge has required fields', async () => {
      const res = await request(app).get('/api/challenges');
      const challenge = res.body.challenges[0];
      expect(challenge).toHaveProperty('id');
      expect(challenge).toHaveProperty('title');
      expect(challenge).toHaveProperty('shots');
      expect(challenge).toHaveProperty('difficulty');
      expect(challenge).toHaveProperty('xp');
    });
  });

  describe('GET /api/challenges/:id (public)', () => {
    it('returns a single challenge by id', async () => {
      const challenge = CHALLENGES[0];
      const res = await request(app).get(`/api/challenges/${challenge.id}`);
      expect(res.status).toBe(200);
      expect(res.body.challenge.id).toBe(challenge.id);
      expect(res.body.challenge.title).toBe(challenge.title);
    });

    it('returns 404 for unknown challenge', async () => {
      const res = await request(app).get('/api/challenges/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('POST /api/challenges/:id/submit', () => {
    it('rejects unauthenticated submission', async () => {
      const challenge = CHALLENGES[0];
      const circuit = {
        name: 'test',
        numQubits: 1,
        ops: [{ type: 'X', qubits: [0], column: 0 }],
      };
      const res = await request(app)
        .post(`/api/challenges/${challenge.id}/submit`)
        .send({ circuit });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('rejects submission for unknown challenge', async () => {
      const circuit = {
        name: 'test',
        numQubits: 1,
        ops: [{ type: 'X', qubits: [0], column: 0 }],
      };
      const res = await request(app)
        .post('/api/challenges/nonexistent/submit')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ circuit });
      expect(res.status).toBe(404);
    });

    it('returns 400 when circuit is missing', async () => {
      const challenge = CHALLENGES[0];
      const res = await request(app)
        .post(`/api/challenges/${challenge.id}/submit`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Circuit is required');
    });

    it('passes the bit-flip challenge with an X gate (server-side simulation)', async () => {
      const challenge = CHALLENGES.find(c => c.id === 'challenge-bit-flip');
      expect(challenge).toBeDefined();

      const circuit = {
        name: 'Bit flip',
        numQubits: 1,
        ops: [{ type: 'X', qubits: [0], column: 0 }],
      };
      const res = await request(app)
        .post(`/api/challenges/${challenge!.id}/submit`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ circuit, shots: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.passed).toBe(true);
      expect(res.body.checks.length).toBeGreaterThan(0);
      expect(res.body.checks.every((c: { passed: boolean }) => c.passed)).toBe(true);
      expect(res.body.xpAwarded).toBe(challenge!.xp);
    });

    it('fails the bit-flip challenge when no gate is applied (empty circuit)', async () => {
      const challenge = CHALLENGES.find(c => c.id === 'challenge-bit-flip');

      const circuit = {
        name: 'Empty',
        numQubits: 1,
        ops: [],
      };
      const res = await request(app)
        .post(`/api/challenges/${challenge!.id}/submit`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ circuit, shots: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.passed).toBe(false);
      expect(res.body.xpAwarded).toBe(0);
    });

    it('fails the bit-flip challenge with an H gate (produces 50/50, not |1⟩)', async () => {
      const challenge = CHALLENGES.find(c => c.id === 'challenge-bit-flip');

      const circuit = {
        name: 'Wrong gate',
        numQubits: 1,
        ops: [{ type: 'H', qubits: [0], column: 0 }],
      };
      const res = await request(app)
        .post(`/api/challenges/${challenge!.id}/submit`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ circuit, shots: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.passed).toBe(false);
      const checks = res.body.checks as { id: string; passed: boolean; detail: string }[];
      const resultCheck = checks.find(c => c.id === 'result');
      expect(resultCheck?.passed).toBe(false);
    });

    it('passes the bell-state challenge with H + CNOT (server-side verification of entanglement)', async () => {
      const challenge = CHALLENGES.find(c => c.id === 'challenge-bell-state');
      expect(challenge).toBeDefined();

      // CNOT control = q0, target = q1 → qubits: [1, 0] per the wire convention
      const circuit = {
        name: 'Bell',
        numQubits: 2,
        ops: [
          { type: 'H', qubits: [0], column: 0 },
          { type: 'CNOT', qubits: [1, 0], column: 1 },
        ],
      };
      const res = await request(app)
        .post(`/api/challenges/${challenge!.id}/submit`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ circuit, shots: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.passed).toBe(true);

      const checks = res.body.checks as { id: string; passed: boolean; detail: string }[];
      const correlation = checks.find(c => c.id === 'correlation');
      const balance = checks.find(c => c.id === 'balance');
      const entangled = checks.find(c => c.id === 'entangled');
      expect(correlation?.passed).toBe(true);
      expect(balance?.passed).toBe(true);
      expect(entangled?.passed).toBe(true);
    });

    it('rejects a spoofed passed=true in the request body', async () => {
      // This test confirms the server does NOT trust a client-supplied "passed" flag.
      const challenge = CHALLENGES.find(c => c.id === 'challenge-bit-flip');

      // A circuit with no gate — should fail, even if we try to lie about passing.
      const circuit = {
        name: 'Spoof attempt',
        numQubits: 1,
        ops: [],
      };
      const res = await request(app)
        .post(`/api/challenges/${challenge!.id}/submit`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ circuit, shots: 1000, passed: true });

      expect(res.status).toBe(200);
      expect(res.body.passed).toBe(false);
      expect(res.body.xpAwarded).toBe(0);
    });

    it('rejects an invalid circuit with unknown gate types', async () => {
      const challenge = CHALLENGES.find(c => c.id === 'challenge-bit-flip');

      const circuit = {
        name: 'Bad gate',
        numQubits: 1,
        ops: [{ type: 'UNKNOWN_GATE', qubits: [0], column: 0 }],
      };
      const res = await request(app)
        .post(`/api/challenges/${challenge!.id}/submit`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ circuit });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid circuit');
    });

    it('awards XP only once for the same challenge (idempotent)', async () => {
      // Use a fresh user so the XP ledger doesn't already have this challenge
      const database = await getTestDb();
      const bcrypt = await import('bcryptjs');
      const freshUserId = 'user-idempotent-test';
      const passwordHash = await bcrypt.hash('password123', 10);
      await database.run(
        'INSERT OR REPLACE INTO users (id, email, password_hash, name, level, xp, streak, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)',
        freshUserId,
        'idempotent@example.com',
        passwordHash,
        'Idempotent Test',
        'Beginner',
        new Date().toISOString(),
        new Date().toISOString(),
      );
      const freshToken = signToken({ userId: freshUserId, email: 'idempotent@example.com' });

      const challenge = CHALLENGES.find(c => c.id === 'challenge-bit-flip')!;
      const circuit = {
        name: 'Bit flip',
        numQubits: 1,
        ops: [{ type: 'X', qubits: [0], column: 0 }],
      };

      // First submission — should award XP
      const res1 = await request(app)
        .post(`/api/challenges/${challenge.id}/submit`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ circuit, shots: 1000 });

      expect(res1.status).toBe(200);
      expect(res1.body.passed).toBe(true);
      expect(res1.body.xpAwarded).toBe(challenge.xp);

      // Second submission — should NOT re-award XP (ledger UNIQUE constraint prevents it)
      const res2 = await request(app)
        .post(`/api/challenges/${challenge.id}/submit`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ circuit, shots: 1000 });

      expect(res2.status).toBe(200);
      expect(res2.body.passed).toBe(true);
      expect(res2.body.xpAwarded).toBe(0);
    });

    // CG2 tests
    it('GET /api/challenges strips solutionCode from public payloads', async () => {
      const res = await request(app).get('/api/challenges');
      expect(res.status).toBe(200);
      for (const c of res.body.challenges) {
        expect(c).not.toHaveProperty('solutionCode');
      }
    });

    it('GET /api/challenges/:id strips solutionCode from public payload', async () => {
      const challenge = CHALLENGES[0];
      const res = await request(app).get(`/api/challenges/${challenge.id}`);
      expect(res.status).toBe(200);
      expect(res.body.challenge).not.toHaveProperty('solutionCode');
      // But all public fields are present
      expect(res.body.challenge.id).toBe(challenge.id);
      expect(res.body.challenge.title).toBe(challenge.title);
    });

    it('stores real xp_awarded in challenge_attempts on pass, 0 on fail and re-pass', async () => {
      const database = await getTestDb();
      const freshUserId = 'user-cg2-test';
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('password123', 10);
      await database.run(
        'INSERT OR REPLACE INTO users (id, email, password_hash, name, level, xp, streak, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)',
        freshUserId, 'cg2@example.com', passwordHash, 'CG2 Test', 'Beginner',
        new Date().toISOString(), new Date().toISOString(),
      );
      const freshToken = signToken({ userId: freshUserId, email: 'cg2@example.com' });

      const challenge = CHALLENGES.find(c => c.id === 'challenge-bit-flip')!;
      const passingCircuit = {
        name: 'Bit flip',
        numQubits: 1,
        ops: [{ type: 'X', qubits: [0], column: 0 }],
      };
      const failingCircuit = {
        name: 'Empty',
        numQubits: 1,
        ops: [],
      };

      // 1. First pass — should store challenge.xp in xp_awarded
      const res1 = await request(app)
        .post(`/api/challenges/${challenge.id}/submit`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ circuit: passingCircuit, shots: 1000 });

      expect(res1.status).toBe(200);
      expect(res1.body.passed).toBe(true);
      expect(res1.body.xpAwarded).toBe(challenge.xp);

      // Verify in DB
      const attempt = await database.get(
        'SELECT xp_awarded FROM challenge_attempts WHERE user_id = ? AND challenge_id = ? ORDER BY attempted_at DESC LIMIT 1',
        freshUserId, challenge.id
      );
      expect(attempt.xp_awarded).toBe(challenge.xp);

      // 2. Re-pass (idempotent) — xp_awarded should be 0 in both response and DB
      const res2 = await request(app)
        .post(`/api/challenges/${challenge.id}/submit`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ circuit: passingCircuit, shots: 1000 });

      expect(res2.status).toBe(200);
      expect(res2.body.xpAwarded).toBe(0);

      const attempt2 = await database.get(
        'SELECT xp_awarded FROM challenge_attempts WHERE user_id = ? AND challenge_id = ? ORDER BY attempted_at DESC LIMIT 1',
        freshUserId, challenge.id
      );
      expect(attempt2.xp_awarded).toBe(0);

      // 3. Fail — xp_awarded should be 0 in both response and DB
      const res3 = await request(app)
        .post(`/api/challenges/${challenge.id}/submit`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ circuit: failingCircuit, shots: 1000 });

      expect(res3.status).toBe(200);
      expect(res3.body.passed).toBe(false);
      expect(res3.body.xpAwarded).toBe(0);

      const attempt3 = await database.get(
        'SELECT xp_awarded FROM challenge_attempts WHERE user_id = ? AND challenge_id = ? ORDER BY attempted_at DESC LIMIT 1',
        freshUserId, challenge.id
      );
      expect(attempt3.xp_awarded).toBe(0);
    });

    it('produces deterministic results with a fixed seed', async () => {
      const challenge = CHALLENGES.find(c => c.id === 'challenge-superposition')!;

      // H gate on q0 → 50/50 superposition — should pass regardless
      const circuit = {
        name: 'Superposition',
        numQubits: 1,
        ops: [
          { type: 'H', qubits: [0], column: 0 },
          { type: 'M', qubits: [0], column: 1 },
        ],
      };

      // Run twice with the same seed
      const res1 = await request(app)
        .post(`/api/challenges/${challenge.id}/submit`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ circuit, shots: 1000, seed: 42 });

      const res2 = await request(app)
        .post(`/api/challenges/${challenge.id}/submit`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ circuit, shots: 1000, seed: 42 });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.passed).toBe(res2.body.passed);
    });
  });
});
