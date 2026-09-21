# Post-CORS-fix console analysis — null `user.name` crash chain — Buffy (2026-09-19)

Second read-only session on the stuck frontend. **No commands, no source edits.**
Companion: `2026-09-19-cors-trailing-slash-frontend-stuck.md` (Bug 1 CORS ✅ fixed,
Bug 2 `title` crash — superseded diagnosis below). User pasted the new console log
after fixing `CORS_ORIGIN`.

## 1. What the new log proves

- ✅ **CORS fix CONFIRMED WORKING** — requests now reach the backend (401/failed-auth
  errors, no more `ERR_FAILED`/preflight block). Bug 1 CLOSED.
- The 401 noise (`PUT /state 401`, `POST /api/logout 401`, `DELETE /state 401`) is the
  **accepted ephemeral-DB tradeoff in action**: the CORS-fix redeploy wiped the DB, so
  the browser's old JWT and account no longer exist. Expected, self-healing.
- `POST /api/login 401` = "User not found" (fresh DB) → the app's silent signup
  fallback fires (signup POST succeeded → no console entry — the console only logs
  failures). Navigation proceeds → **crash on first app-shell render**.
- ❌ `Uncaught TypeError: Cannot read properties of null (reading 'split')` at
  `Na (components chunk)` during render triggered by `hashchange` from `submit`.

## 2. Root cause chain (verified file-by-file)

`Avatar` (`src/components/ui.tsx:149`) is the only `.split` rendered in the
components chunk post-login — it does `name.split(/\s+/)` and receives
`name={state.user.name}` (Layout.tsx:142/237). The chain that makes that name **null**:

1. **Login form has no name field** — `src/pages/Auth.tsx` LoginPage submits
   `{ email, password, level: 'Beginner' }` (no `name`).
2. **Silent signup fallback** — `StoreProvider.signIn` (StoreProvider.tsx:380-390):
   login 401 "User not found" → `api.signup(email, password, name)` with
   `name === undefined`.
3. **Backend stores NULL** — `backend/src/auth/routes.ts` signup:
   `createUser({ name: name ?? undefined })` — no default; users.name = NULL.
4. **GET /state echoes the null** — `backend/src/users/routes.ts` (~line 158):
   `user: { ..., name: dbUser.name, ... }` → `name: null` in the payload.
5. **Hydrate clobbers the default** — `src/state/persistence.ts` `applySnapshot`:
   `user: { ...base.user, ...(snapshot.user ?? {}) }` — spreading `{ name: null }`
   sets `user.name = null`. (The reducer's `session/sign-in` DOES guard falsy names —
   `reducer.ts:113-117` — but the hydrate path bypasses that guard.)
6. **`Avatar name={null}` → `null.split()` → React unmounts the tree → stuck page.**

Console stack matches: `hashchange → O → render → os → Na` (Na = Avatar or its
chunk-local minified name), invoked from `submit` → `navigate()`.

Note: the earlier `undefined (reading 'title')` crash (Bug 2 in the previous report)
was a sibling symptom of the same class — stale localStorage snapshot re-hydrating
after the DB wipe. §DEP7's stale-snapshot drop handles that path; the definitive
`title`-crash attribution is moot now that the data boundary is the confirmed fix
point.

## 3. Immediate unblock (USER, ~2 minutes, no code)

1. On the Vercel page: DevTools → **Application → Storage → Clear site data**
   (removes the stale JWT + stale localStorage snapshot). Incognito works too.
2. Reload → use the **Signup form** (it HAS a name field) → dashboard should render
   (Avatar gets a real name; reducer `session/sign-in` also guards this path).
3. Then test login → logout → re-login (Part 4.4 round-trip).

## 4. Permanent fix — assigned to Claude via plan §DEP7 (updated)

Two layers, both small, zero UI change. Frontend first (fixes it for ANY null),
backend second (fixes the data at the source):

1. **F1 (P0) `src/state/persistence.ts` `applySnapshot`:** sanitize the user spread —
   only accept `name` if it's a non-empty string; otherwise keep `base.user.name`.
   One-line guard + a unit test (snapshot with `user.name: null` → state keeps the
   default name).
2. **F2 (P0) `src/components/ui.tsx` `Avatar`:** defense in depth —
   `(name ?? '').split(...)` with the existing `'QV'` fallback initials.
3. **F3 (P1) `backend/src/auth/routes.ts` signup:** default the name —
   `name: (typeof name === 'string' && name.trim()) ? name.trim() : email.split('@')[0]`
   so the DB never holds NULL names and GET /state never returns `name: null`.
4. **F4 (P2, optional) GET /state:** belt-and-braces `name: dbUser.name ?? email-derived`.
5. Tests: backend signup-without-name → user.name not null (auth.test.ts);
   frontend hydrate-null-name test (persistence or api.test.ts). Vitest summaries
   pasted (BF6 rule). Full D2-style re-run before the next deploy.

## 5. Status board update

| Item | Status |
|---|---|
| Bug 1 — CORS trailing slash | ✅ FIXED (user, dashboard) |
| 401 noise after redeploy | ✅ expected (ephemeral DB, accepted tradeoff) |
| Bug 3 — `null.name.split()` crash | ❌ OPEN — user unblocks via Clear-site-data + Signup form; Claude fixes via §DEP7 F1–F4 |
| Stale-snapshot replay | covered by §DEP7 item 3 (stale-snapshot drop) |

— Buffy
