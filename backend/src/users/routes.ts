import { Router, type Request, type Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getUser } from '../middleware/auth';

/**
 * Register user state routes.
 *
 * These endpoints are mounted at both /state and /progress (see routes.ts).
 * They provide user activity tracking, saved circuits, and progress data.
 *
 * Routes:
 * - GET  / — user state summary (activities + recent circuits)
 * - POST /circuits/:id — save circuit progress
 * - GET  /progress/lesson/:id — get lesson progress
 * - GET  /progress/quiz/:id — get quiz progress
 */
export function registerStateRoutes(): Router {
  const router = Router();

  // GET /state — user state summary (session-scoped)
  router.get('/', async (req: Request, res: Response) => {
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const db = await getDb();

    // Get user info
    const dbUser = await db.get('SELECT * FROM users WHERE id = ?', user.id);

    // Get activities (create default if none exists)
    let activities = await db.get(
      'SELECT * FROM activities WHERE user_id = ?',
      user.id
    );

    if (!activities) {
      await db.run(
        `INSERT INTO activities (user_id, simulations, lessons_completed, quizzes_taken, challenges_passed, active_days, last_active_at, total_shots, updated_at)
         VALUES (?, 0, 0, 0, 0, ?, ?, 0, ?)`,
        user.id,
        JSON.stringify([]),
        new Date().toISOString(),
        new Date().toISOString()
      );
      activities = await db.get('SELECT * FROM activities WHERE user_id = ?', user.id);
    }

    // Get recent projects
    const recentCircuits = await db.all(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT 10',
      user.id
    );

    res.json({
      user: dbUser ? {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        level: dbUser.level,
      } : null,
      activities,
      circuits: recentCircuits,
    });
  });

  // PUT /state — replace the persisted snapshot (client-driven full sync)
  router.put('/', async (req: Request, res: Response) => {
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const snapshot = req.body;
    const db = await getDb();
    const now = new Date().toISOString();

    try {
      // Store the full snapshot as a single row per user
      await db.run(
        `INSERT INTO user_snapshots (user_id, snapshot, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET snapshot = excluded.snapshot, updated_at = excluded.updated_at`,
        user.id,
        JSON.stringify(snapshot),
        now,
      );

      // Update activity timestamp
      await db.run(
        `UPDATE activities SET last_active_at = ?, updated_at = ? WHERE user_id = ?`,
        now,
        now,
        user.id,
      );

      res.json({ success: true });
    } catch (error) {
      // Create snapshot table on first use
      await db.exec(`
        CREATE TABLE IF NOT EXISTS user_snapshots (
          user_id TEXT PRIMARY KEY,
          snapshot TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      await db.run(
        `INSERT OR REPLACE INTO user_snapshots (user_id, snapshot, updated_at) VALUES (?, ?, ?)`,
        user.id,
        JSON.stringify(snapshot),
        now,
      );

      await db.run(
        `UPDATE activities SET last_active_at = ?, updated_at = ? WHERE user_id = ?`,
        now,
        now,
        user.id,
      );

      res.json({ success: true });
    }
  });

  // DELETE /state — clear all persisted state for the user
  router.delete('/', async (req: Request, res: Response) => {
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const db = await getDb();

    // Clear user snapshot
    await db.run(`DELETE FROM user_snapshots WHERE user_id = ?`, user.id);

    // Clear quiz attempts, challenge attempts, lesson progress
    await db.run(`DELETE FROM quiz_attempts WHERE user_id = ?`, user.id);
    await db.run(`DELETE FROM challenge_attempts WHERE user_id = ?`, user.id);
    await db.run(`DELETE FROM lesson_progress WHERE user_id = ?`, user.id);

    // Reset activity counters
    await db.run(
      `UPDATE activities SET simulations = 0, lessons_completed = 0, quizzes_taken = 0, challenges_passed = 0, total_shots = 0, updated_at = ? WHERE user_id = ?`,
      new Date().toISOString(),
      user.id,
    );

    res.json({ success: true });
  });

  // Save circuit progress
  router.post('/circuits/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { circuit, simulation_result, notes } = req.body;
    const db = await getDb();

    try {
      const now = new Date().toISOString();

      // Update or create project
      const existing = await db.get(
        'SELECT * FROM projects WHERE id = ? AND user_id = ?',
        id,
        user.id
      );

      if (existing) {
        await db.run(
          `UPDATE projects SET circuit = ?, code = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
          JSON.stringify(circuit),
          notes ?? existing.code,
          now,
          id,
          user.id,
        );
      } else {
        const { v4: uuidv4 } = await import('uuid');
        await db.run(
          `INSERT INTO projects (id, user_id, name, description, circuit, code, lesson_id, status, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          uuidv4(),
          user.id,
          req.body.name || 'Untitled Circuit',
          req.body.description || '',
          JSON.stringify(circuit),
          notes ?? null,
          req.body.lesson_id ?? null,
          'saved',
          JSON.stringify(req.body.tags ?? []),
          now,
          now
        );
      }

      // Update activities — increment simulations if this was a simulation
      if (simulation_result) {
        await db.run(
          `UPDATE activities
           SET simulations = simulations + 1,
               total_shots = total_shots + ?,
               last_active_at = ?,
               updated_at = ?
           WHERE user_id = ?`,
          simulation_result.shots_used || 0,
          now,
          now,
          user.id
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Save circuit error:', error);
      res.status(500).json({ error: 'Failed to save circuit' });
    }
  });

  // Get lesson progress
  router.get('/progress/lesson/:id', async (req: Request, res: Response) => {
    const { id: lessonId } = req.params;
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const db = await getDb();

    const progress = await db.get(
      'SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      user.id,
      lessonId
    );

    if (!progress) {
      res.status(404).json({ error: 'No progress found' });
      return;
    }

    res.json({ progress });
  });

  // Get quiz progress
  router.get('/progress/quiz/:id', async (req: Request, res: Response) => {
    const { id: quizId } = req.params;
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const db = await getDb();

    const attempts = await db.all(
      'SELECT * FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? ORDER BY attempted_at ASC',
      user.id,
      quizId
    );

    res.json({ attempts });
  });

  return router;
}
