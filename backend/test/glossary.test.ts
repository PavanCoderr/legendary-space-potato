import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';

describe('Glossary API', () => {
  describe('GET /api/glossary', () => {
    it('should return all glossary entries', async () => {
      const res = await request(app).get('/api/glossary');
      expect(res.status).toBe(200);
      expect(res.body.glossary).toBeInstanceOf(Array);
      expect(res.body.glossary.length).toBeGreaterThan(0);

      // Check the shape of the first entry
      const first = res.body.glossary[0];
      expect(first).toHaveProperty('term');
      expect(first).toHaveProperty('aliases');
      expect(first).toHaveProperty('definition');
      expect(first).toHaveProperty('href');
      expect(first).toHaveProperty('lessonId');
    });

    it('should include known terms like Qubit and Hadamard gate', async () => {
      const res = await request(app).get('/api/glossary');
      const terms = res.body.glossary.map((e: any) => e.term);
      expect(terms).toContain('Qubit');
      expect(terms).toContain('Hadamard gate');
      expect(terms).toContain('CNOT');
      expect(terms).toContain("Grover's algorithm");
    });
  });

  describe('GET /api/glossary/:term', () => {
    it('should return a single entry by term', async () => {
      const res = await request(app).get('/api/glossary/Hadamard%20gate');
      expect(res.status).toBe(200);
      expect(res.body.entry.term).toBe('Hadamard gate');
      expect(res.body.entry.aliases).toContain('H gate');
      expect(res.body.entry.aliases).toContain('hadamard');
    });

    it('should match case-insensitively', async () => {
      const res = await request(app).get('/api/glossary/qubit');
      expect(res.status).toBe(200);
      expect(res.body.entry.term).toBe('Qubit');
    });

    it('should match by alias', async () => {
      const res = await request(app).get('/api/glossary/bit%20flip');
      expect(res.status).toBe(200);
      expect(res.body.entry.term).toBe('X gate');
    });

    it('should return 404 for unknown term', async () => {
      const res = await request(app).get('/api/glossary/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Glossary entry not found');
    });
  });
});
