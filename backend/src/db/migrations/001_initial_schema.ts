/**
 * Migration 001: Initial schema
 *
 * This migration creates the base schema from the original initializeDatabase
 * logic. It is applied before any CREATE TABLE statements run, so subsequent
 * migrations can build on it with ALTER TABLE, new indexes, etc.
 */
import type { Database as SqliteDatabase } from 'sqlite';

export async function up(db: SqliteDatabase): Promise<void> {
  // Users table — stores credentials hash and profile
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      level TEXT DEFAULT 'Beginner',
      xp INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      last_active_date TEXT,
      created_at TEXT DEFAULT (datetime('now', 'utc')),
      updated_at TEXT DEFAULT (datetime('now', 'utc'))
    )
  `);

  // Sessions table — JWT tokens for session persistence
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Lesson progress table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      status TEXT DEFAULT 'not-started',
      concept_read BOOLEAN DEFAULT 0,
      video_watched BOOLEAN DEFAULT 0,
      interactive_done BOOLEAN DEFAULT 0,
      simulation_run BOOLEAN DEFAULT 0,
      tutor_asked BOOLEAN DEFAULT 0,
      challenge_passed BOOLEAN DEFAULT 0,
      quiz_correct INTEGER DEFAULT 0,
      quiz_total INTEGER DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      last_visited_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'utc')),
      updated_at TEXT DEFAULT (datetime('now', 'utc')),
      UNIQUE(user_id, lesson_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Quiz attempts table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quiz_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      selected_index INTEGER NOT NULL,
      correct BOOLEAN NOT NULL,
      attempted_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Challenge attempts table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS challenge_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      challenge_id TEXT NOT NULL,
      passed BOOLEAN NOT NULL,
      checks TEXT NOT NULL,
      xp_awarded INTEGER DEFAULT 0,
      attempted_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Projects table — saved circuits
  await db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      circuit TEXT NOT NULL,
      code TEXT,
      lesson_id TEXT,
      status TEXT DEFAULT 'draft',
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // User activities table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      user_id TEXT PRIMARY KEY,
      simulations INTEGER DEFAULT 0,
      lessons_completed INTEGER DEFAULT 0,
      quizzes_taken INTEGER DEFAULT 0,
      challenges_passed INTEGER DEFAULT 0,
      active_days TEXT,
      last_active_at TEXT,
      total_shots INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // XP ledger — append-only record of every XP award.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS xp_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT,
      created_at TEXT DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (user_id, source_type, source_id)
    )
  `);

  // User achievements
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at TEXT NOT NULL,
      xp_bonus INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, achievement_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tutor messages table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tutor_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      context_summary TEXT,
      action TEXT,
      follow_ups TEXT,
      source TEXT NOT NULL,
      pending BOOLEAN DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // User settings table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      settings TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // User snapshots — stores the full client-side state for sync
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_snapshots (
      user_id TEXT PRIMARY KEY,
      snapshot TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Lessons table (for content)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      category TEXT,
      duration TEXT,
      difficulty TEXT
    )
  `);

  // Concepts table (lesson sub-content)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);

  // Quizzes table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      lesson_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now', 'utc'))
    )
  `);

  // Quiz questions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_index INTEGER NOT NULL,
      explanation TEXT,
      "order" INTEGER NOT NULL,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    )
  `);

  // Lesson circuits table (predefined circuits for lessons)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_circuits (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL,
      circuit TEXT NOT NULL,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);

  // Challenges table — reference data seeded from CHALLENGES array
  await db.exec(`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      title TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      xp INTEGER NOT NULL,
      brief TEXT NOT NULL,
      objectives TEXT NOT NULL,
      hints TEXT NOT NULL,
      shots INTEGER NOT NULL,
      starter_circuit TEXT NOT NULL,
      expected_outcome TEXT,
      solution_code TEXT,
      created_at TEXT DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);

  // Challenge objectives table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS challenge_objectives (
      challenge_id TEXT NOT NULL,
      "index" INTEGER NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (challenge_id, "index"),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  `);

  // Challenge hints table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS challenge_hints (
      challenge_id TEXT NOT NULL,
      "index" INTEGER NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (challenge_id, "index"),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  `);
}

export async function down(db: SqliteDatabase): Promise<void> {
  await db.exec(`DROP TABLE IF EXISTS challenge_hints`);
  await db.exec(`DROP TABLE IF EXISTS challenge_objectives`);
  await db.exec(`DROP TABLE IF EXISTS challenges`);
  await db.exec(`DROP TABLE IF EXISTS lesson_circuits`);
  await db.exec(`DROP TABLE IF EXISTS quiz_questions`);
  await db.exec(`DROP TABLE IF EXISTS quizzes`);
  await db.exec(`DROP TABLE IF EXISTS concepts`);
  await db.exec(`DROP TABLE IF EXISTS lessons`);
  await db.exec(`DROP TABLE IF EXISTS user_snapshots`);
  await db.exec(`DROP TABLE IF EXISTS user_settings`);
  await db.exec(`DROP TABLE IF EXISTS tutor_messages`);
  await db.exec(`DROP TABLE IF EXISTS user_achievements`);
  await db.exec(`DROP TABLE IF EXISTS xp_ledger`);
  await db.exec(`DROP TABLE IF EXISTS activities`);
  await db.exec(`DROP TABLE IF EXISTS projects`);
  await db.exec(`DROP TABLE IF EXISTS challenge_attempts`);
  await db.exec(`DROP TABLE IF EXISTS quiz_attempts`);
  await db.exec(`DROP TABLE IF EXISTS lesson_progress`);
  await db.exec(`DROP TABLE IF EXISTS sessions`);
  await db.exec(`DROP TABLE IF EXISTS users`);
}
