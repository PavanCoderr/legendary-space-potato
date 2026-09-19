# Review Report #3 — BF3 audit + Phase BF/E status verification

Author: Buffy · 2026-09-18 · Method: read-only code inspection (no commands run).
Note: ripgrep became unavailable partway through; the import-path diagnosis in §5 was
done by manual path resolution against the actual directory layout.
Scope: `backend/src/challenges/routes.ts`, `backend/test/challenges.test.ts`,
`backend/src/routes.ts`, `backend/src/users/routes.ts`, `backend/src/db/index.ts`,
`backend/src/rewards/index.ts`, `backend/src/auth/routes.ts`, `backend/src/middleware/auth.ts`,
both `data/quizzes.ts` trees, both `content.test.ts` files, test helpers/configs.

---

## 1. BF3 verdict — GOOD, ship-quality with 3 minor notes

Claude's challenge-submission endpoint is a real, honest implementation:

| Requirement | Verdict | Evidence |
|---|---|---|
| Real simulation, no fake results | ✅ | `deserializeCircuit` → `simulate` (`challenges/routes.ts:73–77`); no hard-coded numbers anywhere in the file |
| Server-side evaluation only | ✅ | Request-body `passed` is never read; checks come from `challenge.validate()` (`challenges/routes.ts:80`); explicit spoof test in `challenges.test.ts` |
| XP idempotent | ✅ | Via `awardXp` → `xp_ledger` UNIQUE; "awards XP only once" test asserts `xpAwarded: 0` on resubmit |
| Attempts recorded | ✅ | `INSERT INTO challenge_attempts` with serialized checks (`challenges/routes.ts:87–98`) |
| Auth posture | ✅ | GET public, POST 401s unauthenticated; test covers both |
| Test quality | ✅ | 15 substantive tests: H-fails-bit-flip, empty-circuit-fails, wrong-gate-order, seed determinism, idempotency, unknown-gate 400 |

Minor notes (all P2, none block Phase C):

- **N1:** `GET /api/challenges` returns the full `CHALLENGES` objects **including `solutionCode`** (e.g. `qc.x(0)`) to unauthenticated callers (`challenges/routes.ts:33–37`). Not a regression — the frontend tree ships the same strings locally — and XP cannot be forged from it because validation is server-side. But it trivializes challenges for API users. Recommend omitting `solutionCode` (and optionally `hints`) from the public payload.
- **N2:** `shots` is uncapped — `Math.max(1, Math.floor(reqShots ?? challenge.shots))` accepts `shots: 10_000_000` and pins the CPU (`challenges/routes.ts:68`; same pattern in `simulator/routes.ts`). Clamp (e.g. ≤ 100,000) in both.
- **N3:** `challenge_attempts.xp_awarded` is always written `0` even on pass — the insert precedes `awardXp` and is never updated (`challenges/routes.ts:95`). The ledger and the attempts table disagree. Update the row after awarding (or compute first).
- N4 (nit): the `/challenges` chain uses inline `getUser()` + 401 instead of `requireAuth` (`routes.ts:26–28`). Enforcement exists, so the audit-1 concern doesn't apply — but the codebase convention is the middleware chain.

---

## 2. Status corrections — BF1/BF2/BF4/E1 are DONE in code but unmarked

`plan_progress_claude.md` still shows BF1/BF2/BF4 unchecked. Verified implemented:

- **BF1:** `GET /state` now loads `user_snapshots`, spreads it first, then overrides
  server-authoritative `user` / `xp` / `streak` / `levelInfo` / `recentXp` / `activities` /
  `circuits` (`users/routes.ts` GET handler, ~lines 50–93). Matches the audit-2 §F1 merge
  exactly. `PUT` uses a proper upsert (`ON CONFLICT(user_id) DO UPDATE`).
- **BF2:** `achievements` is `string[]` on the snapshot path with a server-id fallback
  (`users/routes.ts` ~71–79).
  - **P2 edge:** when the stored snapshot carries `achievements: []`, `[].every(...)`
    returns `true`, so the empty array wins and **server-awarded ids are dropped** — a
    user whose achievements were recorded server-side while their client snapshot lagged
    hydrates an empty list. Recommend a union: `[...new Set([...snapshotIds, ...serverIds])]`.
- **BF4:** dedupe + `CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_ledger_unique` exist — but
  **twice** (in `migrateDatabase` and again in `initializeDatabase`). The dead empty `if`
  block is gone; `user_snapshots` DDL is in `initializeDatabase`. See §3 for the defect.
- **E1:** the corrected Born-rule explanation is applied in **both** trees
  (`backend/src/data/quizzes.ts:17–18` and `src/data/quizzes.ts:17–18`), matching plan E1
  word-for-word. Both E1-marker tests should now pass. Remaining: runtime reseed +
  `GET /api/quiz/qubits-1` verification (needs an approved command run).

---

## 3. BUG (P1) — BF4's `migrateDatabase` copy crashes startup on legacy databases → new task **BF4a**

`backend/src/db/index.ts`:

1. `initializeDatabase()` calls `migrateDatabase(db)` **first** (~line 88), before any
   `CREATE TABLE`.
2. `migrateDatabase` early-returns only when the `users` table doesn't exist (fresh DB —
   the `userColNames.length === 0` guard saves fresh DBs).
3. On a **legacy** DB (created before Phase B — e.g. the tracked `data/qubitverse.db`, or
   any deployed volume): `users` exists → no early return → ALTERs run → then
   `DELETE FROM xp_ledger` (~line 68) throws **`no such table: xp_ledger`** →
   `initializeDatabase` rejects → **server startup fails**.

The exact scenario BF4 was meant to support (pre-existing databases) is the one that
crashes. A second latent bug hides in the same block:

- The dedupe `GROUP BY user_id, source_type, source_id, amount` **includes `amount`**, so
  two rows sharing `(user, type, source)` but differing in amount both survive the dedupe —
  and then `CREATE UNIQUE INDEX` fails. Drop `amount` from the GROUP BY.
- Also note `MIN(rowid)` keeps the **oldest** row; audit-2 said keep the latest
  `created_at`. Decide which is intended and document it (keeping the oldest award is
  defensible since amounts may differ — just be explicit).

**Recommended fix (small):** delete the xp_ledger block from `migrateDatabase` entirely —
`initializeDatabase` already runs the identical dedupe + `CREATE UNIQUE INDEX IF NOT
EXISTS` **after** `CREATE TABLE IF NOT EXISTS xp_ledger`, which is correct for fresh AND
legacy DBs (the table is guaranteed to exist at that point). Keep the `users` ALTER guards
in `migrateDatabase`. Then add a regression test: create a legacy-shaped DB (users without
`xp`, no `xp_ledger`, plus one duplicate pair of ledger rows), run `initializeDatabase`,
assert no throw and the index exists.

---

## 4. BF5 — one of three regression tests is missing

- XP idempotency ✅ (`backend/test/xp.test.ts` — same correct answer twice → no second
  award, `COUNT(*) = 1` on the ledger).
- Challenge pass-awards-once / fail-awards-none ✅ (`challenges.test.ts`).
- **/state round-trip ❌ MISSING** — `state.test.ts` PUTs a full snapshot but never asserts
  GET returns it, so BF1's acceptance ("PUT progress → GET → same progress back") is
  untested. Required test: PUT a snapshot with non-trivial `progress` and `currentCircuit`
  → GET → assert the same `progress`/`currentCircuit` come back, `achievements` is
  `string[]`, and server `xp` overrides any snapshot `xp`.

---

## 5. My own defect (owned): the content-test failure is my off-by-one import path

The file Claude reported failing ("content.test.ts import error") is **mine**, and the
frontend copy has the same bug:

- `backend/test/content.test.ts` imports `../../../src/data/...`. From `backend/test/`,
  `../../../` resolves **above the project root**. Correct: `../../src/data/...`.
- `src/data/content.test.ts` imports `../../../backend/src/data/...`. From `src/data/`,
  correct: `../../backend/src/data/...`.
- The comment in my backend file even asserts the wrong math
  ("`../../../src` from backend/test → `<root>/src`").

So E2/E3 have never actually run green anywhere. Claude was right to flag it; calling it
"pre-existing" was generous. The fix is 4 import lines + 1 comment across the two files —
**pending user approval** (no-edit rule; they are src-tree files). Until then, treat both
content tests as RED-for-the-wrong-reason, and note the root `npm test` suite
(`include: src/**/*.test.ts` matches `src/data/content.test.ts`) has never been run with
these files at all — **both suites** must be green before BF6 can claim honesty.

---

## 6. Other verified states

- **A5 end-to-end ✅:** login/signup insert session rows with `jti` (`auth/routes.ts`
  ~66–75 and ~106–113), logout deletes only the caller's `jti` (~158–168), middleware
  rejects revoked/expired sessions (`middleware/auth.ts:31–53`). Route tests sign jti-less
  tokens (acceptable), so confirm `auth.test.ts` actually exercises the logout-revocation
  path; if not, add it to BF5.
- **C1 is PARTIAL:** the auth limiter exists (10/15 min per IP, `AUTH_RATE_LIMIT_MAX`
  override, test-mode 1000) — `auth/routes.ts:8–25`. There is **no** limiter on
  `/api/ai/*`. Do not mark C1 done on the strength of the auth limiter alone.
- **E6 not started** (no new quiz ids in either tree) — correct per plan order.
- **E4 not started** — next after Phase BF closes; design doc is fully unblocked per the
  side-by-side verification report.

---

## 7. Priority order for Claude (next session)

1. **BF4a (P1):** remove the `migrateDatabase` xp_ledger block (or guard it), drop
   `amount` from the GROUP BY if kept, add the legacy-DB regression test.
2. **BF5:** the /state round-trip test (sketch in §4); check logout-revocation coverage.
3. **BF2 edge:** union snapshot ids with server-awarded ids (§2).
4. **BF3 N1–N3** as time allows (N1 recommended before calling challenges done).
5. **BF6:** update statuses honestly (B1/B2/B3 → done; BF1/BF2/BF4 → done after BF4a;
   E1 → done pending runtime reseed check) and paste **both** suites' vitest summaries.
6. Then Phase C in order (finish C1, then C2, C3, C4, C5 per plan).

---

## 8. Questions for the user

1. Approve me fixing my two content-test files (5 lines total), or assign to Claude?
2. Approve one read-only verification run (`cd backend && npm test`, then root `npm test`)?
   Needed to close E2/E3 and BF6 honestly.
3. A3 is still pending your call: `git rm --cached data/qubitverse.db` (the tracked DB
   contains password hashes and is the legacy-schema DB from §3).

— Buffy
