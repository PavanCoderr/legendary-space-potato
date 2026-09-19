import express, { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { registerAuthRoutes } from './auth/routes';
import { registerCircuitRoutes } from './circuits/routes';
import { registerLessonRoutes } from './lessons/routes';
import { registerQuizRoutes } from './quizzes/routes';
import { registerStateRoutes } from './users/routes';
import { registerAiRoutes } from './ai/routes';
import { registerSimulateRoutes } from './simulator/routes';
import { registerGlossaryRoutes } from './glossary/routes';
import { registerChallengeRoutes } from './challenges/routes';
import { registerAchievementRoutes } from './achievements/routes';
import { authenticate, requireAuth } from './middleware/auth';

// Rate limit for AI endpoints — 30 requests per 15 min per user.
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  message: { error: 'Too many AI requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as any).user?.id ?? ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown'),
});

export function registerRoutes(app: express.Express): void {
  const api = Router();

  // Auth routes (no authentication required)
  registerAuthRoutes(api);

  // Public content routes (no authentication required — mirrors frontend data)
  api.use('/glossary', registerGlossaryRoutes());
  api.use('/achievements', registerAchievementRoutes());

  // Challenges: public GET endpoints serve seed data; the submit endpoint
  // enforces auth itself via getUser() so we only need authenticate on POST.
  api.use('/challenges', authenticate, registerChallengeRoutes());

  // Protected API routes — authenticate sets req.user (null if no/bad token);
  // each route handler enforces auth via getUser() so public endpoints like
  // GET /api/lessons can coexist with auth-gated endpoints like GET /:id.
  api.use('/lessons', authenticate, registerLessonRoutes());
  api.use('/simulate', authenticate, registerSimulateRoutes());
  api.use('/quiz', authenticate, registerQuizRoutes());
  api.use('/circuits', authenticate, registerCircuitRoutes());
  // AI routes: authenticated + rate-limited per user (C1)
  api.use('/ai', authenticate, aiRateLimiter, registerAiRoutes());

  // User state (session-scoped, requires auth)
  api.use('/state', authenticate, registerStateRoutes());
  api.use('/progress', authenticate, registerStateRoutes());

  app.use('/api', api);

  // Root-level /state for backwards compatibility with the documented contract
  app.use('/state', authenticate, registerStateRoutes());
}
