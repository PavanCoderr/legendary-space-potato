import express, { Router, type Request, type Response, type NextFunction } from 'express';
import { registerAuthRoutes } from './auth/routes';
import { registerCircuitRoutes } from './circuits/routes';
import { registerLessonRoutes } from './lessons/routes';
import { registerQuizRoutes } from './quizzes/routes';
import { registerStateRoutes } from './users/routes';
import { registerAiRoutes } from './ai/routes';
import { registerSimulateRoutes } from './simulator/routes';
import { authenticate } from './middleware/auth';

export function registerRoutes(app: express.Express): void {
  const api = Router();

  // Auth routes (no authentication required)
  registerAuthRoutes(api);

  // Protected API routes — all require a valid session
  api.use('/lessons', authenticate, registerLessonRoutes());
  api.use('/simulate', authenticate, registerSimulateRoutes());
  api.use('/quiz', authenticate, registerQuizRoutes());
  api.use('/circuits', authenticate, registerCircuitRoutes());
  api.use('/ai', authenticate, registerAiRoutes());

  // User state (session-scoped, requires auth)
  api.use('/state', authenticate, registerStateRoutes());
  api.use('/progress', authenticate, registerStateRoutes());

  app.use('/api', api);

  // Root-level /state for backwards compatibility with the documented contract
  app.use('/state', authenticate, registerStateRoutes());
}
