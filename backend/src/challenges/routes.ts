import { Router, type Request, type Response } from 'express';
import { getDb } from '../db';
import { getUser } from '../middleware/auth';

export interface ChallengeData {
  id: string;
  lesson_id: string;
  topic: string;
  title: string;
  difficulty: string;
  xp: number;
  brief: string;
  objectives: string;
  hints: string;
  shots: number;
  starter_circuit: string;
  expected_outcome: string | null;
  solution_code: string | null;
  created_at: string;
}

/**
 * Register challenge-related routes.
 *
 * Routes:
 * - GET /api/challenges — list all challenges
 * - GET /api/challenges/:id — fetch a single challenge
 */
export function registerChallengeRoutes(): Router {
  const router = Router();

  // List all challenges
  router.get('/', async (_req: Request, res: Response) => {
    const db = await getDb();
    const challenges = await db.all<ChallengeData[]>(
      'SELECT * FROM challenges ORDER BY id ASC'
    );
    // Parse JSON fields
    const parsed = challenges.map(c => ({
      ...c,
      objectives: typeof c.objectives === 'string' ? JSON.parse(c.objectives) : c.objectives,
      hints: typeof c.hints === 'string' ? JSON.parse(c.hints) : c.hints,
      starter_circuit: typeof c.starter_circuit === 'string' ? JSON.parse(c.starter_circuit) : c.starter_circuit,
    }));
    res.json({ challenges: parsed });
  });

  // Get a single challenge
  router.get('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const db = await getDb();

    const challenge = await db.get<ChallengeData>(
      'SELECT * FROM challenges WHERE id = ?',
      id
    );

    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    // Parse JSON fields
    const parsed = {
      ...challenge,
      objectives: typeof challenge.objectives === 'string' ? JSON.parse(challenge.objectives) : challenge.objectives,
      hints: typeof challenge.hints === 'string' ? JSON.parse(challenge.hints) : challenge.hints,
      starter_circuit: typeof challenge.starter_circuit === 'string' ? JSON.parse(challenge.starter_circuit) : challenge.starter_circuit,
    };

    res.json({ challenge: parsed });
  });

  return router;
}
