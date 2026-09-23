// @vitest-environment jsdom
import { act } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { StoreProvider } from './state/StoreProvider';
import * as apiModule from './services/api';

/**
 * Frontend-level bug reproduction tests.
 *
 * Bug 1: Wrong password should be rejected during login — a wrong password
 *        for an existing user must NOT result in a successful sign-in.
 *
 * Bug 2: A new account must NOT see the previous account's progress —
 *        signing out must fully clear persisted state so the next signup
 *        starts with a blank slate.
 */

beforeEach(() => {
  window.localStorage.clear();
  // Clear all keys matching qubitverse.* pattern to ensure clean state
  Object.keys(window.localStorage)
    .filter(key => key.startsWith('qubitverse.'))
    .forEach(key => window.localStorage.removeItem(key));
  window.location.hash = '';
  vi.restoreAllMocks();
  apiModule.clearLocalUsers();
});

afterEach(cleanup);

function mount(hash: string) {
  window.location.hash = hash;
  return render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
}

describe('Frontend Bug Reproduction Tests', () => {
  describe('Bug 1: Wrong password should be rejected on login', () => {
    it('Test A: Create user with password correct123, then login with wrongpassword should FAIL', async () => {
      // Step 1: Signup with password "correct123"
      mount('#/signup');

      // Fill the form - use fireEvent.change for controlled inputs
      fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Test User' } });
      fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'bug1@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'correct123' } });

      // Select Advanced level
      fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

      // Click signup and wait for the async auth flow to complete
      // The submit function calls signIn() which is async
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create account and start learning/i }));
        // Wait for bcrypt hashing (async) + signed-in toast (5s) + debounce persistence (250ms)
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      // Allow state to settle
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
      });

      // Trigger React Router navigation by dispatching hashchange
      window.dispatchEvent(new HashChangeEvent('hashchange'));

      // Wait for React to re-render
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verify signup succeeded - user should now be logged in as Test User
      expect(document.body.textContent).toMatch(/Welcome back, Test User/);

      // Step 2: Sign out (now auto-signs in as demo learner and navigates to dashboard)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Profile menu/i }));
        await new Promise(resolve => setTimeout(resolve, 50));
        fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));
        await new Promise(resolve => setTimeout(resolve, 300));
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      // Step 3: After sign-out, user is auto-signed in as demo learner
      // Demo learner is "Alex Rivera" (alex@qubitverse.dev), not "Test User"
      await waitFor(() => {
        expect(document.body.textContent).toMatch(/Welcome back, Demo Learner|Welcome back, Alex Rivera/);
      });

      // Step 4: Try to login with the correct email but WRONG password
      // First navigate to login page
      window.location.hash = '#/login';
      act(() => {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue$/i })).toBeTruthy();
      });

      // Step 5: Try to login with the correct email but WRONG password
      fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'bug1@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpassword' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Continue$/i }));
        await new Promise(resolve => setTimeout(resolve, 800));
      });

      // Step 6: Assert that login FAILED
      // If login succeeded, the user would see the dashboard (Profile menu button visible)
      // If login failed, we'd still be on the login page or see an error toast
      const profileMenu = screen.queryByRole('button', { name: /Profile menu/i });

      // The wrong password should have been rejected
      // The profile menu should NOT be visible (user is not signed in)
      expect(profileMenu).toBeNull();

      // The login form should now show a clear inline error message
      const inlineError = await screen.findByText(/Incorrect email or password/i);
      expect(inlineError).toBeTruthy();
    });
  });

  describe('Bug 2: New account should NOT see previous account progress', () => {
    it('Test B: User A completes lesson, User B should have empty progress', async () => {
      // Per-user snapshot key
      const USER_SNAPSHOT_KEY = (email: string) => `qubitverse.snapshot.v1:${email.toLowerCase()}`;

      // Step 1: Signup as User A
      mount('#/signup');
      fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'User A' } });
      fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'usera@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'passwordA123' } });
      fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create account and start learning/i }));
        await new Promise(resolve => setTimeout(resolve, 600));
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      // Verify User A is signed in
      expect(document.body.textContent).toMatch(/Welcome back, User A/);

      // Step 2: Visit a lesson and mark it as complete for User A
      window.location.hash = '#/lesson/superposition';
      act(() => {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Mark the teaching video as watched
      const watchSection = screen.getByText(/Watch & Learn/i).closest('section')!;
      fireEvent.click(within(watchSection).getByRole('button', { name: /Mark as watched/i }));

      // Wait for persistence (debounced 250ms)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
      });

      // Verify User A has saved state in localStorage (per-user snapshot)
      const userAState = window.localStorage.getItem(USER_SNAPSHOT_KEY('usera@example.com'));
      expect(userAState).toBeTruthy();

      // Check that User A has some progress
      const parsedA = JSON.parse(userAState!);
      expect(parsedA.progress).toBeDefined();
      expect(parsedA.progress['superposition']).toBeDefined();
      expect(parsedA.progress['superposition'].videoWatched).toBe(true);

      // Step 3: Sign out User A (saves per-user snapshot, then auto-signins demo learner)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Profile menu/i }));
        await new Promise(resolve => setTimeout(resolve, 50));
        fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));
        await new Promise(resolve => setTimeout(resolve, 300));
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      // Should now be on dashboard as demo learner
      await waitFor(() => {
        expect(document.body.textContent).toMatch(/Welcome back, Demo Learner|Dashboard/i);
      });

      // Step 4: Navigate to signup and signup as User B (fresh account)
      window.location.hash = '#/signup';
      act(() => {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/^Name$/i)).toBeTruthy();
      });

      fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'User B' } });
      fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'userb@example.com' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'passwordB123' } });
      fireEvent.click(screen.getByRole('button', { name: /Beginner/i }));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create account and start learning/i }));
        await new Promise(resolve => setTimeout(resolve, 600));
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      // Step 5: Assert User B has NO progress from User A
      // User B's per-user snapshot should not have User A's data
      const userBState = window.localStorage.getItem(USER_SNAPSHOT_KEY('userb@example.com'));
      expect(userBState).toBeTruthy();

      const parsedB = JSON.parse(userBState!);

      // User B's progress for superposition should NOT have videoWatched=true
      const superpositionProgress = parsedB.progress['superposition'];
      expect(superpositionProgress).toBeDefined();

      // User B should NOT see User A's progress (videoWatched should be false)
      expect(superpositionProgress.videoWatched).toBe(false);
      expect(superpositionProgress.status).toBe('not-started');

      // Also verify User A's snapshot is unchanged (belt-and-braces)
      const userAStateAfter = window.localStorage.getItem(USER_SNAPSHOT_KEY('usera@example.com'));
      expect(userAStateAfter).toBeTruthy();
      const parsedAAfter = JSON.parse(userAStateAfter!);
      expect(parsedAAfter.progress['superposition'].videoWatched).toBe(true);
    });
  });
});