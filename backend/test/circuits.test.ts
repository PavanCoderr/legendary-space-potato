import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables, db } from './helpers';
import { signToken } from '../src/utils/jwt';

describe('Saved Circuits', () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    await initTestDb();

    const database = await db();
    const { v4: uuidv4 } = await import('uuid');
    const bcrypt = await import('bcryptjs');

    // Create two test users
    user1Id = uuidv4();
    user2Id = uuidv4();
    const passwordHash = await bcrypt.hash('password123', 10);

    await database.run(
      'INSERT INTO users (id, email, password_hash, name, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      user1Id, 'user1@example.com', passwordHash, 'User One', 'Beginner', new Date().toISOString(), new Date().toISOString(),
    );
    await database.run(
      'INSERT INTO users (id, email, password_hash, name, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      user2Id, 'user2@example.com', passwordHash, 'User Two', 'Beginner', new Date().toISOString(), new Date().toISOString(),
    );

    user1Token = signToken({ userId: user1Id, email: 'user1@example.com' });
    user2Token = signToken({ userId: user2Id, email: 'user2@example.com' });

    // Create activity records
    await database.run(
      'INSERT INTO activities (user_id, simulations, lessons_completed, quizzes_taken, challenges_passed, active_days, last_active_at, total_shots, updated_at) VALUES (?, 0, 0, 0, 0, ?, ?, 0, ?)',
      user1Id, JSON.stringify([]), new Date().toISOString(), new Date().toISOString(),
    );
    await database.run(
      'INSERT INTO activities (user_id, simulations, lessons_completed, quizzes_taken, challenges_passed, active_days, last_active_at, total_shots, updated_at) VALUES (?, 0, 0, 0, 0, ?, ?, 0, ?)',
      user2Id, JSON.stringify([]), new Date().toISOString(), new Date().toISOString(),
    );
  });

  afterAll(async () => {
    await cleanupTables();
  });

  it('should create a new circuit', async () => {
    const res = await request(app)
      .post('/api/circuits/save')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'My First Circuit',
        description: 'A test circuit',
        circuit: { name: 'test', numQubits: 2, ops: [{ type: 'H', qubits: [0], column: 0 }] },
        code: 'qc.h(0)',
        tags: ['beginner', 'test'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should reject circuit save without auth', async () => {
    const res = await request(app)
      .post('/api/circuits/save')
      .send({ name: 'test', circuit: { name: 'test', numQubits: 1, ops: [] } });
    expect(res.status).toBe(401);
  });

  it('should reject circuit save with missing fields', async () => {
    const res = await request(app)
      .post('/api/circuits/save')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Name and circuit are required');
  });

  it('should retrieve user state with saved circuits', async () => {
    const res = await request(app)
      .get('/state')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.circuits).toBeInstanceOf(Array);
    expect(res.body.circuits.length).toBeGreaterThan(0);
    expect(res.body.circuits[0].name).toBe('My First Circuit');
  });

  it('should save circuit progress via state endpoint', async () => {
    const circuitId = 'circuit-test-001';
    const res = await request(app)
      .post(`/state/circuits/${circuitId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        circuit: { name: 'state-circuit', numQubits: 1, ops: [{ type: 'X', qubits: [0], column: 0 }] },
        notes: 'This is a note',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should update existing circuit via state endpoint', async () => {
    const circuitId = 'circuit-test-001';
    const res = await request(app)
      .post(`/state/circuits/${circuitId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        circuit: { name: 'updated-circuit', numQubits: 1, ops: [{ type: 'H', qubits: [0], column: 0 }] },
        notes: 'Updated note',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should enforce ownership: user cannot see other user circuits', async () => {
    // User 1 creates a circuit
    const createRes = await request(app)
      .post('/api/circuits/save')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'Private Circuit',
        description: 'Only visible to user 1',
        circuit: { name: 'private', numQubits: 1, ops: [] },
      });
    expect(createRes.status).toBe(201);

    // User 2 retrieves their state - should not contain user 1's circuit
    const res = await request(app)
      .get('/state')
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(200);
    const circuitNames = res.body.circuits.map((c: any) => c.name);
    expect(circuitNames).not.toContain('Private Circuit');
    expect(circuitNames).not.toContain('My First Circuit');
  });

  it('should enforce ownership: user cannot update other user circuits', async () => {
    // User 1 creates a circuit
    const createRes = await request(app)
      .post('/api/circuits/save')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'Ownership Test Circuit',
        circuit: { name: 'ownership', numQubits: 1, ops: [] },
      });
    expect(createRes.status).toBe(201);

    // Get the circuit ID from user 1's state
    const stateRes = await request(app)
      .get('/state')
      .set('Authorization', `Bearer ${user1Token}`);

    const circuit = stateRes.body.circuits.find((c: any) => c.name === 'Ownership Test Circuit');
    expect(circuit).toBeDefined();

    // User 2 tries to update user 1's circuit via state endpoint
    // This should either fail with an error or create a separate entry
    // (it must NOT overwrite user 1's circuit)
    const res = await request(app)
      .post(`/state/circuits/${circuit.id}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        circuit: { name: 'hacked', numQubits: 1, ops: [] },
      });

    // The response should not indicate success modifying user 1's circuit
    // User 2 should not be able to overwrite user 1's circuit
    // Either it fails (403/500) or it creates a new entry for user 2 without touching user 1's
    if (res.status === 200) {
      // If it returned success, user 2 just created their own entry with the same ID
      // but user 1's circuit should be untouched
    }

    // Verify user 1's circuit was not modified
    const finalStateRes = await request(app)
      .get('/state')
      .set('Authorization', `Bearer ${user1Token}`);

    const userCircuit = finalStateRes.body.circuits.find((c: any) => c.id === circuit.id);
    expect(userCircuit).toBeDefined();
    expect(userCircuit.name).toBe('Ownership Test Circuit');
  });

  it('should reject ID manipulation: accessing non-existent circuit', async () => {
    const res = await request(app)
      .get('/api/circuits/nonexistent/simulate')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ shots: 100 });

    expect(res.status).toBe(404);
  });
});
