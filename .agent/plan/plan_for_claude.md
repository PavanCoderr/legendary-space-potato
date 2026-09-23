# Plan for Claude CLI — FRONTEND-ONLY PIVOT (submission build)

**USER DECISION 2026-09-23 (submission tomorrow): ship FRONTEND-ONLY.** Accounts +
progress live in localStorage; demo sign-in; sign-out lands on the dashboard. The
`backend/` folder is PAUSED, NOT deleted — do not touch it. Evidence and decisions:
`.agent/report/2026-09-23-frontend-only-pivot-plan.md` — read it first.

Execute ONLY Phase F below, in order. The Ground rules section further down still
applies. Everything BELOW the `HISTORICAL` divider is the paused backend track — do
not resume it without the user's explicit say-so.

## Pivot ground rules (in addition to the Ground rules below)

- `backend/`: zero reads for changes, zero edits, zero commands inside it.
- No UI redesign: no styling/component/page/routing changes. Logic-only edits + tests.
  Auth page stays exactly as-is (user decision: keep email/password form AND demo button).
- Keep `createHttpApi`/token/bootstrap code — one env var must re-enable the backend later.
- The user runs all Vercel/dashboard steps (`plan_for_user.md` Part 0). You do code + tests only.
- Update `.agent/progress/plan_progress_claude.md` after EVERY task; paste typecheck/vitest
  summaries (BF6 rule).
- Ask the user before any git commit/push.

## Phase F — frontend-only submission build

### F1 (P0): Sign-out → demo learner → dashboard
- Files: `src/state/StoreProvider.tsx` (`signOut`, ~line 481),
  `src/components/Layout.tsx` (~line 267-272), `src/pages/Profile.tsx` (~line 146-151).
- Today: `signOut()` = dispatch `session/sign-out` + `api.logout()` + `api.clearState()`;
  both buttons then `navigate('login')`, and the auth gate (`src/App.tsx:36-38`) blocks
  `#/dashboard` for signed-out visitors.
- New behavior:
  1. `signOut()` persists the signed-in user's snapshot per-user FIRST (F2), then
     dispatch `session/sign-out`, `await api.logout()`, `await api.clearState()`, then
     dispatch `session/sign-in` with `demo: true`, `email: 'alex@qubitverse.dev'`,
     `name: 'Demo Learner'`, `level: 'Beginner'`, `authToken: null` — keep the identity
     strings consistent with `src/pages/Auth.tsx:217`.
  2. Both call sites: `navigate('dashboard')` instead of `navigate('login')`.
- ⚠️ The user said "dashboard (hero page)". Default to `#/dashboard` (the app Dashboard).
  If the user confirms they meant the public landing hero, the ONLY change is
  `navigate('home')` at the same two call sites — ask before deviating.
- Acceptance: from BOTH the Layout menu and Profile, sign-out lands on the Dashboard as
  the demo learner (Profile badge shows "demo learner"); no login page in between; no
  console errors; unit test covers the new `signOut` flow.

### F2 (P0): Per-user progress scoping in localStorage
- Why: `signOut` currently wipes the ONLY copy of progress in local mode (reducer resets
  + `clearState`), so re-sign-in would show empty progress — violates the user's
  requirement "if user sign in then user can see their progress data".
- Files: `src/state/persistence.ts` (new functions, mirror the existing try/catch +
  console.warn pattern), `src/state/StoreProvider.tsx` (debounced save ~145-150,
  `signIn` ~420-470, `signOut`, `resetEverything`).
- Design:
  - `persistence.ts`: `loadUserSnapshot(email)` / `saveUserSnapshot(email, snapshot)` /
    `clearUserSnapshot(email)` with key `qubitverse.snapshot.v1:${email.toLowerCase()}`.
  - Debounced save: when `api.kind === 'local'` and `session.signedIn && !session.demo`
    → also `saveUserSnapshot(session.email, snapshot)`.
  - `signIn` (local mode, non-demo): after auth success, hydrate from
    `loadUserSnapshot(email)` when present, else fall back to `api.loadState()`.
  - `signOut`: `saveUserSnapshot(currentEmail, stateRef.current)` BEFORE clearing
    (belt-and-braces against the 250 ms debounce race — see the comment at
    `StoreProvider.tsx:483`).
  - `resetEverything`: also `clearUserSnapshot(current email)` when signed in non-demo.
- Acceptance (unit test): signup → progress change → sign out → dashboard (demo) →
  sign in as the same user → progress restored; a DIFFERENT user sees their own (empty)
  progress, not the first user's data.

### F3 (P1): AI-settings path verification (likely ZERO code)
- User decision: at demo time they paste their own key in Settings (openai-compatible,
  base URL `https://vyceai.com/v1`, model `agnes-3.0-flash`). In local mode `askTutor`
  already routes that through `remoteTutorReply` (`api.ts:127-131` →
  `services/llm.ts`); without a key the built-in tutor answers.
- Verify shipped defaults are NOT openai-compatible (so nothing calls out until the user
  adds a key) and the error/fallback path degrades to the built-in tutor. Fix only if a
  default is wrong; otherwise log "verified, no change".

### F4 (P0): Full verification gate (BF6 rule — paste ALL summaries into the progress file)
- Root only, no backend commands: `npm run typecheck`, `npm test`, `npm run build`.
- Also confirm the production bundle contains no Render URL
  (`grep -r "onrender.com" dist/` should come back empty after the env var is removed
  from the build — the USER controls that on Vercel; locally just verify the label
  "Local storage + in-browser simulator" with no `VITE_API_BASE_URL` set).

### F5: Log every task in `.agent/progress/plan_progress_claude.md` as you go.

## Out of scope until after submission
- ALL historical phases below (backend hardening, deployment, DEP1-DEP7). The backend
  folder and its Render service stay parked. Resume only on user instruction.

---

## ⬇️ HISTORICAL — backend hardening track (PAUSED 2026-09-23, do not execute) ⬇️

# Plan for Claude CLI — QubitVerse Backend Hardening & Completion (superseded)

Written by Buffy (planner) 2026-09-18. Based on the review in
`.agent/report/2026-09-18-backend-review.md` — read that first for evidence and file:line
references.

**LAST BACKEND SESSION (2026-09-19): Review #4 → `.agent/report/2026-09-19-review-4-e4b-e6-c4-dep.md`.
E4b bootstrap IMPLEMENTED (main.tsx, 1.5 s race — one P1 gap: its unit test doesn't
test the bootstrap, fix via plan §DEP4-test). E6 `video.chapters` DONE in both trees.
C4 was ALREADY DONE (audit #3's "not started" line was stale — see §C4). Remaining
code work was: §DEP (DEP1 tsx→dependencies, DEP2 trust proxy, E4b test) → final D2 run →
deployment per `plan_for_claude_deployment.md` — all PAUSED by the 2026-09-23 pivot.**

## Ground rules (non-negotiable)

- Do NOT redesign/replace frontend UI, styling, components, pages, or routing.
- No fake/mock backend behavior anywhere. Delete fake code, don't paper over it.
- Never expose API keys to the frontend. Secrets only via env vars.
- Max 2 subagents in parallel, cheap models only (per CLAUDE.md).
- Ask the user before: `git rm --cached data/qubitverse.db`, any deploy, any destructive command.
- Update `.agent/progress/plan_progress_claude.md` after every task.

Execute phases in order. Within a phase, tasks are ordered by dependency.

---

## Phase A — Security & correctness (P0)

### A1. Remove the fake simulation result
- File: `backend/src/circuits/routes.ts` (the `POST /:id/simulate` handler, fake block at ~lines 79–92 with the `TODO: Integrate with actual quantum simulator` comment).
- It currently returns hard-coded uniform counts `{ '00': 256, '01': 256, '10': 256, '11': 256 }`. This violates the spec ("never fake simulation results").
- Replace with the real simulator: import `simulate`/`runSimulation` from the shared quantum module exactly like `backend/src/simulator/routes.ts` already does (that route is correct — mirror its approach, including circuit validation and shots/seed handling).
- The loaded circuit (from `projects` or `lesson_circuits`) must be parsed/validated before simulating; return 400 with a descriptive error for invalid circuits.
- Acceptance: `POST /api/circuits/:id/simulate` for a Bell circuit returns only `|00⟩`/`|11⟩` ~50/50; invalid circuit returns 400; no hard-coded numbers remain in the file.

### A2. Enforce foreign keys in SQLite
- File: `backend/src/db/index.ts`.
- SQLite does not enforce FKs unless `PRAGMA foreign_keys = ON` is set per connection. All `FOREIGN KEY ... ON DELETE CASCADE` constraints are currently decorative.
- Enable the pragma on every connection this module opens (the cached connection path and the test/reset path).
- Acceptance: a test that deletes a user cascades to their `lesson_progress`/`quiz_attempts`/`projects` rows.

### A3. Git hygiene: never commit DB or env files
- `.gitignore`: add `*.db`, `data/`, `.env`, `.env.*`, and `!.env.example`.
- Create `.env.example` (committed) documenting: `JWT_SECRET`, `PORT`, `CORS_ORIGIN`, `DATABASE_URL`, `OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_BASE_URL`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` (names must match what `backend/src/ai/provider.ts` and `backend/src/utils/jwt.ts` actually read).
- With user approval only: `git rm --cached data/qubitverse.db` (the tracked DB contains user password hashes).
- Acceptance: `git status` no longer offers `data/qubitverse.db`; `.env.example` lists every env var the code reads.

### A4. Gate debug endpoints
- File: `backend/src/server.ts` — `/api/debug/cors` and `/api/debug/jwt` leak env key names and JWT secret length.
- Register them only when `NODE_ENV !== 'production'` (or delete them if nothing depends on them — check `progress.md` claims first).
- Acceptance: in production mode both return 404.

### A5. Make logout/session revocation real
- Files: `backend/src/auth/routes.ts` (logout deletes `FROM sessions WHERE email = ?`), `backend/src/middleware/auth.ts`, `backend/src/utils/jwt.ts`.
- Problem: JWTs are stateless, the `sessions` table is never written, so logout revokes nothing and deletes all devices' rows by email.
- Minimal correct design (recommended):
  1. At login/signup, insert a session row: `id` = token `jti` (add `jwtid` when signing), `user_id`, `expires_at`.
  2. `authenticate` middleware: after `verifyToken`, check the session row exists and `expires_at` > now; treat missing/expired as unauthenticated.
  3. Logout deletes only that session id (from the token), not by email.
- Acceptance: token issued before logout is rejected afterwards; a second device's token stays valid; tests cover both.

### A6. Delete leftover debug file
- `backend/test-tsx5.ts` is a scratch script (prints sqlite export shapes). Delete it.

---

## Phase BF — Audit-2 fixes (P0/P1, blocks Phase C)

Written by Buffy 2026-09-18 after Audit #2 (`.agent/report/2026-09-18-audit-2.md`) —
read that first for evidence and file:line references. Do these before Phase C.

### BF1 (P0): GET /state must return the stored snapshot
- **Buffy review 2026-09-18: implemented** — GET loads `user_snapshots`, spreads it,
  then overrides server-authoritative `user`/`xp`/`streak`/`levelInfo`/`recentXp`
  (`users/routes.ts`). Acceptance now gated on the BF5 `/state` round-trip test.
- Original task text (for reference): load the stored snapshot, spread it, then override
  with server-authoritative fields. Acceptance: PUT a snapshot with lesson progress →
  GET → same progress comes back; a re-login restores progress.

### BF2 (P1): achievements must be `string[]` in the snapshot path
- **Buffy review: implemented** (`users/routes.ts` GET extracts ids). One P2 edge
  remains: a stored snapshot with `achievements: []` wins over server-awarded ids
  (`[].every(...)` is true) — union the two lists instead:
  `[...new Set([...snapshotIds, ...serverIds])]`.

### BF3 (P1): challenge submission endpoint (closes B2)
- **Buffy review: DONE, ship-quality** (report #3 §1). Minor follow-ups (P2, non-blocking):
  N1 — public `GET /api/challenges` exposes `solutionCode`; strip it from the public
  payload. N2 — cap `shots` (uncapped today, CPU-boundable) in challenges AND simulator
  routes. N3 — `challenge_attempts.xp_awarded` always written 0; update after awarding.
  Original task text below for reference.
- `POST /api/challenges/:id/submit`: run the submitted circuit through the real
  simulator, evaluate the seeded check predicates server-side (reuse
  `backend/src/data/challenges.ts` definitions — do NOT trust a client `passed` flag),
  record `challenge_attempts`, award XP via `awardXp('challenge_passed', challengeId)`
  on pass. Client wiring into the reducer flow can land with C5.

### BF4 (P1): UNIQUE index on pre-existing databases
- **Buffy review 2026-09-18: implemented (dedupe + unique index present in
  `initializeDatabase`), but see BF4a below — the `migrateDatabase` copy has a
  startup-crash bug on legacy DBs.** Original acceptance unchanged.

### BF4a (P1, NEW — from `.agent/report/2026-09-18-bf3-review-and-status-audit.md` §3)
- **Buffy status 2026-09-18 (after approved test run): IN PROGRESS — Claude's fix + new
  `test/migrations.test.ts` exist; 2 of its 4 tests FAIL. Do not mark BF4a done until
  these two are fixed:**
  1. The try/catch now guards the `DELETE FROM xp_ledger`, but the trailing
     `CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_ledger_unique ON xp_ledger (...)` is still
     UNGUARDED → on a legacy DB without the table it still throws
     `no such table: main.xp_ledger` (caught by `migrations.test.ts` test 1). The
     cleanest fix STANDS: **remove the whole xp_ledger block from `migrateDatabase`** —
     the identical dedupe+index block in `initializeDatabase` runs AFTER `CREATE TABLE`,
     so it is correct for fresh AND legacy DBs.
  2. `migrations.test.ts` test 4 is a TEST bug: it INSERTs xp_ledger rows for a user_id
     with no matching `users` row → `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`
     (FK enforcement working as designed). Create the user first (pattern:
     `xp.test.ts` beforeAll).
- Original task text: `migrateDatabase` ran `DELETE FROM xp_ledger` before the table
  existed → startup crash on legacy databases. Fix: remove that block (keep `users`
  ALTER guards); dedupe GROUP BY must not include `amount`; regression test required
  (legacy-shaped DB → `initializeDatabase` → no throw, index exists).

### BF5 (P1): regression tests — Buffy review: XP + challenge tests EXIST; /state round-trip MISSING
- XP idempotency: DONE (`test/xp.test.ts` — ledger COUNT(*)=1 asserted).
- Challenge submit pass/fail XP: DONE (`test/challenges.test.ts`).
- `/state` round-trip (PUT progress → GET → same progress back): **STILL TODO** —
  `state.test.ts` PUTs a snapshot but never GETs it back. Required: PUT snapshot with
  non-trivial `progress` + `currentCircuit` → GET → same values return, `achievements`
  is `string[]`, server `xp` overrides snapshot `xp`.
- While there: verify `auth.test.ts` actually exercises logout-revocation (pre-logout
  token rejected, other device token valid — plan A5 acceptance); add if absent.

### BF6: progress-file honesty ✅ (superseded — full-suite summaries were pasted 2026-09-18)
- Mark B1/B2/B3 as they actually are (B2 blocked by BF3), paste the vitest summary
  into the log with each update.

## Phase CG — Buffy review follow-ups (P0/P1, 2026-09-18)

Evidence: `.agent/report/2026-09-18-c-phase-review.md`. **C2a is DONE (fixed in
parallel by Claude, typecheck-verified 2026-09-18).**

**NOTE 2026-09-18: Claude pivoted to Phase E4 mid-handoff (user-observed, Buffy-confirmed
in code). **USER DECISION 2026-09-18: E4 finishes FIRST (frontend half), THEN CG1 → CG2
→ CG3 → CG4 in order.** The CG work below is UNTOUCHED (no caps, no solutionCode
stripping, no xp_awarded fix as of this verification) and the audit criteria stay valid
whenever it runs.**

**USER DIRECTIVE 2026-09-18: Claude executes Phase CG next. Buffy audits CG1+CG2 in
the following session.** Audit criteria Buffy will check — make every claim checkable:
- **CG1:** a shots cap (`Math.min(..., 10_000)` or env `MAX_SHOTS` override) is
  present in ALL THREE of `circuits/routes.ts`, `simulator/routes.ts`,
  `challenges/routes.ts`; `server.ts` json limit is `1mb`; negative/zero/non-integer
  shots still cannot crash or zero-out the simulation; at least one test covers a
  route's cap. Note: `shots_used`/`shots` in responses must reflect the CAPPED value,
  not the requested one.
- **CG2:** public `GET /api/challenges` and `GET /api/challenges/:id` payloads contain
  NO `solutionCode` key (`validate` is a function — it vanishes in JSON by itself, no
  stripping needed); on a passing first submission the stored
  `challenge_attempts.xp_awarded` equals the awarded XP, and is 0 on fail and on an
  idempotent re-pass; tests assert both.
- Per the BF6 rule: do not mark CG1/CG2 done in the progress file until the vitest
  summary for the new/updated tests is pasted into the log.

### CG AUDIT STAMP (Buffy 2026-09-19): CG1/CG2/CG3/CG4 + C3-decision ALL VERIFIED
AND CLOSED against the criteria below — evidence in audit #3 §3. No further CG work.

### CG1 (P1): Cap `shots` everywhere
- `Math.min(shots, 10_000)` (or env-configurable `MAX_SHOTS`) in all three:
  `circuits/routes.ts`, `simulator/routes.ts`, `challenges/routes.ts` — all use bare
  `Math.max(1, Math.floor(shots))` today (report §2 F3).
- While in `server.ts`: drop the JSON body limit from 10 MB to 1 MB (report §2 F7).

### CG2 (P2): Challenge route follow-ups
- N1: `GET /api/challenges` + `GET /:id` return `solutionCode` verbatim from
  `CHALLENGES` (`challenges/routes.ts` ~29–42; `data/challenges.ts` lines 85/136/196/272/325).
  Strip it from both public payloads.
- N3: `challenge_attempts.xp_awarded` is hard-inserted 0 even when XP is awarded
  (`challenges/routes.ts` ~line 77). Write the real value.

### CG3 (P1): D1 test gaps — three required tests are missing (report §2 F2)
1. Bell circuit via `POST /api/circuits/:id/simulate` → only `|00⟩`/`|11⟩` ~50/50
   (A1's acceptance test was never written; only a 404 test exists).
2. Streak day-transition test: consecutive-day activity increments, gap resets.
3. C2a save-validation tests (now that the source fix landed, typecheck-verified):
   unknown gate → 400, out-of-range qubit → 400, valid save → 201.

### CG4 (P2): Lesson completion semantics decision
- `lessons/routes.ts`: `status='completed'` requires 5 flags but `completed_at`
  (and XP award) effectively use 6 → a lesson can be `completed` with NULL
  `completed_at` (report §2 F6). Pick one definition, state it in the progress log,
  make the SQL consistent.

---

## Phase B — XP, streak, achievements server-side (P0, spec §3)

Status update (Buffy 2026-09-18): B1/B2 are largely implemented (with audit-2
follow-ups BF2–BF4); B3's acceptance is unmet until BF1 — see Phase BF above.
Original task list kept for reference:

- B1. Schema (in `backend/src/db/index.ts`, keep the same init style for now)
- `users`: add columns `xp INTEGER NOT NULL DEFAULT 0`, `streak INTEGER NOT NULL DEFAULT 0`, `last_active_date TEXT` (UTC date string).
- New table `xp_ledger`: `id TEXT PK`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `source_type TEXT NOT NULL` (`lesson` | `quiz` | `challenge`), `source_id TEXT NOT NULL`, `xp INTEGER NOT NULL`, `created_at`, with `UNIQUE(user_id, source_type, source_id)` — this enforces the "prevent duplicate XP" rule at the DB level.
- New table `user_achievements`: `user_id`, `achievement_id`, `awarded_at`, `UNIQUE(user_id, achievement_id)`.
- Because there is no migration system yet, add a tiny guarded `ALTER TABLE ... ADD COLUMN` helper that tolerates "duplicate column" errors (Phase C4 replaces this with real migrations).

### B2. Award logic (server-side only, never trust client XP) — note: challenge-pass XP
is NOT implemented until BF3; do not mark B2 complete before it.
- Create a small module, e.g. `backend/src/db/xp.ts`: `awardXp(userId, sourceType, sourceId, xp)` → `INSERT OR IGNORE` into ledger; if a row was actually inserted, update `users.xp` and return the new total; otherwise return unchanged total.
- XP values: reuse the `xp` fields already defined in `src/data/lessons.ts`, `src/data/quizzes.ts`, `src/data/challenges.ts` seed data (the backend seeds from these already in `backend/src/db/seed.ts`) — do not invent new numbers.
- Wire into: quiz answer scoring (`backend/src/quizzes/routes.ts`, award on correct answer, idempotent per question/quiz), lesson completion (`backend/src/lessons/routes.ts`), challenge pass (where challenge submissions are handled).
- Streak: compute on any authenticated activity — if `last_active_date` is yesterday → streak+1; today → unchanged; older → reset to 1. Store `last_active_date` in UTC.
- Achievements: minimal deterministic set (first lesson completed, first correct quiz, Bell state challenge passed, streak ≥ 3). Keep server-side.

### B3. Expose to the existing UI without UI changes
- `backend/src/users/routes.ts` (`/state` GET) must include total XP, streak, achievements list, and per-course progress in the same response shape the frontend already consumes (`src/services/api.ts` documents the contract — match it exactly).
- Acceptance: submit the same correct quiz answer twice → XP awarded once (ledger has one row); `/state` shows correct totals; progress survives logout/login.

---

## Phase C — Hardening (P1)

**Buffy review 2026-09-18 (`.agent/report/2026-09-18-c-phase-review.md`): C1, C3,
C5 verified DONE in code. C2 has a P0 defect — do C2a first. C4 not started.**

### C2a (P0, NEW — fixes C2). Save-validation severity filter is applied to the wrong type
- **Buffy update 2026-09-18 (typecheck run, user-approved): FIXED IN PARALLEL BY
  CLAUDE and typecheck-verified — `circuits/routes.ts` now does `if (issues.length > 0)`
  (every issue string treated as an error) → `400 Invalid circuit: …`. Backend
  `npm run typecheck` exits clean. Report §6 postscript has the details.**
- Remaining for full C2 closure (P2/P3): (a) add the three save-validation tests —
  unknown gate → 400, out-of-range qubit → 400, valid save → 201 (moved to CG3);
  (b) optionally call `validateCircuit(qc)` after deserialization so same-column
  wire conflicts are also rejected — `deserializeCircuit` alone does not detect
  them (report §6).
- Original finding text (for reference): `issues.filter(i => i.severity === 'error')`
  on `deserializeCircuit`'s `issues: string[]` made validation a no-op and saved
  invalid circuits; expected TS2339 under strict.

### C1. Rate limiting ✅ DONE (Buffy-verified 2026-09-18)
- Add `express-rate-limit` (new backend dependency, justified): strict limit on `POST /api/login` and `POST /api/signup` (e.g. 10/15min per IP), looser on `/api/ai/*` (e.g. 30/15min per user). Return 429 with a JSON error the frontend already displays.

### C2. Validate circuit JSON on save — superseded by C2a (the implementation shipped broken)
- `backend/src/circuits/routes.ts` `POST /save`: validate the circuit payload before persisting — reuse `isGateType` and `parseCode`/serialization helpers from the shared quantum module (`src/quantum/`); reject unknown gates, out-of-range qubits, oversized payloads (also cap `json` body limit appropriately).

### C3. AI stub honesty (spec §7) ✅ DONE (Buffy-verified 2026-09-18) — one deviation: provider failure returns HTTP 200 + `error` field instead of a 502-style status; decide keep-vs-502 and state the reason in the progress log (report §2 F5)
- Original task text (for reference): `backend/src/ai/provider.ts` `StubProvider` / `backend/src/ai/routes.ts`: when no provider is configured, return a clear "AI tutor is not configured — set OPENAI_API_KEY (or ANTHROPIC/OPENROUTER) on the server" message instead of canned tutor content. The `provider`/`model` fields already exist in `TutorResponse` — mark stub responses clearly. Provider failure (network/auth error) → 502-style JSON error with `error` field, no fake content.

### C4. Minimal migrations — ✅ DONE & Buffy-verified in code (Review #4, 2026-09-19; corrects audit #3 §6, which was stale)
- `backend/src/db/index.ts:70` `runMigrations` + `schema_migrations` table + `rollbackMigration`/`getMigrationStatus`; `initializeDatabase` runs migrations (:185); `001_initial_schema.ts` + `002_add_last_active_date.ts` (Phase B ALTERs live here); `test/migrations.test.ts` 4/4 green. NOTHING REMAINS.
- Original task text (for reference): introduce `backend/src/db/migrations/` with numbered migrations + a `schema_migrations` table; make `initializeDatabase()` run pending migrations; move the Phase B `ALTER TABLE` guards into migration 002; no ORM.

### C5. Frontend auth integration check ✅ DONE (Buffy-verified 2026-09-18 — all three pre-identified gaps fixed in `src/services/api.ts`)

<!-- original C5 text kept for reference
- Verify `src/services/api.ts` `createHttpApi` sends `Authorization: Bearer` on every call and handles 401 by surfacing "session expired" rather than silently falling back to local mock logic in production flows. Only touch this file if a real integration gap exists; no UI changes.
- **Buffy pre-verification 2026-09-18 — real gaps confirmed** (`.agent/report/2026-09-18-side-by-side-verification.md` §3): (a) `saveState` swallows backend failure with only `console.warn`; (b) `runSimulation` drops the `seed` option even though the backend supports it and the settings UI has `useFixedSeed`; (c) `submitQuiz` catch-fallback returns `{ recorded: false }` silently. Bearer header itself is sent correctly on all calls. Fix these three + the 401 surfacing; no UI changes.
-->

---

## Phase E — Learning content fixes (P0 for the math error; P1/P2 otherwise)

Evidence for every item: `.agent/report/2026-09-18-learning-content-review.md`. Read it
before starting. Content edits must be applied to BOTH `src/data/` and
`backend/src/data/` (identical trees) until E3 removes the duplication.

### E1. Fix the wrong quiz explanation (P0, math error)
- **Buffy review 2026-09-18: content fix is APPLIED in both trees** (`src/data/quizzes.ts:18`
  and `backend/src/data/quizzes.ts:18`, word-for-word per the original instruction).
  Remaining: start the backend once so `INSERT OR REPLACE` reseeds the DB, then verify
  `GET /api/quiz/qubits-1` returns the corrected text.
- Original task (for reference): `src/data/quizzes.ts` AND `backend/src/data/quizzes.ts`,
  quiz `qubits-1`. The state `0.6|0⟩ + 0.8|1⟩` IS normalised (0.36 + 0.64 = 1). The answer
  option stays unchanged (correct answer is still index 1).

### E2. Content sanity test (P0)
- **Buffy update 2026-09-18: test files written by Buffy, import-path defect FIXED
  (Claude fixed them in parallel; Buffy verified the path math — report #3 §5).** The
  suites are now runnable; the E1-marker tests should pass since E1 is applied in both
  trees. Claude: when running the suites for BF6, if any content test fails it is now a
  REAL content/contract failure — report it, don't skip it.
- Add `backend/test/content.test.ts`: for every quiz in `backend/src/data/quizzes.ts`,
  assert `correctIndex` is a valid option index, options are non-empty, and — where an
  amplitude state literal like `a|0⟩ + b|1⟩` with real numbers appears in the question —
  verify |a|² + |b|² = 1 (tolerance 1e-9). Add the mirrored simple checks for the
  frontend copy too (`src/data/` — a small vitest under src, matching existing test
  setup).
- Acceptance: the test fails on the pre-E1 text and passes after E1 — do E1 first,
  run the test, then commit both.

### E3. Stop the two-tree drift (P1)
- **Buffy update 2026-09-18: DONE — drift tests included in the same files as E2**
  (quizzes deep-compare, lessons/challenges content-field compare, glossary equality,
  and a `TOTAL_LESSON_XP` consistency check, both directions). Extend them if new
  content-critical fields are added.
- Add a test (in the same content test file) that deep-compares the content-critical
  fields between `src/data/lessons.ts`+`quizzes.ts`+`challenges.ts` and the backend
  copies: ids, titles, xp, quizIds, challengeId, video.youtubeId, and every quiz
  question/options/correctIndex/explanation.
- Do NOT restructure imports (no redesign rule). This test converts silent drift into a
  loud failure.

### E4. Backend must serve the full lesson payload (P1)
- **USER DIRECTIVE 2026-09-18: FINISH E4 FIRST (the frontend half) before returning to
  CG1/CG2. Buffy audits E4 on completion — audit criteria at the end of this section.**
- **Buffy mid-implementation verification 2026-09-18 (Claude pivoted here from the CG
  handoff): BACKEND HALF DONE — `unpackLesson`/`LessonMeta` exists in
  `lessons/routes.ts` (both `GET /` and `GET /:id`, `{ lesson, progress }` envelope
  preserved) and the seed now writes `concept: lesson.concept` (design doc §2.1 +
  §2.2 complete). FRONTEND HALF NOT STARTED — no `toFrontendLessons`, no
  `replaceLessons`, `main.tsx` unchanged.**
- **⚠️ CRITICAL before building the frontend half — startCircuit data gap (design-chain
  defect found by Buffy):** the seed's `interactive` JSON does NOT include
  `startCircuit` (`seed.ts` serializes only kind/title/instructions/availableGates/
  successNote/completionCheck), but `Dashboard.tsx:94` + `Lesson.tsx:58` call
  `lesson.interactive.startCircuit`. With the design doc §3.1 spread
  (`...fallback, ...http`), the HTTP `interactive` (no startCircuit) would override
  the bundled `interactive` (has it) → **runtime break in HTTP mode**. Pick ONE fix
  and log the choice:
  - **(a) Preferred — make it truly backend-served:** in `seed.ts`, add
    `startCircuit: serializeCircuit(lesson.interactive.startCircuit)` to the
    interactive JSON (serializeCircuit already imported for the example circuit),
    reseed, then the normalizer rebuilds it:
    `startCircuit: deserializeCircuit(http.interactive.startCircuit).circuit`.
  - **(b) Pragmatic fallback-merge:** in `toFrontendLesson`, emit
    `interactive: { ...fallback.interactive, ...http.interactive, startCircuit:
    fallback.interactive.startCircuit }` — works immediately, but startCircuit stays
    frontend-bundled (not backend-served); note the limitation in the progress log.
  (The side-by-side report's "rebuild startCircuit is REQUIRED" finding refers to the
  runtime rebuild — option (a) is the only variant that fully satisfies E4's goal.)
- **E4 AUDIT RESULT (Buffy 2026-09-19 — see `.agent/report/2026-09-19-audit-3-e4-cg-e6.md` §2):
  backend half, normalizer, per-lesson integrity rule, unit tests, typecheck — ALL
  VERIFIED against code. ❌ ONE P0 GAP REMAINS — E4b below. The progress log's claim
  that a "bootstrap already existed" in main.tsx is false: `main.tsx` (23 lines) has
  no bootstrap; `fetchLessons()` has ZERO callers in `src/` (all 6 hits are inside
  `services/api.ts` itself); `replaceLessons` is never imported outside `lessons.ts`.
  Pages import the bundled `LESSONS` array directly, so HTTP mode never installs the
  backend curriculum — E4's purpose (spec §2: editable backend-served content) is
  unreachable in the running app.**
- **E4b (P0 — the only E4 blocker): lessons bootstrap.**
  In `src/main.tsx`, BEFORE `createRoot(...).render(...)`, install the backend
  curriculum when in HTTP mode:
  `await Promise.race([api.fetchLessons().then(replaceLessons), new Promise(r => setTimeout(r, 1500))])`
  — extract into a tiny async helper if cleaner, and wrap in try/catch
  (`fetchLessons()` already falls back to bundled on failure, so a downed backend
  costs at most the 1.5 s timeout). All pages read `LESSONS`/`LESSON_MAP` at render
  time and `replaceLessons` mutates them in place, so awaiting before first render
  means the first paint already shows backend lessons. Add ONE unit test (either
  test that bootstrap calls `replaceLessons` with the normalized payload, or extract
  a testable `bootstrapLessons(api)` helper and test that). Footprint: ≤3 lines in
  `main.tsx` + optional helper + 1 test — NO UI changes. Paste the diff + vitest
  summary in the progress log (BF6 rule). E4 stays `[~]` until E4b lands.
- **E4 AUDIT CRITERIA (original list, kept for reference):**
  1. *Backend payload:* `GET /api/lessons` (with token) → 5 unpacked lessons; the
     `qubits` entry has string `video.youtubeId`, array `objectives`, string `icon`
     (name like `CircleDot`), object `example.circuit`, number `xp`, object `concept`;
     `GET /api/lessons/qubits` still returns the `{ lesson, progress }` envelope.
     Reseed needed (backend restart) — Claude pastes the response evidence or an
     approved command run verifies it.
  2. *startCircuit:* option (a) or (b) chosen and logged; in HTTP mode
     `Dashboard.tsx:94` + `Lesson.tsx:58` receive a real runtime circuit (no
     `undefined` access).
  3. *Footprint:* ONLY `services/api.ts`, additive `src/data/lessons.ts`
     (`replaceLessons` + `TOTAL_LESSON_XP` let-conversion), ≤3 lines in `main.tsx`
     (bootstrap before first render, 1.5 s timeout race). No page/component/style/
     routing changes — Buffy diffs.
  4. *Integrity rule:* per-lesson fallback (invalid lesson → bundled, unknown id →
     skipped, empty payload → bundled list); icon registry with `CircleHelp` fallback.
  5. *Tests:* unit tests for the normalizer (rich payload; missing `youtubeId` →
     that lesson falls back; unknown id skipped; empty → bundled); a backend lessons
     payload test; BF6 rule — BOTH vitest summaries pasted; **root typecheck must
     pass** (the normalizer's `as Lesson` casts are the risk spot); E3 drift tests
     still green.
  6. *No content drift:* any lesson content change lands in BOTH trees (E3 guards).
- **Buffy update 2026-09-18: both open questions in the design doc are RESOLVED — see
  `.agent/report/2026-09-18-side-by-side-verification.md` §2.** `LESSON_MAP`,
  `getLesson`, `firstLesson`, `recommendedLesson` are all exported (`lessons.ts:446–466`),
  and `interactive.startCircuit` IS consumed at `Dashboard.tsx:94` and `Lesson.tsx:58` —
  so the normalizer MUST rebuild `startCircuit` via `deserializeCircuit` (the doc's
  "one extra line" is now a REQUIREMENT, not optional).
- **Implement from the design doc: `.agent/report/2026-09-18-e4-design.md`** — it contains
  the exact backend unpack helper, the frontend normalizer with the per-lesson integrity
  rule, the `replaceLessons` bootstrap approach, and acceptance tests. Follow it as
  written; the doc's "zero UI change" approach touches only `services/api.ts`,
  `src/data/lessons.ts` (additive), and 3 lines in `src/main.tsx` — no visual changes.
- `backend/src/lessons/routes.ts` `GET /` currently returns the thin lessons-table row.
  Unpack the seeded JSON stored in the `description` column and merge it into each row
  before responding; keep `GET /api/lessons/:id`'s `{ lesson, progress }` envelope.
- Also add `concept: lesson.concept` to the seed's description JSON (see doc §2.1) and
  reseed.
- Do NOT change any frontend page/component. After the payload matches, wire the
  bootstrap swap per the doc.

### E5. Expose the dead seeded data (P1)
- **Buffy update 2026-09-18: this is ~80% DONE already** — `GET /api/challenges` +
  `/:id` and `GET /api/glossary` (+`/:term`) and `GET /api/achievements` (+`/progress`)
  all exist and are mounted in `routes.ts`. See verification report §4. Remaining:
  confirm the glossary/achievements backend data matches the frontend copies (that
  check belongs to the E3 drift test) and that every route has at least one test.

### E6. Content depth (P2 — only after E1–E5) — ✅ APPROVED by user 2026-09-18
- Implement the 12 approved quiz questions EXACTLY as written in
  `.agent/report/2026-09-18-e6-quiz-draft.md` (ids, options, correctIndex, explanations,
  XP — no rewording). Add to BOTH `src/data/quizzes.ts` and `backend/src/data/quizzes.ts`.
- **Buffy verification 2026-09-18: all 12 questions hand-checked against the real
  simulator/gates — 12/12 CONFIRMED** (`2026-09-18-side-by-side-verification.md` §1).
  The "blocked if inconsistent with simulator" branch will not trigger; implement as
  written.
- Fill `video.chapters` from each lesson's `outline` items (both trees).
- **E6 AUDIT (Buffy 2026-09-19): the 12 questions are correctly implemented in both
trees (verified; drift-guarded). P2 residual open: `video.chapters` is still empty
(`chapters: []`, e.g. `src/data/lessons.ts:39`) — fill from `outline` in BOTH trees,
then re-run both suites and paste summaries. E6 stays `[~]` until then.**
- Do not add new lessons/topics in this phase. If any drafted question turns out to be
  inconsistent with the simulator, set E6 to `blocked` and note it in the progress file —
  do not silently edit the approved content.

---

## Phase D — Tests & verification (gate for "done")

### D1. New/updated backend tests (`backend/test/`)
- Fake-simulation regression: Bell circuit via `/api/circuits/:id/simulate` → only `00`/`11`.
- FK cascade: delete user → dependent rows gone.
- XP idempotency: same quiz correct answer twice → single ledger row, XP total unchanged on retry.
- Streak: activity on consecutive days increments; gap resets.
- Logout: pre-logout token rejected, other device token still valid.
- Circuit save validation: unknown gate / bad qubit rejected.
- AI: no key → config message; provider throw → JSON error; key present → real provider path (mock fetch/client, don't hit real APIs).
- Rate limit: login bursts → 429.

### D2. Full verification run (must all pass before claiming any phase complete)
```bash
cd backend && npm run typecheck && npm test
npm run typecheck && npm test && npm run build   # from repo root
```
- Update `progress.md` and `.agent/progress/plan_progress_claude.md` only after green.

## Phase DEP — pre-deploy code tasks (added by Buffy 2026-09-19, Review #4)

Authoritative source: `plan_for_claude_deployment.md` (free-tier revision) — read its
§0 ordering rule. Deployment itself is USER-executed (dashboard steps, every action
gated on explicit user confirmation). Claude's remaining CODE tasks only:

### DEP1 (P0): make the backend production-installable
- Move `tsx` from `devDependencies` to `dependencies` in `backend/package.json`.
- Why: `"start": "tsx src/server.ts"` — on Render with a production install the
  service cannot boot without tsx in dependencies. One line + paste the diff.
- Optional verification (needs user approval): `cd backend && rm -rf node_modules &&
  npm ci --omit=dev && npm start` → `GET /health` → 200.

### DEP2 (P0): `app.set('trust proxy', 1)` in `backend/src/server.ts`
- Add it with a comment, BEFORE the rate-limit middleware is registered.
- Why (free tier): behind Render's proxy every user shares one IP → the 10-per-15-min
  auth limiter becomes a GLOBAL lockout. With it, limiting buckets per real client IP.
- Existing `rate-limit.test.ts` must stay green (no proxy headers locally) — paste its summary.

### DEP4-test (P1): close the E4b test gap (Review #4 §2.3)
- The existing `describe('replaceLessons (E4b bootstrap)')` tests only `replaceLessons`
  — nothing invokes `bootstrapLessons`. Preferred fix (t1): parameterize the existing
  `api.ts` `bootstrapLessons` helper (e.g. optional deps object) and unit-test:
  http-mode installs fetched lessons; fetch throws → bundled intact; non-http → no call.
  Have `main.tsx` import the tested helper (removes the duplicate, P3). Paste the
  `api.test.ts` vitest summary.

### DEP3 (user decision, no code) — ✅ RESOLVED 2026-09-19 (Buffy-verified, supersedes the OpenRouter model hunt)
- User provided an OpenAI-compatible provider (vyceai): base URL
  `https://vyceai.com/v1`, model `agnes-3.0-flash`. Buffy verified with ONE
  user-approved curl: HTTP 200, model responds, correct OpenAI-compatible shape.
- Render env at deploy: `OPENAI_API_KEY` + `OPENAI_BASE_URL=https://vyceai.com/v1`
  + `OPENAI_MODEL=agnes-3.0-flash` — the OpenAI-compatible path in `provider.ts`
  consumes these with zero code changes. Do NOT also set `OPENROUTER_API_KEY`.
- SECURITY: the raw key was found in `.agent/resource/ai_tutor_api.md` (git-tracked
  dir, public repo) — Buffy redacted it (user-approved), added `.agent/resource/`
  to `.gitignore` (verified ignored), stored the key ONLY in `backend/.env`
  (gitignored, verified). ⚠️ Treat the key as exposed — user should rotate it on
  the provider dashboard after the demo. Claude: never copy this key anywhere.

### Final gate before deployment
- D2 full run (backend typecheck+test; root typecheck+test+build) — ALL summaries
  pasted (BF6 rule). This also closes E6's re-run formality.
- Then follow `plan_for_claude_deployment.md` §3 (Render) / §4 (Vercel) — user-executed.

## Out of scope (deliberately deferred)
- PostgreSQL/production deployment (single backend system; spec allows dev SQLite).
- Any frontend visual work.
- Simulator beyond the existing supported gate set (spec requires 1–2 qubits; current MAX_QUBITS=8 is headroom, not a problem).
