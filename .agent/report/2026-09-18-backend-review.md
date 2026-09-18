# Report: QubitVerse Backend Review — 2026-09-18

Author: Buffy (planner/reviewer). Read-only inspection; no commands executed.
Scope: full repo inspection focused on `backend/`, cross-checked against
`backend-spec.md`, `CLAUDE.md`, `progress.md`, `PLAN.md`.

## 1. Architecture decision review

The repo evaluated Express + SQLite vs Supabase (spec's default suggestion).
**The chosen Express + TypeScript backend is the right call** because:

- The frontend already ships a tested state-vector simulator (`src/quantum/`) in
  TypeScript; the backend imports it directly (`backend/src/simulator/routes.ts`), so
  simulation math is identical front and back with zero duplication.
- Supabase edge functions (Deno) would require porting or duplicating that logic.
- No Supabase project/keys exist in the environment.
- Spec's own priority is "reuse existing code and dependencies whenever practical."

Risk to manage: SQLite is dev-grade. Fine for now (spec defers deployment), but the
schema init style (`CREATE TABLE IF NOT EXISTS` only) needs a migration layer before
production (Plan C4).

## 2. Verified solid ✅

| Area | Evidence |
|------|----------|
| Modular route architecture | `backend/src/routes.ts` — auth, lessons, simulate, quiz, circuits, ai, state all mounted under `/api` with `authenticate` |
| Quiz security: answers never leak | `backend/src/quizzes/routes.ts:69-71` strips `correct_index` from GET; `:79-109` ignores client-sent `correct`, re-scores server-side |
| Real simulator, correct results | `backend/src/simulator/routes.ts` uses `src/quantum/simulator.ts`; Bell/H tests documented in `progress.md`; seeded PRNG |
| AI provider abstraction | `backend/src/ai/provider.ts` — `AiProvider` interface; OpenAI-compatible (covers OpenRouter via baseUrl), Anthropic, stub; `resolveProvider()` env-based priority; keys server-side only |
| Per-request user key override not persisted | `backend/src/ai/routes.ts` `buildOverrideProvider` — single request, discarded |
| JWT auth + bcrypt | `backend/src/utils/jwt.ts`, `backend/src/auth/routes.ts:34,73`; production refuses to start without `JWT_SECRET` |
| Test suites exist | `backend/test/` — auth, quiz, progress, circuits, state, ai (88 passing claimed; reviewer did not execute) |
| Frontend contract documented | `src/services/api.ts` documents endpoint shapes; `VITE_API_BASE_URL` switches to HTTP API |

## 3. Problems found ❌

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | High | **Fake simulation result** — hard-coded uniform counts `{00:256, 01:256, 10:256, 11:256}` with TODO comment. Directly violates spec "never fake simulation results." | `backend/src/circuits/routes.ts:79-92` |
| 2 | High | **SQLite DB tracked in git** — `data/qubitverse.db` in changed files; contains `users.password_hash` (bcrypt) — credentials artifact in VCS. | git status; `backend/src/db/users.ts` |
| 3 | High | **FK constraints not enforced** — no `PRAGMA foreign_keys = ON` anywhere; all `FOREIGN KEY ... ON DELETE CASCADE` are decorative; orphan rows possible. | `backend/src/db/index.ts` (zero PRAGMA matches) |
| 4 | High | **`.gitignore` lacks `.env*`, `*.db`, `data/`; no `.env.example`** — spec §13 requires both; one `git add .` away from committing secrets. | `.gitignore`; glob for `.env*` returned 0 files |
| 5 | Medium | **XP/streak/achievements not server-side** — no XP column on users, no ledger, no award logic (spec §3: persist XP, streak, achievements; prevent duplicate XP). Client-computed values only. | searches for xp/streak/achievement in `backend/src` → only seed data |
| 6 | Medium | **Debug endpoints leak config** — `/api/debug/cors` returns env key names incl. VERCEL/CORS keys; `/api/debug/jwt` returns JWT secret length. Unauthenticated. | `backend/src/server.ts:48-65` |
| 7 | Medium | **Logout is theater** — deletes `sessions WHERE email = ?` (all devices), but rows are never inserted and JWTs stay valid (stateless). Spec: implement logout + session persistence. | `backend/src/auth/routes.ts:117-124`; no `INSERT INTO sessions` anywhere |
| 8 | Medium | **AI stub returns canned "real-looking" content** — spec §7: "return a clear configuration message instead of fake AI responses." | `backend/src/ai/provider.ts` StubProvider; `backend/src/ai/routes.ts:144` |
| 9 | Medium | **No rate limiting** on login/signup/AI; **no circuit JSON validation** on `/circuits/save` (stores arbitrary payload). | searches for rate/limit; `backend/src/circuits/routes.ts` save handler |
| 10 | Low | **No migrations** — schema only via `CREATE TABLE IF NOT EXISTS`; drift risk between environments. | `backend/src/db/index.ts:42+` |
| 11 | Low | Leftover debug script `backend/test-tsx5.ts` (prints sqlite export shapes); stray literal `echo ... >> CLAUDE.md` line accidentally pasted into CLAUDE.md text. | `backend/test-tsx5.ts`; `CLAUDE.md` |
| 12 | Low | Frontend Bearer-token attachment + 401 fallback behavior in `createHttpApi` not fully verified (local fallback could mask backend failures in production flows). | `src/services/api.ts:188,213,381` |

## 4. Notes / context

- Schema already has 12 tables incl. `sessions`, `activities`, `tutor_messages`,
  `user_settings` — Phase B reuses `activities` rather than adding parallel tables.
- Seed content (`lessons`, `quizzes` with `correct_index`, `challenges` with `xp`) is
  seeded from `src/data/*` via `backend/src/db/seed.ts` — Phase B XP values must reuse
  these, not invent new ones.
- `CLAUDE.md` rules honored in planning: max 2 subagents, cheap models only, ask before
  deploy, preserve frontend, no fake data.

## 5. Recommendation

Proceed with `.agent/plan/plan_for_claude.md` Phase A → D. Highest-risk item to do
first: A1 (fake simulation) and A3 (git hygiene) — both are quick and one is a
spec-violation, the other a secret-leak risk.

— Buffy
