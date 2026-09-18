import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables } from './helpers';
import { signToken } from '../src/utils/jwt';
import { createCircuit, type QuantumCircuit } from '../src/quantum/circuit';
import { simulate } from '../src/quantum/simulator';

describe('Quantum Simulator', () => {
  let authToken: string;

  beforeAll(async () => {
    await initTestDb();
    const { v4: uuidv4 } = await import('uuid');
    const bcrypt = await import('bcryptjs');
    const database = await import('../src/db').then(m => m.getDb);
    const db = await database();
    const passwordHash = await bcrypt.hash('password123', 10);
    await db.run(
      'INSERT INTO users (id, email, password_hash, name, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      uuidv4(),
      'quantum@example.com',
      passwordHash,
      'Quantum User',
      'Beginner',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    authToken = signToken({ userId: 'test-quantum', email: 'quantum@example.com' });
  });

  afterAll(async () => {
    await cleanupTables();
  });

  describe('State Vector Unit Tests', () => {
    it('X gate: X|0⟩ = |1⟩', () => {
      const circuit = createCircuit('X on |0>', 1, [
        { id: 'op1', type: 'X', qubits: [0], column: 0 },
        { id: 'op2', type: 'M', qubits: [0], column: 1 },
      ]);

      const result = simulate(circuit, { shots: 1000, random: () => 0.5 });

      // P(|1⟩) should be 1
      expect(result.probabilities[1].probability).toBeCloseTo(1, 10);
      expect(result.probabilities[0].probability).toBeCloseTo(0, 10);

      // All measurement outcomes should be |1⟩
      const count11 = result.measurement.buckets.find(b => b.label === '|1⟩');
      expect(count11?.count).toBe(1000);
    });

    it('H gate: H|0⟩ = 50/50 superposition', () => {
      const circuit = createCircuit('H on |0>', 1, [
        { id: 'op1', type: 'H', qubits: [0], column: 0 },
        { id: 'op2', type: 'M', qubits: [0], column: 1 },
      ]);

      const result = simulate(circuit, { shots: 1000 });

      // Both probabilities should be 0.5
      expect(result.probabilities[0].probability).toBeCloseTo(0.5, 10);
      expect(result.probabilities[1].probability).toBeCloseTo(0.5, 10);

      // Bloch vector should be on +X axis (z ≈ 0, x ≈ 1)
      expect(result.bloch[0].x).toBeCloseTo(1, 5);
      expect(result.bloch[0].z).toBeCloseTo(0, 5);
    });

    it('H followed by H returns to |0⟩', () => {
      const circuit = createCircuit('HH', 1, [
        { id: 'op1', type: 'H', qubits: [0], column: 0 },
        { id: 'op2', type: 'H', qubits: [0], column: 1 },
        { id: 'op3', type: 'M', qubits: [0], column: 2 },
      ]);

      const result = simulate(circuit, { shots: 100 });

      // P(|0⟩) should be 1
      expect(result.probabilities[0].probability).toBeCloseTo(1, 5);
    });

    it('X followed by X returns to |0⟩', () => {
      const circuit = createCircuit('XX', 1, [
        { id: 'op1', type: 'X', qubits: [0], column: 0 },
        { id: 'op2', type: 'X', qubits: [0], column: 1 },
        { id: 'op3', type: 'M', qubits: [0], column: 2 },
      ]);

      const result = simulate(circuit, { shots: 100 });

      expect(result.probabilities[0].probability).toBeCloseTo(1, 5);
    });

    it('H then Z then H equals X (HZH = X)', () => {
      const circuit = createCircuit('HZH', 1, [
        { id: 'op1', type: 'H', qubits: [0], column: 0 },
        { id: 'op2', type: 'Z', qubits: [0], column: 1 },
        { id: 'op3', type: 'H', qubits: [0], column: 2 },
        { id: 'op4', type: 'M', qubits: [0], column: 3 },
      ]);

      const result = simulate(circuit, { shots: 100 });

      // Should be |1⟩ with certainty (HZH = X, and X|0⟩ = |1⟩)
      expect(result.probabilities[1].probability).toBeCloseTo(1, 5);
    });

    it('Y gate: Y|0⟩ = i|1⟩', () => {
      const circuit = createCircuit('Y on |0>', 1, [
        { id: 'op1', type: 'Y', qubits: [0], column: 0 },
      ]);

      const result = simulate(circuit);

      // P(|1⟩) should be 1
      expect(result.probabilities[1].probability).toBeCloseTo(1, 5);
    });

    it('S gate: adds phase to |1⟩', () => {
      const circuit = createCircuit('S gate', 1, [
        { id: 'op1', type: 'H', qubits: [0], column: 0 },
        { id: 'op2', type: 'S', qubits: [0], column: 1 },
      ]);

      const result = simulate(circuit);

      // S leaves probabilities unchanged but rotates phase
      // H|0⟩ = (|0⟩ + |1⟩)/√2, S adds π/2 to |1⟩ phase
      expect(result.probabilities[0].probability).toBeCloseTo(0.5, 5);
      expect(result.probabilities[1].probability).toBeCloseTo(0.5, 5);
      // Amplitude of |1⟩ should have imaginary component ≈ 1/√2
      expect(result.amplitudes[1].imag).toBeCloseTo(Math.SQRT1_2, 5);
    });

    it('T gate: adds π/4 phase to |1⟩', () => {
      const circuit = createCircuit('T gate', 1, [
        { id: 'op1', type: 'T', qubits: [0], column: 0 },
      ]);

      const result = simulate(circuit);

      // T on |0⟩: |0⟩ is an eigenstate, so T|0⟩ = |0⟩ (up to global phase)
      expect(result.probabilities[0].probability).toBeCloseTo(1, 5);
    });

    describe('Bell State (2 qubits)', () => {
      it('H + CNOT creates entangled Bell state', () => {
        // qubits[0] is target, qubits[1] is control per QubitVerse convention
        // For Bell state: H on q0, then CNOT with control=q0, target=q1 → qubits: [1, 0]
        const circuit = createCircuit('Bell', 2, [
          { id: 'op1', type: 'H', qubits: [0], column: 0 },
          { id: 'op2', type: 'CNOT', qubits: [1, 0], column: 1 },
        ]);

        const result = simulate(circuit, { shots: 1000, random: () => 0.3 });

        // Only |00⟩ and |11⟩ should have non-zero probability
        expect(result.probabilities[0b00].probability).toBeCloseTo(0.5, 5);
        expect(result.probabilities[0b11].probability).toBeCloseTo(0.5, 5);
        expect(result.probabilities[0b01].probability).toBeCloseTo(0, 5);
        expect(result.probabilities[0b10].probability).toBeCloseTo(0, 5);

        // Both Bloch vectors should be mixed (entangled)
        expect(result.bloch[0].magnitude).toBeCloseTo(0, 2);
        expect(result.bloch[1].magnitude).toBeCloseTo(0, 2);
      });

      it('Bell state measurements produce only |00⟩ and |11⟩', () => {
        const circuit = createCircuit('Bell', 2, [
          { id: 'op1', type: 'H', qubits: [0], column: 0 },
          { id: 'op2', type: 'CNOT', qubits: [1, 0], column: 1 },
          { id: 'op3', type: 'M', qubits: [0], column: 2 },
          { id: 'op4', type: 'M', qubits: [1], column: 2 },
        ]);

        const result = simulate(circuit, { shots: 1000 });

        // Only |00⟩ and |11⟩ should appear
        const labels = result.measurement.buckets.map(b => b.label);
        const nonzeroBuckets = result.measurement.buckets.filter(b => b.count > 0);
        expect(nonzeroBuckets.length).toBe(2);
        expect(nonzeroBuckets.map(b => b.label).sort()).toEqual(['|00⟩', '|11⟩']);
      });
    });

    describe('Probability Normalization', () => {
      it('probabilities sum to 1 for single qubit', () => {
        const circuit = createCircuit('H', 1, [
          { id: 'op1', type: 'H', qubits: [0], column: 0 },
        ]);

        const result = simulate(circuit);

        const sum = result.probabilities.reduce((acc, p) => acc + p.probability, 0);
        expect(sum).toBeCloseTo(1, 10);
      });

      it('probabilities sum to 1 for two qubits', () => {
        const circuit = createCircuit('Bell', 2, [
          { id: 'op1', type: 'H', qubits: [0], column: 0 },
          { id: 'op2', type: 'H', qubits: [1], column: 0 },
        ]);

        const result = simulate(circuit);

        const sum = result.probabilities.reduce((acc, p) => acc + p.probability, 0);
        expect(sum).toBeCloseTo(1, 10);
      });
    });
  });

  describe('Simulator API Endpoint', () => {
    it('should simulate a circuit via API', async () => {
      const circuit = {
        name: 'Test Circuit',
        numQubits: 1,
        ops: [{ type: 'H', qubits: [0], column: 0 }, { type: 'M', qubits: [0], column: 1 }],
      };

      const res = await request(app)
        .post('/api/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ circuit, shots: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.numQubits).toBe(1);
      expect(res.body.shots).toBe(1000);
    });

    it('should reject simulation without auth', async () => {
      const res = await request(app)
        .post('/api/simulate')
        .send({ circuit: { name: 'test', numQubits: 1, ops: [] } });

      expect(res.status).toBe(401);
    });

    it('should reject simulation with missing circuit', async () => {
      const res = await request(app)
        .post('/api/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Circuit is required');
    });

    it('should support seeded PRNG for reproducibility', async () => {
      const circuit = {
        name: 'Seeded test',
        numQubits: 1,
        ops: [{ type: 'H', qubits: [0], column: 0 }, { type: 'M', qubits: [0], column: 1 }],
      };

      const res1 = await request(app)
        .post('/api/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ circuit, shots: 1000, seed: 42 });

      const res2 = await request(app)
        .post('/api/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ circuit, shots: 1000, seed: 42 });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      // With same seed, results should be identical
      expect(res1.body.measurement.buckets).toEqual(res2.body.measurement.buckets);
    });

    it('should reject invalid circuits', async () => {
      // A circuit with too many qubits exceeds MAX_QUBITS (8)
      const circuit = {
        name: 'Invalid',
        numQubits: 100,
        ops: [],
      };

      const res = await request(app)
        .post('/api/simulate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ circuit, shots: 100 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
