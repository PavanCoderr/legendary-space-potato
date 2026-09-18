import Database from 'sqlite3';
import { open, type Database as SqliteDatabase } from 'sqlite';
import path from 'node:path';
import fs from 'node:fs';

// Re-export the Database type for use in data access modules
export type { SqliteDatabase };

// Use a persistent file-based database for real state persistence.
// DATABASE_URL is used as a file path for SQLite. On Railway, mount a persistent
// volume and set DATABASE_URL to the volume path (e.g., /data/qubitverse.db).
const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'qubitverse.db');

let dbInstance: SqliteDatabase | null = null;

export async function getDb(): Promise<SqliteDatabase> {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = await open({
    filename: DB_PATH,
    driver: Database.Database,
  });
  // Enable foreign key enforcement — SQLite does not do this by default.
  await dbInstance.exec('PRAGMA foreign_keys = ON');
  return dbInstance;
}

/**
 * Minimal migrations for existing databases.
 *
 * SQLite's CREATE TABLE IF NOT EXISTS won't add new columns to an existing table,
 * so we inspect the schema and add columns that are missing. This is a one-shot
 * idempotent check — running it on a fresh DB is a no-op.
 */
async function migrateDatabase(db: SqliteDatabase): Promise<void> {
  // Add xp and streak columns to users table if they don't exist
  const userCols = await db.all('PRAGMA table_info(users)');
  const userColNames = userCols.map((c: any) => c.name);

  if (!userColNames.includes('xp')) {
    await db.exec('ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0');
    console.log('[db] Migration: added xp column to users');
  }
  if (!userColNames.includes('streak')) {
    await db.exec('ALTER TABLE users ADD COLUMN streak INTEGER DEFAULT 0');
    console.log('[db] Migration: added streak column to users');
  }

  // The xp_ledger and user_achievements tables are created by CREATE TABLE IF NOT EXISTS
  // in initializeDatabase, which runs after this migration. So just make sure they exist.
  if (!userColNames.includes('xp')) {
    // Columns were just added, the tables below still need creating
  }
}

/** For tests: close and reset the singleton instance so it can be reopened fresh. */
export async function resetDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDb();

  // Run any schema migrations needed for existing databases
  await migrateDatabase(db);

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

  // XP ledger — append-only record of every XP award
  await db.exec(`
    CREATE TABLE IF NOT EXISTS xp_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT,
      created_at TEXT DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // User achievements — tracks which achievements a user has unlocked
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

  // Lessons table (for content)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      \`order\` INTEGER NOT NULL,
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
      \`order\` INTEGER NOT NULL,
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
      \`order\` INTEGER NOT NULL,
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

  console.log('[db] Database initialized');
}
