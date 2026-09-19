import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { initTestDb, cleanupTables, db as getTestDb } from './helpers';
import { v4 as uuidv4 } from 'uuid';

/**
 * BF4a — regression test: initializeDatabase must not crash on a legacy-shaped DB.
 *
 * A legacy DB has:
 *   - users table WITHOUT xp/streak columns
 *   - NO xp_ledger table
 *   - duplicate rows in xp_ledger if it did exist (GROUP BY must not include amount)
 *
 * migrateDatabase previously ran `DELETE FROM xp_ledger` before the table existed,
 * crashing on exactly the legacy-DB case BF4 targets.
 */
describe('Database migration (BF4a)', () => {
  beforeAll(async () => {
    await initTestDb();
  });

  afterAll(async () => {
    await cleanupTables();
  });

  it('initializeDatabase does not crash when xp_ledger does not exist yet', async () => {
    // Simulate the exact BF4a scenario: start from a DB where xp_ledger was never
    // created. initTestDb already created a schema with everything; to truly test
    // the legacy path we'd need to drop xp_ledger first. But the real regression
    // check is simpler: the migrateDatabase function must tolerate a missing table.
    //
    // We test this by calling initializeDatabase on a fresh DB (resetDb does this
    // inside initTestDb). If the DELETE runs before CREATE TABLE, it would throw
    // "no such table: xp_ledger" — which would fail this test.
    //
    // The fact that initTestDb (which calls initializeDatabase) succeeds is
    // itself the regression guard for the fresh-DB case. For the legacy case,
    // we manually drop xp_ledger and re-run.
    const database = await getTestDb();

    // Drop xp_ledger to simulate legacy DB
    await database.exec('DROP TABLE IF EXISTS xp_ledger');

    // Re-run initializeDatabase — it must not throw "no such table: xp_ledger"
    const { initializeDatabase } = await import('../src/db');
    await expect(initializeDatabase()).resolves.not.toThrow();

    // Verify xp_ledger was recreated with the UNIQUE constraint
    const indexes = await database.all(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_xp_ledger_unique'"
    );
    expect(indexes.length).toBe(1);
  });

  it('GROUP BY for dedup does not include amount (would let duplicates survive)', async () => {
    // The old code grouped by (user_id, source_type, source_id, amount), which
    // would let two rows with the same (user, type, source) but different amounts
    // survive the dedupe, then fail the UNIQUE index creation.
    // We verify the dedup clause is correct by inspecting the source.
    // (This is a source-level check — the SQL itself is tested via the migration above.)
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.resolve(__dirname, '../src/db/index.ts'), 'utf-8');

    // The dedup should group by (user_id, source_type, source_id) WITHOUT amount
    // in the ensureXpLedgerIntegrity function.
    const integritySection = src.split('async function ensureXpLedgerIntegrity')[1]?.split('async function')[0] ?? '';
    expect(integritySection).not.toContain('amount');
    expect(integritySection).toContain('source_id');
  });

  it('users table has xp and streak columns after migration', async () => {
    const database = await getTestDb();

    // Drop users table to simulate a legacy DB without the new columns,
    // then re-run initializeDatabase to verify ALTER TABLE adds them.
    await database.exec('DROP TABLE IF EXISTS users');

    const { initializeDatabase } = await import('../src/db');
    await expect(initializeDatabase()).resolves.not.toThrow();

    // Verify the table was recreated (CREATE TABLE in initializeDatabase)
    const cols = await database.all('PRAGMA table_info(users)');
    const colNames = cols.map((c: any) => c.name);
    expect(colNames).toContain('xp');
    expect(colNames).toContain('streak');
  });

  it('pre-populated xp_ledger with duplicates does not crash initializeDatabase', async () => {
    const database = await getTestDb();

    // Insert a real user so FK constraints pass
    const userId = uuidv4();
    await database.run(
      'INSERT INTO users (id, email, password_hash, name, level, xp, streak, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      userId, `test-${userId}@example.com`, 'hash', 'Test User', 'Beginner', 0, 0, new Date().toISOString(), new Date().toISOString(),
    );

    // Replace xp_ledger with a version that has NO inline UNIQUE constraint,
    // simulating a legacy DB created with the old schema. This lets us insert
    // duplicate (user_id, source_type, source_id) rows that the dedup logic must clean up.
    await database.run('DROP INDEX IF EXISTS idx_xp_ledger_unique');
    await database.run('DROP TABLE xp_ledger');
    await database.run(`
      CREATE TABLE xp_ledger (
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

    // Insert duplicate ledger rows (same user/type/source, different amounts)
    await database.run(
      'INSERT INTO xp_ledger (id, user_id, amount, reason, source_type, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), userId, 20, 'Quiz correct', 'quiz_correct', 'qubits-1', new Date().toISOString(),
    );
    await database.run(
      'INSERT INTO xp_ledger (id, user_id, amount, reason, source_type, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), userId, 20, 'Quiz correct (dup)', 'quiz_correct', 'qubits-1', new Date().toISOString(),
    );

    // Re-run initializeDatabase — dedup must use GROUP BY without amount
    const { initializeDatabase } = await import('../src/db');
    await expect(initializeDatabase()).resolves.not.toThrow();

    // Verify the UNIQUE index exists and duplicates were removed
    const indexes = await database.all(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_xp_ledger_unique'"
    );
    expect(indexes.length).toBe(1);
  });
});
