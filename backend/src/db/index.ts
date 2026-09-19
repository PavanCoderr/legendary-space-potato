import Database from 'sqlite3';
import { open, type Database as SqliteDatabase } from 'sqlite';
import path from 'node:path';
import fs from 'node:fs';

// Re-export the Database type for use in data access modules
export type { SqliteDatabase };

// Determine migrations directory path.
// process.cwd() is used because __dirname is unavailable under ESM (tsx with
// "type": "module") and import.meta.url is unavailable under the CommonJS
// module setting in tsconfig.json. When running tests (vitest), cwd() is
// the backend root, so src/db/migrations is correct.
const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'db', 'migrations');

/**
 * Minimal migrations system:
 * - Each migration is a file in `backend/src/db/migrations/` named `NNN_description.ts`
 * - Each exports `up(db)` and optional `down(db)`
 * - Applied migrations are recorded in a `schema_migrations` table
 * - Migrations run in numeric order, skipping already-applied ones
 */
interface Migration {
  version: number;
  description: string;
  up: (db: SqliteDatabase) => Promise<void>;
  down?: (db: SqliteDatabase) => Promise<void>;
}

/**
 * Load all migration files from the migrations directory and return them
 * sorted by version number.
 */
async function loadMigrations(): Promise<Migration[]> {
  const migrations: Migration[] = [];

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return migrations;
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort();

  for (const file of files) {
    const match = file.match(/^(\d+)_(.+)(?:\.ts|\.js)$/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    const description = match[2];

    const fullPath = path.join(MIGRATIONS_DIR, file);
    // Use dynamic import to support both ESM (.ts via tsx) and compiled (.js)
    const mod = await import(fullPath);
    migrations.push({
      version,
      description,
      up: mod.up,
      down: mod.down,
    });
  }

  return migrations.sort((a, b) => a.version - b.version);
}

/**
 * Run all pending migrations.
 */
export async function runMigrations(db: SqliteDatabase): Promise<void> {
  // Create the schema_migrations table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
  `);

  // Get already-applied migration versions
  const applied = await db
    .all('SELECT version FROM schema_migrations ORDER BY version')
    .then((rows: any[]) => rows.map((r) => r.version));

  const migrations = await loadMigrations();

  for (const migration of migrations) {
    if (applied.includes(migration.version)) {
      continue; // Skip already-applied migrations
    }

    console.log(`[db] Migration ${String(migration.version).padStart(3, '0')}: ${migration.description}`);
    await migration.up(db);

    await db.run('INSERT INTO schema_migrations (version, description) VALUES (?, ?)', migration.version, migration.description);
    console.log(`[db] Migration ${String(migration.version).padStart(3, '0')} applied`);
  }
}

/**
 * Rollback a specific migration by version.
 */
export async function rollbackMigration(db: SqliteDatabase, version: number): Promise<void> {
  const migrations = await loadMigrations();
  const migration = migrations.find((m) => m.version === version);

  if (!migration) {
    throw new Error(`Migration not found: ${version}`);
  }

  if (!migration.down) {
    throw new Error(`Migration ${version} has no down function`);
  }

  console.log(`[db] Rolling back migration ${String(version).padStart(3, '0')}: ${migration.description}`);
  await migration.down(db);
  await db.run('DELETE FROM schema_migrations WHERE version = ?', version);
  console.log(`[db] Migration ${String(version).padStart(3, '0')} rolled back`);
}

/**
 * Get the current migration status.
 */
export async function getMigrationStatus(db: SqliteDatabase): Promise<{
  applied: number[];
  pending: { version: number; description: string }[];
}> {
  const appliedRows = await db.all('SELECT version FROM schema_migrations ORDER BY version');
  const appliedVersions = appliedRows.map((r: any) => r.version);

  const migrations = await loadMigrations();
  const pending = migrations
    .filter((m) => !appliedVersions.includes(m.version))
    .map((m) => ({ version: m.version, description: m.description }));

  return { applied: appliedVersions, pending };
}

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

/**
 * Initialize the database:
 * 1. Run pending migrations (handles legacy DBs needing ALTER TABLE / index fixes)
 * 2. Ensure all tables exist (CREATE TABLE IF NOT EXISTS — idempotent, safe for tests
 *    that drop and recreate tables)
 * 3. Ensure the xp_ledger UNIQUE index exists with dedup (always runs, handles legacy)
 */
export async function initializeDatabase(): Promise<void> {
  const db = await getDb();

  // Step 1: Run migrations for legacy databases
  await runMigrations(db);

  // Step 2: Ensure all core tables exist (idempotent — CREATE TABLE IF NOT EXISTS)
  // This mirrors the schema defined in migration 001 but runs on every
  // initializeDatabase call so it is safe for tests that drop tables.
  await ensureTablesExist(db);

  // Step 3: Ensure xp_ledger has its UNIQUE index (with dedup for legacy data)
  await ensureXpLedgerIntegrity(db);

  console.log('[db] Database initialized');
}

/**
 * Ensure all core tables exist. Uses CREATE TABLE IF NOT EXISTS so it is
 * idempotent — safe to call multiple times even after tables are dropped.
 * Schema mirrors migration 001 for the table definitions.
 */
async function ensureTablesExist(db: SqliteDatabase): Promise<void> {
  // schema_migrations table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
  `);

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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      settings TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_snapshots (
      user_id TEXT PRIMARY KEY,
      snapshot TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      lesson_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now', 'utc'))
    )
  `);

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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_circuits (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL,
      circuit TEXT NOT NULL,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);

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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS challenge_objectives (
      challenge_id TEXT NOT NULL,
      "index" INTEGER NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (challenge_id, "index"),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS challenge_hints (
      challenge_id TEXT NOT NULL,
      "index" INTEGER NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (challenge_id, "index"),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  `);

  // Gllossary table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS glossary (
      term TEXT PRIMARY KEY,
      definition TEXT NOT NULL
    )
  `);
}

/**
 * Ensure xp_ledger has the UNIQUE constraint on (user_id, source_type, source_id).
 * On fresh DBs this is enforced inline by CREATE TABLE above. On legacy databases
 * that predate the constraint, we deduplicate existing rows and add the index.
 */
async function ensureXpLedgerIntegrity(db: SqliteDatabase): Promise<void> {
  const hasLedger = await db.all(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'xp_ledger'",
  );

  if (hasLedger.length > 0) {
    // Deduplicate rows — the old code grouped by the wrong columns, which could let duplicates survive
    await db.exec(`
      DELETE FROM xp_ledger
      WHERE rowid NOT IN (
        SELECT MIN(rowid) FROM xp_ledger
        GROUP BY user_id, source_type, source_id
      )
    `);

    await db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_ledger_unique
       ON xp_ledger (user_id, source_type, source_id)`,
    );
  }
}
