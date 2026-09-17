import { Router, type Request, type Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getUser } from '../middleware/auth';

export interface Lesson {
  id: string;
  title: string;
  description: string;
  order: number;
  category: string;
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  concepts: Concept[];
  quiz_id: string | null;
  challenge_id: string | null;
}

export interface Concept {
  id: string;
  lesson_id: string;
  title: string;
  content: string;
  order: number;
}

export interface LessonProgress {
  user_id: string;
  lesson_id: string;
  status: 'not-started' | 'in-progress' | 'completed';
  concept_read: boolean;
  video_watched: boolean;
  interactive_done: boolean;
  simulation_run: boolean;
  tutor_asked: boolean;
  challenge_passed: boolean;
  quiz_correct: number;
  quiz_total: number;
  started_at: string | null;
  completed_at: string | null;
  last_visited_at: string | null;
}

/**
 * Register lesson-related routes.
 *
 * Routes:
 * - GET /lessons — list all lessons
 * - GET /lessons/:id — fetch a single lesson with concepts
 * - POST /lessons/:id/progress — update lesson progress
 */
export function registerLessonRoutes(): Router {
  const router = Router();

  // List all lessons
  router.get('/', async (_req: Request, res: Response) => {
    const db = await getDb();
    const lessons = await db.all<Lesson[]>(
      'SELECT * FROM lessons ORDER BY `order` ASC'
    );
    // Return a plain array to match the frontend's Lesson[] contract
    res.json(lessons);
  });

  // Get a single lesson with concepts
  router.get('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const db = await getDb();

    const lesson = await db.get<Lesson & { concepts?: Concept[] }>(
      `SELECT * FROM lessons WHERE id = ?`,
      id
    );

    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    const concepts = await db.all<Concept[]>(
      'SELECT * FROM concepts WHERE lesson_id = ? ORDER BY `order` ASC',
      id
    );

    // Fetch progress if it exists
    const progress = await db.get<LessonProgress>(
      'SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      user.id,
      id
    );

    res.json({
      lesson: { ...lesson, concepts },
      progress: progress ?? null,
    });
  });

  // Update lesson progress
  router.post('/:id/progress', async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { action } = req.body;
    const db = await getDb();

    const validActions = [
      'concept_read',
      'video_watched',
      'interactive_done',
      'simulation_run',
      'tutor_asked',
      'challenge_passed',
    ] as const;

    if (!action || !validActions.includes(action as any)) {
      res.status(400).json({ error: 'Invalid or missing action' });
      return;
    }

    const now = new Date().toISOString();
    const existing = await db.get<LessonProgress>(
      'SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      user.id,
      id
    );

    if (!existing) {
      // Create initial progress
      const progressId = uuidv4();
      await db.run(
        `INSERT INTO lesson_progress (
          id, user_id, lesson_id, status, started_at, last_visited_at,
          concept_read, video_watched, interactive_done, simulation_run,
          tutor_asked, challenge_passed, created_at, updated_at
        ) VALUES (?, ?, ?, 'in-progress', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        progressId,
        user.id,
        id,
        now,
        now,
        action === 'concept_read' ? 1 : 0,
        action === 'video_watched' ? 1 : 0,
        action === 'interactive_done' ? 1 : 0,
        action === 'simulation_run' ? 1 : 0,
        action === 'tutor_asked' ? 1 : 0,
        action === 'challenge_passed' ? 1 : 0,
        now,
        now
      );
    } else {
      // Update existing progress
      await db.run(
        `UPDATE lesson_progress
         SET ${action} = 1,
             status = CASE
               WHEN concept_read AND video_watched AND interactive_done AND simulation_run AND tutor_asked THEN 'completed'
               ELSE 'in-progress'
             END,
             completed_at = CASE
               WHEN concept_read AND video_watched AND interactive_done AND simulation_run AND tutor_asked AND challenge_passed THEN ?
               ELSE completed_at
             END,
             last_visited_at = ?,
             updated_at = ?
         WHERE user_id = ? AND lesson_id = ?`,
        now,
        now,
        now,
        user.id,
        id
      );
    }

    // Return updated progress
    const updated = await db.get<LessonProgress>(
      'SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      user.id,
      id
    );

    res.json({ progress: updated });
  });

  return router;
}
