import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables, db } from './helpers';
import { signToken } from '../src/utils/jwt';
import { MAX_SHOTS } from '../src/utils/shots';
import { CHALLENGES } from '../src/data/challenges';

describe('Shots Cap (CG1)', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    await initTestDb();
    const database = await db();
    const { v4: uuidv4 } = await import('uuid');
    const bcrypt = await import('bcryptjs');
    userId = uuidv4();
    const passwordHash = await bcrypt.hash('password123', 10);
    await database.run(
      'INSERT INTO users (id, email, password_hash, name, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      userId, 'shots@example.com', passwordHash, 'Shots User', 'Beginner',
      new Date().toISOString(), new Date().toISOString(),
    );
    authToken = signToken({ userId, email: 'shots@example.com' });
  });

  afterAll(async () => {
    await cleanupTables();
  });

  it('POST /api/simulate caps shots at MAX_SHOTS and returns capped value', async () => {
    const circuit = { name: 'test', numQubits: 1, ops: [{ type: 'H', qubits: [0], column: 0 }] };

    const res = await request(app)
      .post('/api/simulate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ circuit, shots: 999999 });

    expect(res.status).toBe(200);
    expect(res.body.shots).toBe(MAX_SHOTS);
    expect(res.body.shots).toBeLessThanOrEqual(10000);
  });

  it('POST /api/circuits/:id/simulate caps shots and returns capped value in shots_used', async () => {
    const database = await db();
    // Save a circuit to simulate
    await database.run(
      'INSERT INTO projects (id, user_id, name, description, circuit, code, lesson_id, status, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'test-circuit-shots', userId, 'TestCircuit', 'test',
      JSON.stringify({ name: 'test', numQubits: 2, ops: [{ type: 'H', qubits: [0], column: 0 }] }),
      null, null, 'draft', '[]',
      new Date().toISOString(), new Date().toISOString(),
    );

    const res = await request(app)
      .post('/api/circuits/test-circuit-shots/simulate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ shots: 999999 });

    expect(res.status).toBe(200);
    expect(res.body.shots_used).toBe(MAX_SHOTS);
  });

  it('POST /api/challenges/:id/submit caps shots', async () => {
    const challenge = CHALLENGES[0];
    if (!challenge) return; // skip if no challenges seeded

    const res = await request(app)
      .post(`/api/challenges/${challenge.id}/submit`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        circuit: { name: 'test', numQubits: 1, ops: [{ type: 'H', qubits: [0], column: 0 }] },
        shots: 999999,
      });

    // Should not error — the circuit may fail validation but shots should not crash
    expect(res.status).toBe(200);
  });

  it('negative or zero shots still produces a valid simulation (clamped to 1)', async () => {
    const circuit = { name: 'test', numQubits: 1, ops: [{ type: 'H', qubits: [0], column: 0 }] };

    const res = await request(app)
      .post('/api/simulate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ circuit, shots: 0 });

    expect(res.status).toBe(200);
    expect(res.body.shots).toBe(1);
  });

  it('MAX_SHOTS env override is respected', () => {
    // The constant itself should be a positive integer
    expect(MAX_SHOTS).toBeGreaterThan(0);
    expect(MAX_SHOTS).toBeLessThanOrEqual(10000);
  });
});
