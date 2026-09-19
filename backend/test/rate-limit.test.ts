import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { initTestDb, cleanupTables } from './helpers';

// Set a low rate limit BEFORE importing the app, so the auth rate limiter
// uses this value instead of the test default (1000).
if (!process.env.AUTH_RATE_LIMIT_MAX) {
  vi.stubEnv('AUTH_RATE_LIMIT_MAX', '3');
}

const { app } = await import('../src/server');

describe('Rate Limiting', () => {
  beforeAll(async () => {
    await initTestDb();
  });

  afterAll(async () => {
    await cleanupTables();
    vi.unstubAllEnvs();
  });

  it('should return 429 after exceeding the login rate limit', async () => {
    // The auth rate limiter allows 3 requests per 15 min per IP (AUTH_RATE_LIMIT_MAX=3).
    // Make 4 requests with invalid credentials.
    const statuses: number[] = [];

    for (let i = 0; i < 4; i++) {
      const res = await request(app).post('/api/login').send({
        email: `rate-test-${i}@example.com`,
        password: 'wrong-password-123',
      });
      statuses.push(res.status);
    }

    // The first 3 should be 401 (bad credentials), the 4th should be 429 (rate limited)
    expect(statuses[0]).toBe(401);
    expect(statuses[1]).toBe(401);
    expect(statuses[2]).toBe(401);
    expect(statuses[3]).toBe(429);
  });

  it('should return JSON error on rate limit', async () => {
    const res = await request(app).post('/api/login').send({
      email: 'rate-test-again@example.com',
      password: 'wrong-password-123',
    });
    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Too many attempts');
  });
});
