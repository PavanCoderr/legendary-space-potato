// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { applySnapshot } from './state/persistence';
import { createInitialState } from './state/defaults';

describe('Persistence snapshot hygiene', () => {
  const base = createInitialState();

  beforeEach(() => {
    // Clear localStorage between tests
    localStorage.clear();
  });

  it('handles snapshot with null user.name', () => {
    const snapshot = {
      version: 1,
      user: {
        ...base.user,
        name: null, // This would crash Avatar.name.split() without the guard
      },
    };

    const restored = applySnapshot(base, snapshot as any);
    // Should keep the base user name, not set it to null
    expect(restored.user.name).toBe('Alex Rivera');
  });

  it('handles snapshot with empty string user.name', () => {
    const snapshot = {
      version: 1,
      user: {
        ...base.user,
        name: '', // Empty string should also be guarded
      },
    };

    const restored = applySnapshot(base, snapshot as any);
    expect(restored.user.name).toBe('Alex Rivera');
  });

  it('handles snapshot with whitespace-only user.name', () => {
    const snapshot = {
      version: 1,
      user: {
        ...base.user,
        name: '   ', // Whitespace should be trimmed and treated as empty
      },
    };

    const restored = applySnapshot(base, snapshot as any);
    expect(restored.user.name).toBe('Alex Rivera');
  });

  it('preserves valid user.name from snapshot', () => {
    const snapshot = {
      version: 1,
      user: {
        ...base.user,
        name: 'New User',
      },
    };

    const restored = applySnapshot(base, snapshot as any);
    expect(restored.user.name).toBe('New User');
  });
});
