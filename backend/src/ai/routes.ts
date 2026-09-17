import { Router, type Request, type Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getUser } from '../middleware/auth';
import { resolveProvider, type ChatMessage } from './provider';

export interface TutorContext {
  lessonId?: string;
  circuitState?: any;
  recentErrors?: string[];
}

export interface TutorResponse {
  text: string;
  action?: string;
  followUps?: string[];
  error?: string;
  provider?: string;
  model?: string;
}

/** Returns a singleton provider instance, so we don't recreate the client per-request. */
let cachedProvider: ReturnType<typeof resolveProvider> | null = null;
function getProvider() {
  if (!cachedProvider) cachedProvider = resolveProvider();
  return cachedProvider;
}

/**
 * Build the system prompt that teaches the model to act as a quantum computing tutor.
 */
function buildSystemPrompt(context?: TutorContext): string {
  const lines: string[] = [
    'You are the QubitVerse quantum computing tutor. Be concrete, beginner friendly and concise (max 200 words).',
    'Use the JSON context below, which describes exactly what the learner is looking at right now.',
    'Never invent measurement counts: only use the numbers in the context.',
    'If the learner made a mistake, name the gate and the wire.',
  ];

  if (context?.lessonId) {
    lines.push(`Lesson context: ${context.lessonId}`);
  }
  if (context?.recentErrors && context.recentErrors.length > 0) {
    lines.push(`Recent errors: ${JSON.stringify(context.recentErrors)}`);
  }

  return lines.join('\n');
}

/**
 * Generate a response from the quantum computing tutor using the configured AI provider.
 *
 * The provider is resolved from environment variables at startup — no API key is
 * ever exposed to the frontend. If no provider is configured, a stub answer is returned.
 */
async function generateTutorResponse(
  message: string,
  context?: TutorContext,
): Promise<TutorResponse> {
  const provider = getProvider();
  const systemPrompt = buildSystemPrompt(context);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ];

  try {
    const result = await provider.chat(messages, { temperature: 0.7, max_tokens: 4000 });
    const text = result.choices[0]?.message?.content ?? '';

    // For stub responses we can synthesize follow-ups
    const followUps =
      provider.name === 'Stub'
        ? [
            'Explain superposition in more detail',
            'Show me an example circuit',
            'How does this relate to quantum algorithms?',
          ]
        : undefined;

    return {
      text,
      action: 'explain',
      followUps,
      provider: result.provider,
      model: result.model,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Provider error — return a stub response so the chat keeps working
    console.error('AI provider error:', message);

    return {
      text: `I'm having trouble connecting to the AI provider right now (${message}). Let me help you with what I know about quantum computing:

- **Superposition** allows qubits to exist in multiple states simultaneously
- **Entanglement** creates correlations between qubits that enable quantum speedup
- **Interference** is used to amplify correct answers and cancel out wrong ones

What specific aspect would you like me to explain further?`,
      action: 'explain',
      followUps: [
        'Explain superposition in more detail',
        'Show me an example circuit',
        'How does this relate to quantum algorithms?',
      ],
      error: message,
    };
  }
}

/**
 * Register AI tutor routes.
 *
 * Routes:
 * - POST /ai/chat — send a message to the quantum tutor
 * - GET  /ai/history — get conversation history
 */
export function registerAiRoutes(): Router {
  const router = Router();

  // Chat with the AI tutor
  router.post('/chat', async (req: Request, res: Response) => {
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { message, context }: { message: string; context?: TutorContext } = req.body;
    const db = await getDb();

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    try {
      const now = new Date().toISOString();

      // Store user message
      await db.run(
        `INSERT INTO tutor_messages
         (id, user_id, role, text, context_summary, source, pending, created_at)
         VALUES (?, ?, 'user', ?, ?, 'chat', 0, ?)`,
        uuidv4(),
        user.id,
        message,
        context ? JSON.stringify(context) : null,
        now,
      );

      // Get AI response
      const response = await generateTutorResponse(message, context);

      // Store assistant response
      await db.run(
        `INSERT INTO tutor_messages
         (id, user_id, role, text, context_summary, action, follow_ups, source, pending, created_at)
         VALUES (?, ?, 'assistant', ?, ?, ?, ?, 'chat', 0, ?)`,
        uuidv4(),
        user.id,
        response.text,
        context ? JSON.stringify(context) : null,
        response.action ?? null,
        response.followUps ? JSON.stringify(response.followUps) : null,
        now,
      );

      // Update activity
      await db.run(
        'UPDATE activities SET last_active_at = ?, updated_at = ? WHERE user_id = ?',
        now,
        now,
        user.id,
      );

      res.json({
        response: response.text,
        action: response.action,
        followUps: response.followUps,
        provider: response.provider,
        model: response.model,
        ...(response.error ? { error: response.error } : {}),
      });
    } catch (error) {
      console.error('AI chat error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get tutor response',
      });
    }
  });

  // Explain action — used by the TutorPage explain button
  router.post('/explain', async (req: Request, res: Response) => {
    const user = getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const { prompt, action, context }: { prompt: string; action?: string; context?: TutorContext } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    try {
      const response = await generateTutorResponse(prompt, context ?? {});
      res.json({
        response: response.text,
        action: response.action,
        followUps: response.followUps,
        provider: response.provider,
        model: response.model,
        ...(response.error ? { error: response.error } : {}),
      });
    } catch (error) {
      console.error('AI explain error:', error);
      res.status(500).json({ success: false, error: 'Failed to get tutor response' });
    }
  });

  // Hint action — used by the TutorPage hint button
  router.post('/hint', async (req: Request, res: Response) => {
    const user = getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const { prompt, context }: { prompt: string; context?: TutorContext } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    try {
      const response = await generateTutorResponse(prompt, context ?? {});
      res.json({
        response: response.text,
        followUps: response.followUps,
        provider: response.provider,
        model: response.model,
        ...(response.error ? { error: response.error } : {}),
      });
    } catch (error) {
      console.error('AI hint error:', error);
      res.status(500).json({ success: false, error: 'Failed to get tutor response' });
    }
  });

  // Get conversation history
  router.get('/history', async (req: Request, res: Response) => {
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { lessonId } = req.query as { lessonId?: string };
    const db = await getDb();

    let messages;
    if (lessonId) {
      messages = await db.all(
        `SELECT * FROM tutor_messages
         WHERE user_id = ? AND context_summary LIKE ?
         ORDER BY created_at ASC
         LIMIT 100`,
        user.id,
        `%${lessonId}%`,
      );
    } else {
      messages = await db.all(
        'SELECT * FROM tutor_messages WHERE user_id = ? AND source = ? ORDER BY created_at ASC LIMIT 100',
        user.id,
        'chat',
      );
    }

    res.json({ messages });
  });

  return router;
}
