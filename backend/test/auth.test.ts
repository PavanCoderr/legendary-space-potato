import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables } from './helpers';
import { signToken, verifyToken } from '../src/utils/jwt';

describe('Authentication', () => {
  let authToken: string;
  let userId: string;
  const testEmail = 'test@example.com';
  const testPassword = 'correct-horse-battery-staple';

  beforeAll(async () => {
    await initTestDb();
  });

  afterAll(async () => {
    await cleanupTables();
  });

  it('should reject signup with missing email', async () => {
    const res = await request(app).post('/api/signup').send({
      password: testPassword,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Email and password are required');
  });

  it('should reject signup with missing password', async () => {
    const res = await request(app).post('/api/signup').send({
      email: testEmail,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Email and password are required');
  });

  it('should reject signup with invalid email format', async () => {
    const res = await request(app).post('/api/signup').send({
      email: 'not-an-email',
      password: testPassword,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid email format');
  });

  it('should successfully sign up a new user', async () => {
    const res = await request(app).post('/api/signup').send({
      email: testEmail,
      password: testPassword,
      name: 'Test User',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.name).toBe('Test User');
    expect(res.body.token).toBeDefined();
    expect(verifyToken(res.body.token)?.userId).toBeDefined();
    authToken = res.body.token;
  });

  it('should reject duplicate signup', async () => {
    const res = await request(app).post('/api/signup').send({
      email: testEmail,
      password: testPassword,
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('User already exists');
  });

  it('should reject login with wrong password', async () => {
    const res = await request(app).post('/api/login').send({
      email: testEmail,
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid credentials');
  });

  it('should reject login for non-existent user', async () => {
    const res = await request(app).post('/api/login').send({
      email: 'nonexistent@example.com',
      password: testPassword,
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid credentials');
  });

  it('should successfully login', async () => {
    const res = await request(app).post('/api/login').send({
      email: testEmail,
      password: testPassword,
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
    userId = res.body.user.id;
  });

  it('should access session endpoint with valid token', async () => {
    const res = await request(app)
      .get('/api/session')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
  });

  it('should reject session endpoint without token', async () => {
    const res = await request(app).get('/api/session');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Authentication required');
  });

  it('should reject session endpoint with invalid token', async () => {
    const res = await request(app)
      .get('/api/session')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });

  it('should successfully logout', async () => {
    const res = await request(app)
      .post('/api/logout')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject logout without authentication', async () => {
    const res = await request(app).post('/api/logout');
    expect(res.status).toBe(401);
  });
});

describe('JWT Token Verification', () => {
  it('should sign and verify a token', () => {
    const payload = { userId: 'test-id-123', email: 'verify@example.com' };
    const token = signToken(payload);
    const verified = verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('test-id-123');
    expect(verified?.email).toBe('verify@example.com');
  });

  it('should reject an invalid token', () => {
    const verified = verifyToken('not-a-valid-token');
    expect(verified).toBeNull();
  });
});
