# Plan for Claude CLI — QubitVerse Backend Hardening & Completion

Written by Buffy (planner) 2026-09-18. Based on the review in
`.agent/report/2026-09-18-backend-review.md` — read that first for evidence and file:line
references.

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

## Phase B — XP, streak, achievements server-side (P0, spec §3)

Currently none of this is persisted server-side; the client computes it. Implement:

### B1. Schema (in `backend/src/db/index.ts`, keep the same init style for now)
- `users`: add columns `xp INTEGER NOT NULL DEFAULT 0`, `streak INTEGER NOT NULL DEFAULT 0`, `last_active_date TEXT` (UTC date string).
- New table `xp_ledger`: `id TEXT PK`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `source_type TEXT NOT NULL` (`lesson` | `quiz` | `challenge`), `source_id TEXT NOT NULL`, `xp INTEGER NOT NULL`, `created_at`, with `UNIQUE(user_id, source_type, source_id)` — this enforces the "prevent duplicate XP" rule at the DB level.
- New table `user_achievements`: `user_id`, `achievement_id`, `awarded_at`, `UNIQUE(user_id, achievement_id)`.
- Because there is no migration system yet, add a tiny guarded `ALTER TABLE ... ADD COLUMN` helper that tolerates "duplicate column" errors (Phase C4 replaces this with real migrations).

### B2. Award logic (server-side only, never trust client XP)
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

### C1. Rate limiting
- Add `express-rate-limit` (new backend dependency, justified): strict limit on `POST /api/login` and `POST /api/signup` (e.g. 10/15min per IP), looser on `/api/ai/*` (e.g. 30/15min per user). Return 429 with a JSON error the frontend already displays.

### C2. Validate circuit JSON on save
- `backend/src/circuits/routes.ts` `POST /save`: validate the circuit payload before persisting — reuse `isGateType` and `parseCode`/serialization helpers from the shared quantum module (`src/quantum/`); reject unknown gates, out-of-range qubits, oversized payloads (also cap `json` body limit appropriately).

### C3. AI stub honesty (spec §7)
- `backend/src/ai/provider.ts` `StubProvider` / `backend/src/ai/routes.ts`: when no provider is configured, return a clear "AI tutor is not configured — set OPENAI_API_KEY (or ANTHROPIC/OPENROUTER) on the server" message instead of canned tutor content. The `provider`/`model` fields already exist in `TutorResponse` — mark stub responses clearly. Provider failure (network/auth error) → 502-style JSON error with `error` field, no fake content.

### C4. Minimal migrations
- Introduce `backend/src/db/migrations/` with numbered SQL/TS migrations + a `schema_migrations` table; make `initializeDatabase()` run pending migrations. Move the Phase B `ALTER TABLE` guards into migration 002. Do not adopt an ORM — keep it dependency-light.

### C5. Frontend auth integration check (minimal changes only)
- Verify `src/services/api.ts` `createHttpApi` sends `Authorization: Bearer` on every call and handles 401 by surfacing "session expired" rather than silently falling back to local mock logic in production flows. Only touch this file if a real integration gap exists; no UI changes.

---

## Phase E — Learning content fixes (P0 for the math error; P1/P2 otherwise)

Evidence for every item: `.agent/report/2026-09-18-learning-content-review.md`. Read it
before starting. Content edits must be applied to BOTH `src/data/` and
`backend/src/data/` (identical trees) until E3 removes the duplication.

### E1. Fix the wrong quiz explanation (P0, math error)
- `src/data/quizzes.ts` AND `backend/src/data/quizzes.ts`, quiz `qubits-1`.
- The state `0.6|0⟩ + 0.8|1⟩` IS normalised (0.36 + 0.64 = 1). The current explanation
  "(and note that 0.6 + 0.8 ≠ 1)" implies the state is invalid and confuses amplitudes
  with probabilities.
- Replace the explanation text with: "The Born rule says the probability is the squared
  magnitude of the amplitude: |0.6|² = 0.36 and |0.8|² = 0.64, and 0.36 + 0.64 = 1, so
  the state is properly normalised. Note the amplitudes themselves do not sum to 1
  (0.6 + 0.8 = 1.4) — only their squared magnitudes must."
- The answer option stays unchanged (correct answer is still index 1).
- After editing, start the backend once so `INSERT OR REPLACE` reseeds the DB, then
  verify `GET /api/quiz/qubits-1` returns the corrected text.

### E2. Content sanity test (P0)
- Add `backend/test/content.test.ts`: for every quiz in `backend/src/data/quizzes.ts`,
  assert `correctIndex` is a valid option index, options are non-empty, and — where an
  amplitude state literal like `a|0⟩ + b|1⟩` with real numbers appears in the question —
  verify |a|² + |b|² = 1 (tolerance 1e-9). Add the mirrored simple checks for the
  frontend copy too (`src/data/` — a small vitest under src, matching existing test
  setup).
- Acceptance: the test fails on the pre-E1 text and passes after E1 — do E1 first,
  run the test, then commit both.

### E3. Stop the two-tree drift (P1)
- Add a test (in the same content test file) that deep-compares the content-critical
  fields between `src/data/lessons.ts`+`quizzes.ts`+`challenges.ts` and the backend
  copies: ids, titles, xp, quizIds, challengeId, video.youtubeId, and every quiz
  question/options/correctIndex/explanation.
- Do NOT restructure imports (no redesign rule). This test converts silent drift into a
  loud failure.

### E4. Backend must serve the full lesson payload (P1)
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
- Add `GET /api/challenges` and `GET /api/challenges/:id` reading `challenges` +
  `challenge_objectives` + `challenge_hints` (data is already seeded; no route reads it).
- Add `GET /api/glossary` and `GET /api/achievements` — move the frontend glossary and
  achievements data into the backend seed (respecting E3's no-drift test), served as
  static reference data.

### E6. Content depth (P2 — only after E1–E5) — ✅ APPROVED by user 2026-09-18
- Implement the 12 approved quiz questions EXACTLY as written in
  `.agent/report/2026-09-18-e6-quiz-draft.md` (ids, options, correctIndex, explanations,
  XP — no rewording). Add to BOTH `src/data/quizzes.ts` and `backend/src/data/quizzes.ts`.
- Fill `video.chapters` from each lesson's `outline` items (both trees).
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

## Out of scope (deliberately deferred)
- PostgreSQL/production deployment (single backend system; spec allows dev SQLite).
- Any frontend visual work.
- Simulator beyond the existing supported gate set (spec requires 1–2 qubits; current MAX_QUBITS=8 is headroom, not a problem).
