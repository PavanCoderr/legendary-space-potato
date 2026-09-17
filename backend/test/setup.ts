import { beforeAll, afterAll } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';

// Use a dedicated test database to avoid polluting development data.
// The db module reads DATABASE_URL as a raw file path.
const TEST_DB_PATH = path.resolve(process.cwd(), 'data', 'test.db');

beforeAll(async () => {
  // Remove any stale test database before running.
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }

  // Set the database path before any module imports the db.
  process.env.DATABASE_URL = TEST_DB_PATH;
  process.env.JWT_SECRET = 'test-secret-key-for-jwt';
});

afterAll(async () => {
  // Clean up the test database.
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
});
