// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { clearLocalUsers, createLocalApi } from './services/api';

/**
 * Bug 1 — password validation must actually verify the password.
 *
 * In local-only mode (no backend configured) the auth stub previously accepted
 * ANY password ≥ 6 chars. Now it stores a bcrypt hash on signup and compares on
 * login, so a wrong password is genuinely rejected.
 */
describe('Bug 1: local-mode auth rejects wrong passwords', () => {
  beforeEach(() => {
    clearLocalUsers();
  });

  it('rejects login with a wrong password', async () => {
    const api = createLocalApi();
    await api.signup('alice@example.com', 'correct-horse-battery-staple', 'Alice', 'Beginner');

    await expect(
      api.login('alice@example.com', 'totally-wrong-password'),
    ).rejects.toThrow('Invalid credentials');
  });

  it('accepts login with the correct password', async () => {
    const api = createLocalApi();
    await api.signup('bob@example.com', 'correct-horse-battery-staple', 'Bob', 'Beginner');

    const result = await api.login('bob@example.com', 'correct-horse-battery-staple');
    expect(result.user.email).toBe('bob@example.com');
  });

  it('rejects signup of a duplicate email', async () => {
    const api = createLocalApi();
    await api.signup('alice@example.com', 'correct-horse-battery-staple', 'Alice', 'Beginner');
    await expect(
      api.signup('alice@example.com', 'other-password', 'Alice2', 'Beginner'),
    ).rejects.toThrow('User already exists');
  });
});
