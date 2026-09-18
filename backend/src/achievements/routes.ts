import { Router, type Request, type Response } from 'express';
import { getUser } from '../middleware/auth';
import { ACHIEVEMENTS, getUserProgress } from '../rewards';
import { QUIZZES } from '../data/quizzes';

/**
 * Register achievement-related routes.
 *
 * Routes:
 * - GET /api/achievements — list all achievement definitions
 * - GET /api/progress — user's XP, level, streak, and unlocked achievements
 */
export function registerAchievementRoutes(): Router {
  const router = Router();

  // List all achievement definitions (public — no auth required, same as frontend data)
  router.get('/', (_req: Request, res: Response) => {
    res.json({
      achievements: ACHIEVEMENTS.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        xpBonus: a.xpBonus,
      })),
    });
  });

  // Get user progress (XP, level, streak, achievements)
  router.get('/progress', async (req: Request, res: Response) => {
    const user = getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const progress = await getUserProgress(user.id);
      res.json(progress);
    } catch (error) {
      console.error('Progress fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch progress' });
    }
  });

  return router;
}
