/**
 * Migration 002: Add last_active_date and streak columns to users table
 *
 * This migration adds columns needed for the XP/streak system.
 * On legacy databases created before this migration, these columns are
 * added via ALTER TABLE. New databases get them via the inline schema in
 * migration 001.
 */
import type { Database as SqliteDatabase } from 'sqlite';

export async function up(db: SqliteDatabase): Promise<void> {
  // Add columns needed for XP/streak system on legacy databases.
  // Fresh databases get these via inline schema in migration 001.
  // Only attempt ALTERs if the users table already exists.
  const cols = await db.all('PRAGMA table_info(users)');
  if (cols.length === 0) return; // users table doesn't exist yet — migration 001 handles it

  const existingCols = new Set(cols.map((c: any) => c.name));

  if (!existingCols.has('xp')) {
    await db.exec('ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0');
    console.log('[db] Migration 002: added xp column to users');
  }

  if (!existingCols.has('streak')) {
    await db.exec('ALTER TABLE users ADD COLUMN streak INTEGER DEFAULT 0');
    console.log('[db] Migration 002: added streak column to users');
  }

  if (!existingCols.has('last_active_date')) {
    await db.exec('ALTER TABLE users ADD COLUMN last_active_date TEXT');
    console.log('[db] Migration 002: added last_active_date column to users');
  }

  // Add the UNIQUE index on xp_ledger for pre-existing databases that were
  // created before the inline UNIQUE constraint was added.
  const hasLedger = await db.all(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'xp_ledger'",
  );

  if (hasLedger.length > 0) {
    // Deduplicate any existing duplicate rows first
    await db.exec(`
      DELETE FROM xp_ledger
      WHERE rowid NOT IN (
        SELECT MIN(rowid) FROM xp_ledger
        GROUP BY user_id, source_type, source_id
      )
    `);

    // Create the unique index (idempotent)
    await db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_ledger_unique
       ON xp_ledger (user_id, source_type, source_id)`,
    );
    console.log('[db] Migration 002: ensured UNIQUE index on xp_ledger');
  }
}

export async function down(db: SqliteDatabase): Promise<void> {
  // SQLite doesn't support DROP COLUMN in older versions, and we can't easily
  // reverse a column addition. Drop the index instead (it's recreated on re-up).
  await db.exec('DROP INDEX IF EXISTS idx_xp_ledger_unique');
}
