import { Router, type Request, type Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getUser } from '../middleware/auth';
import { awardXp } from '../rewards';
import { LESSONS } from '../data/lessons';

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
 * Unpack the rich lesson metadata stored as JSON in the `description` column.
 * Topic rows (which have a plain-string description) pass through with empty meta.
 */
interface LessonMeta {
  summary?: string;
  concept?: unknown;
  objectives?: string[];
  prerequisites?: string[];
  xp?: number;
  video?: unknown;
  visualization?: unknown;
  aiPrompts?: unknown;
  interactive?: unknown;
  example?: unknown;
  quizIds?: string[];
  challengeId?: string;
  nextLessonId?: string | null;
  icon?: string;
}

function unpackLesson(row: Lesson): Lesson & LessonMeta {
  let meta: LessonMeta = {};
  try {
    if (typeof row.description === 'string' && row.description.startsWith('{')) {
      meta = JSON.parse(row.description) as LessonMeta;
    }
  } catch {
    meta = {};
  }
  return { ...row, ...meta };
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

  // List all lessons (exclude topic rows — those are just category headers)
  router.get('/', async (_req: Request, res: Response) => {
    const db = await getDb();
    const lessons = await db.all<Lesson[]>(
      'SELECT * FROM lessons WHERE id NOT LIKE \'topic-%\' ORDER BY `order` ASC'
    );
    // Unpack each lesson's JSON metadata and merge with the table row
    res.json(lessons.map(unpackLesson));
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
      lesson: { ...unpackLesson(lesson), concepts },
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
      // CG4: A lesson is 'completed' only when ALL SIX engagement flags are set.
      // Previously status='completed' used a 5-flag condition while completed_at
      // used a 6-flag condition, allowing a lesson to be marked completed without
      // a completion timestamp. Both now require the full 6-flag set for consistency.
      //
      // Note: SQLite CASE expressions in an UPDATE use the ORIGINAL row values,
      // not the newly-assigned SET values. So we read the current flags first,
      // compute the isCompleted result in JS, and pass it as a parameter.
      const allFlags = ['concept_read', 'video_watched', 'interactive_done', 'simulation_run', 'tutor_asked', 'challenge_passed'];
      const current = await db.get<Record<string, number>>(
        'SELECT concept_read, video_watched, interactive_done, simulation_run, tutor_asked, challenge_passed FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
        user.id, id
      );
      const isCompleted = allFlags.every(f => {
        const val = current?.[f];
        return f === action ? true : Boolean(val);
      });

      await db.run(
        `UPDATE lesson_progress
         SET ${action} = 1,
             status = ?,
             completed_at = CASE WHEN ? = 1 THEN ? ELSE completed_at END,
             last_visited_at = ?,
             updated_at = ?
         WHERE user_id = ? AND lesson_id = ?`,
        isCompleted ? 'completed' : 'in-progress',
        isCompleted ? 1 : 0,
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

    // If the lesson just transitioned to 'completed', award XP
    if (updated?.status === 'completed' && existing?.status !== 'completed') {
      const lesson = LESSONS.find(l => l.id === id);
      if (lesson) {
        const result = await awardXp(user.id, {
          amount: lesson.xp,
          reason: `Lesson complete: ${lesson.title}`,
          sourceType: 'lesson_complete',
          sourceId: id as string,
        });
        res.json({ progress: updated, xpAwarded: lesson.xp, ...result });
        return;
      }
    }

    res.json({ progress: updated });
  });

  return router;
}
