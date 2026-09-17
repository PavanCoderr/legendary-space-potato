import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { initTestDb, cleanupTables, db } from './helpers';
import { signToken } from '../src/utils/jwt';

describe('AI Provider', () => {
  let authToken: string;
  let testUserId: string;
  let savedOpenAI: string | undefined;
  let savedAnthropic: string | undefined;
  let savedOpenRouter: string | undefined;

  beforeAll(async () => {
    await initTestDb();

    // Save and clear AI keys so tests use the StubProvider
    savedOpenAI = process.env.OPENAI_API_KEY;
    savedAnthropic = process.env.ANTHROPIC_API_KEY;
    savedOpenRouter = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const database = await db();
    const { v4: uuidv4 } = await import('uuid');
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('password123', 10);
    testUserId = uuidv4();
    await database.run(
      'INSERT INTO users (id, email, password_hash, name, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      testUserId,
      'ai@example.com',
      passwordHash,
      'AI User',
      'Beginner',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    authToken = signToken({ userId: testUserId, email: 'ai@example.com' });

    // Create activity record for the AI user
    await database.run(
      'INSERT INTO activities (user_id, simulations, lessons_completed, quizzes_taken, challenges_passed, active_days, last_active_at, total_shots, updated_at) VALUES (?, 0, 0, 0, 0, ?, ?, 0, ?)',
      testUserId,
      JSON.stringify([]),
      new Date().toISOString(),
      new Date().toISOString(),
    );
  });

  afterAll(async () => {
    // Restore env vars
    if (savedOpenAI) process.env.OPENAI_API_KEY = savedOpenAI;
    if (savedAnthropic) process.env.ANTHROPIC_API_KEY = savedAnthropic;
    if (savedOpenRouter) process.env.OPENROUTER_API_KEY = savedOpenRouter;
    await cleanupTables();
  });

  it('should reject chat without auth', async () => {
    const res = await request(app).post('/api/ai/chat').send({ message: 'What is a qubit?' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('should reject chat with missing message', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Message is required');
  });

  it('should return a response to a valid chat message', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: 'What is a qubit?' });

    expect(res.status).toBe(200);
    expect(res.body.response).toBeDefined();
    expect(typeof res.body.response).toBe('string');
    expect(res.body.response.length).toBeGreaterThan(0);
  });

  it('should store conversation history', async () => {
    // Send a message
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: 'What is superposition?' });

    expect(res.status).toBe(200);

    // Retrieve history
    const historyRes = await request(app)
      .get('/api/ai/history')
      .set('Authorization', `Bearer ${authToken}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.messages).toBeInstanceOf(Array);
    expect(historyRes.body.messages.length).toBeGreaterThan(0);
  });

  it('should reject history without auth', async () => {
    const res = await request(app).get('/api/ai/history');
    expect(res.status).toBe(401);
  });

  it('should return stub response when no provider is configured', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: 'Tell me about quantum gates' });

    expect(res.status).toBe(200);
    // Stub provider returns text about superposition/entanglement
    expect(res.body.response).toContain('quantum computing');
  });
});

describe('AI Provider Abstraction', () => {
  // Direct unit tests for the provider module
  it('StubProvider returns a response', async () => {
    const { StubProvider } = await import('../src/ai/provider');
    const provider = new StubProvider();
    const result = await provider.chat([
      { role: 'system', content: 'You are a tutor.' },
      { role: 'user', content: 'Hello' },
    ]);

    expect(result.choices).toBeInstanceOf(Array);
    expect(result.choices.length).toBe(1);
    expect(result.choices[0].message.content.length).toBeGreaterThan(0);
    expect(result.provider).toBe('Stub');
  });

  it('resolveProvider returns StubProvider when no API key is set', async () => {
    // Save and clear env vars
    const savedOpenAI = process.env.OPENAI_API_KEY;
    const savedAnthropic = process.env.ANTHROPIC_API_KEY;
    const savedOpenRouter = process.env.OPENROUTER_API_KEY;

    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const { resolveProvider } = await import('../src/ai/provider');
    const provider = resolveProvider();
    expect(provider.name).toBe('Stub');

    // Restore env vars
    if (savedOpenAI) process.env.OPENAI_API_KEY = savedOpenAI;
    if (savedAnthropic) process.env.ANTHROPIC_API_KEY = savedAnthropic;
    if (savedOpenRouter) process.env.OPENROUTER_API_KEY = savedOpenRouter;
  });

  it('createProvider throws for OpenAI without API key', async () => {
    const { createProvider } = await import('../src/ai/provider');
    expect(() =>
      createProvider({ type: 'openai', apiKey: '', model: 'gpt-4' }),
    ).toThrow('OPENAI_API_KEY is required');
  });

  it('createProvider throws for Anthropic without API key', async () => {
    const { createProvider } = await import('../src/ai/provider');
    expect(() =>
      createProvider({ type: 'anthropic', apiKey: '', model: 'claude-3' }),
    ).toThrow('ANTHROPIC_API_KEY is required');
  });

  it('OpenAiCompatibleProvider throws on connection error', async () => {
    const { OpenAiCompatibleProvider } = await import('../src/ai/provider');
    const provider = new OpenAiCompatibleProvider({
      apiKey: 'test-key',
      model: 'gpt-4',
      baseUrl: 'http://invalid-url-that-does-not-exist',
    });

    // Should throw when trying to connect to an invalid endpoint
    await expect(
      provider.chat([{ role: 'user', content: 'Hello' }], { max_tokens: 10 }),
    ).rejects.toThrow();
  });
});
