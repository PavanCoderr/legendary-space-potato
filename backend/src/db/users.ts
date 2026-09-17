import { getDb, type SqliteDatabase } from './index';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  level: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  email: string;
  password_hash: string;
  name?: string;
}

/**
 * Find a user by their email address.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const db: SqliteDatabase = await getDb();
  const user = await db.get<User>(
    'SELECT * FROM users WHERE email = ?',
    email
  );
  return user ?? null;
}

/**
 * Find a user by their unique ID.
 */
export async function getUserById(id: string): Promise<User | null> {
  const db: SqliteDatabase = await getDb();
  const user = await db.get<User>(
    'SELECT * FROM users WHERE id = ?',
    id
  );
  return user ?? null;
}

/**
 * Create a new user record.
 * Returns the full user object including generated fields.
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const db: SqliteDatabase = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.run(
    'INSERT INTO users (id, email, password_hash, name, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    input.email,
    input.password_hash,
    input.name ?? null,
    'Beginner',
    now,
    now
  );

  const user = await getUserById(id);
  if (!user) {
    throw new Error('Failed to create user — record not found after insert');
  }
  return user;
}

/**
 * Update a user's profile information (name, level).
 */
export async function updateUser(id: string, updates: {
  name?: string | null;
  level?: string;
}): Promise<User | null> {
  const db: SqliteDatabase = await getDb();
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.level !== undefined) {
    fields.push('level = ?');
    values.push(updates.level);
  }

  if (fields.length === 0) {
    return getUserById(id);
  }

  fields.push('updated_at = ?');
  values.push(now);

  await db.run(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    ...values,
    id
  );

  return getUserById(id);
}
