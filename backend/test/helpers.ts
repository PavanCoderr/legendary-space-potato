import { initializeDatabase, getDb, resetDb } from '../src/db';
import { seedDatabase } from '../src/db/seed';

/** Initialize a fresh database with schema and seed data for test usage. */
export async function initTestDb(): Promise<void> {
  await resetDb();
  await initializeDatabase();
  await seedDatabase();
}

/** Get a reference to the active test database. */
export async function db() {
  return getDb();
}

/** Delete all data from tables that might have cross-test contamination. */
export async function cleanupTables(): Promise<void> {
  const database = await getDb();
  const tables = [
    'tutor_messages',
    'quiz_attempts',
    'challenge_attempts',
    'projects',
    'lesson_progress',
    'activities',
    'user_settings',
    'sessions',
    'quiz_questions',
    'quizzes',
    'challenge_objectives',
    'challenge_hints',
    'challenges',
    'concepts',
    'lesson_circuits',
    'lessons',
  ];
  for (const table of tables) {
    await database.run(`DELETE FROM ${table}`);
  }
}
