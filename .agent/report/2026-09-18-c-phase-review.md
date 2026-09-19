# Phase C Review + D1 Coverage Audit — Buffy (2026-09-18)

Purpose: verify the Phase C work that appeared in parallel since the last audit
(BF4a closure), audit D1 test coverage, and re-confirm Phase E status.
Method: **read-only** — no commands run, no source files touched. Every claim below
was verified against the current file contents, with file:line references.

---

## 1. Phase C status — verified against code

### C1 — Rate limiting: ✅ DONE (verified)
- AI limiter now exists in `backend/src/routes.ts` (~lines 16–25): 30 req/15 min,
  `keyGenerator` = `user.id ?? ip`, mounted **after** `authenticate` on `/api/ai`
  (routes.ts ~line 41). Test mode raises the cap to 1000 so other suites don't trip it.
- Auth limiter unchanged (10/15 min/IP, `AUTH_RATE_LIMIT_MAX` override), covered by
  `test/rate-limit.test.ts` (login burst → 429).
- `express-rate-limit@8.7.0` present in `backend/package.json` — the one new
  dependency the plan justified. Both acceptances met. **C1 CLOSED.**

### C2 — Circuit save validation: ⚠️ IMPLEMENTED BUT BROKEN — see Finding F1 (P0)
Validation code exists in `backend/src/circuits/routes.ts` (~lines 127–134) but the
severity filter is applied to the wrong type. Details in §2.

### C3 — AI stub honesty: ✅ DONE with one deviation (verified)
- `StubProvider` (`backend/src/ai/provider.ts` ~lines 232–262) returns an honest
  "not configured" message naming the three env vars — no canned tutor content. ✓
- `TutorResponse` carries `provider`/`model` (routes.ts ~line 31) and the routes
  surface them. ✓
- Provider failure → caught in `generateTutorResponse`, returns `error` field +
  honest text, no fake content (ai/routes.ts ~lines 128–140). ✓
- **Deviation (F5, P2):** plan asked for a "502-style JSON error" on provider
  failure; current code returns HTTP 200 with the error embedded. Honest, but not
  the status code the plan specified. Decision needed — see §2.
- Per-request user-supplied keys are used for one request only, never persisted
  (documented in code). Keys never reach the frontend from the server. ✓
- Tests (`test/ai.test.ts`): stub honesty, resolveProvider fallback, missing-key
  throws for both providers, connection-error path via invalid base URL (no real
  API hit). Matches plan D1's AI requirements. ✓

### C4 — Minimal migrations: ❌ NOT STARTED
No `backend/src/db/migrations/` directory exists (only `seed.ts`, `index.ts`,
`users.ts`). The guarded-ALTER approach from Phase B is still what runs. Plan item
stands as written.

### C5 — Frontend auth integration: ✅ DONE (verified — all 3 pre-identified gaps fixed)
Re-checked `src/services/api.ts` against my three findings in
`2026-09-18-side-by-side-verification.md` §3:
- **C5-a fixed:** `saveState` now re-throws on 401 ("Session expired") and only
  keeps the local copy for non-auth failures. ✓
- **C5-b fixed:** `runSimulation` now forwards `seed` alongside `shots`. ✓
- **C5-c (submitQuiz):** 401 now surfaces; non-401 still falls back to local with a
  warning — that is the app's offline-tolerant design and beyond the plan's 401
  requirement. Acceptable; no action.
- Bearer header on all calls, 401 → "Session expired" surfacing in `post`,
  `handleResponse`, and every catch path. No UI/component changes. **C5 CLOSED.**

---

## 2. New findings (this session)

### F1 (P0) — C2 validation never rejects anything, and likely breaks typecheck
`backend/src/circuits/routes.ts` (~lines 128–129, in `POST /save`):

```ts
const { circuit: qc, issues } = deserializeCircuit(circuit, 'Saved Circuit');
const errors = issues.filter(i => i.severity === 'error');
```

`deserializeCircuit` returns `issues: string[]` (`backend/src/quantum/circuit.ts`,
~lines 300–340) — its elements have **no `.severity` property**. Consequences:

1. `i.severity` is `undefined` for every element → the filter is always empty →
   **`errors.length > 0` is never true → invalid circuits are saved unvalidated.**
   `deserializeCircuit` silently *drops* unknown gates and out-of-range ops while
   appending an issue string, so a garbage payload can even end up saved as an
   empty circuit with HTTP 201.
2. Under `strict: true` (`backend/tsconfig.json`), accessing `.severity` on
   `string` should be **TS2339** — i.e. `npm run typecheck` is expected to FAIL on
   this line right now. Vitest doesn't catch it because esbuild strips types
   without checking. **I have not run typecheck (no-command rule) — Claude or the
   user should run `cd backend && npm run typecheck` to confirm.**

**Fix (for the plan, C2a):** treat every issue string as an error (mirroring the
simulate route and the challenges route, which both do `issues.length > 0`
correctly), and additionally run `validateCircuit(qc)` (which returns the typed
`CircuitIssue[]` with `severity`) to catch same-column wire conflicts that
`deserializeCircuit` does not detect:

```ts
const { circuit: qc, issues } = deserializeCircuit(circuit, 'Saved Circuit');
const conflictErrors = validateCircuit(qc)
  .filter(i => i.severity === 'error')
  .map(i => i.message);
const allIssues = [...issues, ...conflictErrors];
if (allIssues.length > 0) {
  res.status(400).json({ success: false, error: `Invalid circuit: ${allIssues.join('; ')}` });
  return;
}
```

### F2 (P1) — D1 test gaps (three required tests are missing)
Searched `backend/test/` for each D1 item. Present vs missing:

| D1 item | Status |
|---|---|
| FK cascade (delete user → dependents gone) | ✅ `xp.test.ts:80` |
| XP idempotency | ✅ `xp.test.ts` |
| Challenge pass/fail XP | ✅ `challenges.test.ts` (15 tests) |
| Logout revocation + other-device-stays-valid | ✅ `auth.test.ts` (~lines 168–215) — **closes the BF5 minor open item** |
| AI stub/error handling | ✅ `ai.test.ts` |
| Rate limit 429 | ✅ `rate-limit.test.ts` |
| **Bell circuit via `/api/circuits/:id/simulate` → only `\|00⟩`/`\|11⟩`** | ❌ MISSING — only a 404 test exists (`circuits.test.ts:196`). A1's acceptance test was never written. |
| **Circuit save validation (unknown gate / bad qubit rejected)** | ❌ MISSING — and blocked by F1 anyway. |
| **Streak: consecutive-day increment; gap reset** | ❌ MISSING — `streak` only appears in state-shape assertions, never a day-transition test. |

### F3 (P1) — `shots` still uncapped everywhere (N2, still open, verified)
`Math.max(1, Math.floor(shots))` with no upper bound in:
`circuits/routes.ts` (~line 88), `simulator/routes.ts` (~line 47),
`challenges/routes.ts` (~line 70). A `shots: 10_000_000` request is CPU-boundable.
Fix: `Math.min(shots, 10_000)` (or an env-configurable `MAX_SHOTS`) in all three.

### F4 (P2) — Challenge route follow-ups N1/N3 still open (verified)
- **N1:** `GET /api/challenges` and `GET /:id` return the raw `CHALLENGES` objects
  (`challenges/routes.ts` ~lines 29–42), which include `solutionCode`
  (`data/challenges.ts` lines 85, 136, 196, 272, 325) — the solution source is
  public. Strip it (and consider also hiding nothing else; `validate` is a function
  and vanishes in JSON).
- **N3:** `challenge_attempts.xp_awarded` is hard-inserted as `0`
  (`challenges/routes.ts` ~line 77) even when XP is then awarded. Write the real
  value after the `awardXp` call (UPDATE or reorder the insert).

### F5 (P2) — C3 provider-failure status code: decide
Current: HTTP 200 + `error` field + honest message text. Plan: "502-style JSON
error". Options: (a) keep 200 (frontend renders the text either way — minimal
change), or (b) return 502 with `{ error }` and have the frontend surface it.
Recommend (b) only if the frontend's `askTutor` error path displays server errors —
otherwise (a) is fine. Ask Claude to state which and why in the progress log.

### F6 (P2) — Lesson `status` vs `completed_at` mismatch (pre-existing, noticed)
`lessons/routes.ts` (~lines 120–135): `status='completed'` requires 5 flags
(excluding `challenge_passed`) but `completed_at` requires all 6 — so a lesson can
be `completed` with a NULL `completed_at`. Also XP is awarded on the 5-flag
condition. Not a regression; flag for a deliberate decision (probably: completion =
5 flags, completed_at on the same condition).

### F7 (P2) — 10 MB JSON body limit
`server.ts` line 16: `json({ limit: '10mb' })`. Circuits are small; 1 MB is plenty
and shrinks the DoS surface. Trivial change, batch with F3.

---

## 3. Phase E status (re-verified)

- **E1/E2/E3:** ✅ already green (previous approved run; E1 text confirmed in both
  trees this session — `backend/src/data/quizzes.ts:18` wording matches).
- **E4:** ❌ NOT STARTED. `GET /api/lessons` still returns thin rows
  (`lessons/routes.ts` — `res.json(lessons)`, no unpack), and `src/main.tsx` is
  still the original bootstrap (no `replaceLessons` swap). Implement from
  `2026-09-18-e4-design.md` + §2 of the side-by-side report (startCircuit rebuild
  is REQUIRED).
- **E5:** ✅ effectively closed by E3's drift tests + existing routes (re-scoped
  previously). Nothing left beyond Claude confirming route coverage once.
- **E6:** ❌ NOT STARTED. `backend/src/data/quizzes.ts` still has exactly the 10
  original questions — the 12 approved ones (qubits-3…5, superposition-3…5,
  entanglement-3…4, gates-3…4, algorithms-3…4) are absent in both trees, and
  `video.chapters` is unfilled. All 12 were pre-verified 12/12 against the
  simulator — implement exactly as drafted.

---

## 4. Recommended execution order for Claude

1. **C2a (P0)** — fix F1 in `circuits/routes.ts`, run `npm run typecheck` (should
   have been failing), add the two missing save-validation tests.
2. **F3+F7 (P1/P2, one commit)** — shots caps + body limit; then N1/N3 challenge
   follow-ups (F4).
3. **E4** — from the design doc (backend unpack + frontend normalizer + 3-line
   main.tsx bootstrap).
4. **E6** — 12 questions, both trees, plus `video.chapters`.
5. **D1 gap tests** — Bell-simulate regression, streak day-transition.
6. **D2** — full green run (backend + root typecheck/test/build), paste vitest
   summaries in the progress log, then claim Phase C/E/D complete.

## 5. Process notes

- The progress file's C1 entry ("PARTIAL") is stale — the AI limiter exists; I've
  updated the statuses in this session's progress-file edit.
- Scope boundary: `users/routes.ts` and `middleware/auth.ts` were not re-diffed
  this session beyond the earlier BF4a/BF2-edge verification; no changes were
  reported for them since.
- No source files were modified by Buffy; only this report, the plan, and the
  progress log were written.

## 6. Postscript — typecheck run (user-approved, same day)

One approved command: `cd backend && npm run typecheck` → **exit 0, clean.**
Re-reading `circuits/routes.ts` after the run shows the file changed since §2 F1 was
written: the save handler now reads `if (issues.length > 0)` and returns
`400 Invalid circuit: ${issues.join('; ')}` — i.e. the §C2a fix was applied in
parallel by Claude between my review read and the typecheck. Conclusion:

- **F1 severity-filter defect: FIXED and typecheck-verified.** My TS2339 prediction
  was correct for the old code state and is now moot — the wrong-type filter is gone.
- **Residual (P3, non-blocking):** the handler still does not call
  `validateCircuit(qc)`, so two ops on the same wire in the same column can still be
  saved (each op is individually valid; `deserializeCircuit` does not detect wire
  conflicts). Low risk since the simulator serializes by column, but worth the one
  extra line when Claude is next in this file.
- **Still open for C2 closure:** the three save-validation tests (unknown gate → 400,
  out-of-range qubit → 400, valid save → 201) — `circuits.test.ts` has none of them
  yet. That item stays in CG3.
- No TypeScript errors exist anywhere in `backend/src` — D2's backend typecheck half
  is green as of now (tests/build still pending).

— Buffy
