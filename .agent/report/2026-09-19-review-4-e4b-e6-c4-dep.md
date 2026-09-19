# Review #4 — E4b, E6 residual, C4, DEP pre-tasks — Buffy (2026-09-19)

Method: **read-only code verification** — no commands run, no source files touched.
Written artifacts only: this report, the dev plan, and the progress log. Note: the
code_search tool failed intermittently again this session (ENOTDIR on its ripgrep
binary, same flake as audit #3); every decisive finding below was confirmed by
direct file reads, and searches were re-run until results were consistent.

User context (recorded): the user initially said "Phase B", then clarified it was
said by mistake — the actual instruction was to **review Claude's progress to date
and plan what's next**. (Dev-plan Phase B was already Buffy-verified closed on
2026-09-18; nothing was re-audited under that heading.)

Scope: everything landed after Audit #3 — the E4b bootstrap fix, the E6
`video.chapters` residual, C4 (already marked done in the progress log, re-checked
against audit #3's stale "not started" line), and the deployment plan's pre-deploy
code tasks (DEP1–DEP3), since deployment planning is the active next stage.

---

## 1. Verdict table

| Item | Status | Evidence / gap |
|---|---|---|
| **E4b — lessons bootstrap (P0)** | ✅ **IMPLEMENTED** (audit pending final test evidence) | `main.tsx` bootstrap verified; test exists but doesn't test the bootstrap (see §2.3) |
| **E6 residual — `video.chapters`** | ✅ **DONE** | All 5 lessons filled in BOTH trees (§3) |
| **C4 — minimal migrations** | ✅ **DONE** (re-confirmed) | Runner + `schema_migrations` + 001/002 in place (§4); audit #3's "not started" line was stale |
| **DEP1 — `tsx` → dependencies** | ❌ **NOT DONE (P0)** | Still in `devDependencies` (§5.1) |
| **DEP2 — `trust proxy`** | ❌ **NOT DONE (P0 for free tier)** | No `app.set('trust proxy', ...)` in `server.ts` (§5.2) |
| **DEP3 — pin a live `:free` model id** | 🟡 **RESEARCHED, user must pick** | Current free list researched (§6) |

**Bottom line:** E4b and E6 — the last two deploy gates on the code side — are
implemented. **DEP1 + DEP2 are the only remaining code changes before the D2 full
run and deployment.** One test-quality gap (P1) and one low-risk build flag (P3)
are noted below.

---

## 2. E4b — lessons bootstrap: IMPLEMENTED ✅

### 2.1 The bootstrap exists (the audit #3 P0 is fixed)
`src/main.tsx` (read in full, 39 lines):
- imports `api, replaceLessons, API_BASE` from `./services/api`;
- defines `async function bootstrapLessons()` that **returns early unless
  `API_BASE` is set** (local-storage mode unaffected), then
  `await Promise.race([api.fetchLessons().then(replaceLessons, () => {}), new Promise(r => setTimeout(r, 1500))])`
  wrapped in try/catch;
- `await bootstrapLessons();` runs **before** `createRoot(container).render(...)`.

This matches the plan's §E4b acceptance shape exactly (install-before-first-render,
1.5 s race, downed backend falls back to bundled at ≤1.5 s cost). `await` at module
top level is valid because `main.tsx` is an ES module loaded by Vite.

### 2.2 A second copy exists in api.ts — harmless but redundant (P3)
`src/services/api.ts:515` also exports an identical `bootstrapLessons()`
(same guard, same race shape, without the timeout race's error swallow — actually
it awaits `api.fetchLessons()` directly, then calls `replaceLessons(lessons)`).
`main.tsx` defines its **own local copy** rather than importing this one.
Functionally equivalent; no user-visible difference. **Recommendation (P3,
optional):** delete the unused `api.ts` export OR have `main.tsx` import it — one
source of truth. Non-blocking; do not churn files for this before deploy.

### 2.3 ⚠️ P1 — the E4b unit test does not actually test the bootstrap
The plan's E4b acceptance: "Add ONE unit test (either test that bootstrap calls
`replaceLessons` with the normalized payload, **or extract a testable
`bootstrapLessons(api)` helper and test that**)."

What exists: `src/services/api.test.ts` has a `describe('replaceLessons (E4b
bootstrap)')` block — but its tests only exercise **`replaceLessons` itself**
(mutates `LESSONS`, updates `TOTAL_LESSON_XP`, updates `LESSON_MAP`). No test
imports or invokes `bootstrapLessons`, and nothing asserts that a fetched payload
gets installed. The comment in the file even says "The actual bootstrap integration
test would require mocking the entire browser environment… better covered by
end-to-end tests" — but the plan's second option (helper + DI) was explicitly
designed to avoid that mocking problem, and the helper ALREADY exists in
`api.ts:515` (it just isn't parameterized or tested).

Two acceptable closures (pick one, ≤30 lines):
- **(t1) Make `api.ts`'s `bootstrapLessons` testable and test it:** add an optional
  parameter `bootstrapLessons(deps = { api, replaceLessons, isHttp: Boolean(API_BASE) })`
  (or export an internal `bootstrapLessonsFrom(fetch, install)`), then unit-test:
  http-mode → installs fetched lessons; fetch throws → bundled list intact;
  non-http mode → no call. This is also the cleanest resolution of the P3
  duplication (main.tsx then imports the tested helper).
- **(t2) Minimal test on the existing export:** stub `globalThis.window` +
  monkey-patch `api.fetchLessons` (vitest `vi.spyOn`), call `bootstrapLessons()`,
  assert `LESSONS` got replaced and that a throwing fetch leaves it untouched.
  (t1 is preferred — t2's window-stubbing is brittle.)

Also note: `noUnusedLocals: true` is on; the unused export is fine (exports aren't
flagged), but if (t1) is chosen, `main.tsx` should drop its local copy in the same
edit so nothing drifts.

**Verdict:** E4b code is correct and the P0 from audit #3 is genuinely fixed. The
missing test is a plan-acceptance gap (P1), not a runtime defect. I will not
require it as a deploy gate — but it SHOULD land before the "E4 closed" stamp,
per the plan's own acceptance text. DEP1/DEP2 can proceed in parallel.

---

## 3. E6 residual — `video.chapters`: DONE ✅

All five lessons now carry real chapters in BOTH trees (drift-guarded by E3):

- Frontend `src/data/lessons.ts`: `chapters` arrays at lines ~50, 138, 226, 313, 403
  (one per lesson video). Spot-read `qubits`: 4 chapters
  (`0:00 What is Quantum Computing?`, `6:00 Classical Bit vs Qubit`,
  `13:00 Quantum States`, `21:00 Measurement`) — labels match that lesson's
  `outline` items 1:1, `at` values are mm:ss strings. ✅ matches plan §E6
  ("fill from each lesson's outline").
- Backend `backend/src/data/lessons.ts`: `chapters` at lines ~49, 137, 225, 312, 402 —
  same shape, same positions. The E3 drift test guards equality, so a re-run of the
  content suites covers cross-tree consistency.
- `chapters: []` no longer appears anywhere in either tree (searched both dirs).

**Residual formality (BF6 rule):** the suites must be re-run with summaries pasted
into the progress log before E6 flips to `[x]` — this folds into the D2 full run
(below). No further code change expected.

---

## 4. C4 — minimal migrations: DONE (re-confirmed) ✅

Audit #3's §6 listed C4 as "still open / not started" — that line was **stale**: the
progress log's C4 entry (marked `[x]` with a 156/156 green run) is accurate, and the
code confirms it:

- `backend/src/db/index.ts:70` `runMigrations(db)` creates the `schema_migrations`
  table, reads applied versions, applies pending migrations, records them
  (INSERT at :95); `rollbackMigration` (:117) and `getMigrationStatus` (:128) exist;
  `initializeDatabase` calls `runMigrations` (:185).
- Migrations exist: `backend/src/db/migrations/001_initial_schema.ts`,
  `002_add_last_active_date.ts` (the Phase B ALTERs live here, as the plan wanted).
- `backend/test/migrations.test.ts` covers the runner (4/4 green in the last full run).

**No further C4 work.** (Also moot for deployment: with an ephemeral free-tier DB,
every boot seeds fresh — C4 was already removed from the deploy gates.)

---

## 5. Deployment pre-tasks (from `plan_for_claude_deployment.md` §2)

### 5.1 ❌ DEP1 (P0) — `tsx` is still a devDependency
`backend/package.json` (read in full): `"start": "tsx src/server.ts"` and
`"tsx": "^4.23.13"` sits in **devDependencies**. On Render, if deps install in
production mode (`--omit=dev`), the service **cannot boot**. This is the single
most likely "deploys fine but crashes at start" failure. Fix is one line: move
`tsx` into `dependencies` (leave `typescript`/`vitest` in dev — they're not needed
at runtime). Optional verification (needs user approval per the no-command rule):
`cd backend && rm -rf node_modules && npm ci --omit=dev && npm start` → `/health` 200.

### 5.2 ❌ DEP2 (P0 for the free tier) — no `trust proxy`
`backend/src/server.ts` has **no** `app.set('trust proxy', ...)`. Consequence on
Render free: every request arrives via Render's proxy, so express sees one shared
IP and the auth limiter (10 attempts / 15 min) becomes a **global lockout** — every
user shares the bucket. Worse than no rate limiting for a demo. Fix is one line
plus a comment: `app.set('trust proxy', 1)` before the limiter middleware is
registered. Existing `rate-limit.test.ts` stays green (no proxy headers locally →
behavior unchanged). Note the deployment plan's file numbers DEP2 as CORS
multi-origin and DEP3 as trust-proxy — the **progress log's free-tier revision is
authoritative** (trust proxy = DEP2-critical, CORS multi-origin demoted to
optional DEP4); this review follows the log's numbering.

### 5.3 🟡 DEP3 — OpenRouter `:free` model id: researched today (§6), user picks one

### 5.4 DEP4 / DEP5 — correctly skipped
CORS multi-origin parsing and `render.yaml` are optional per the free-tier plan.
Single-origin `CORS_ORIGIN` is correct for this deploy; skip both.

---

## 6. DEP3 research — currently available OpenRouter free models (web-checked 2026-09-19)

Free-model ids rotate; as of today the `:free` list (~23 models) is led by:
- `deepseek/deepseek-v4-flash-0731:free` (hmm — id as surfaced by OpenRouter's own
  pages: "DeepSeek V4 Flash 0731 (free)"; exact slug must be confirmed on the model
  page before setting the env var)
- `qwen/...:free` — Qwen3.8 27B (free), listed as a strong free coding option
- `nvidia/...:free` — NVIDIA Nemotron leads one recent free-tier roundup
- The previously-common `deepseek-r1:free`, `llama-3.3-70b:free`,
  `llama-4-scout:free` ids are reported NO LONGER free (May 2026 roundup) — do not
  reuse the `.env.example` placeholder blindly.

**Recommendation:** pick ONE of the above after confirming its exact id on
https://openrouter.ai/models (filter: free) at deploy time — the id must be copied
verbatim into `OPENROUTER_MODEL`. The tutor prompt is short and structured, so any
of these is adequate; prefer a chat/general model over a reasoning-only one for
latency. One approved curl (or the post-deploy checklist item §6.11) verifies it.

Also noted: `backend/.env.example` currently ships
`OPENROUTER_MODEL=google/gemini-2.0-flash-lite` (no `:free` suffix) as a placeholder
— harmless (it's an example file), but the deploy checklist should not copy it
verbatim; a `:free` id is required for the $0 budget.

---

## 7. Two pre-existing defects re-checked (no regression, still open as P2/P3)

1. **`youtubeId` holds a full URL, not a bare id** — `src/data/lessons.ts:44`:
   `youtubeId: 'https://youtu.be/eJmBXYV2OWw'`. The type comment (`types.ts:151`)
   says full URLs are accepted and the player handles both, and the E4 normalizer
   round-trips it, so this is **not a defect** — recorded here only so nobody
   "fixes" it into a bare id mid-deploy and breaks the player mapping. Leave as-is.
2. **`youtubeId` fields across both trees stay in lockstep** — E3 drift test covers
   `video.youtubeId`; no drift found in the spot-reads.

---

## 8. Recommended execution order (next for Claude)

1. **DEP1 (P0)** — move `tsx` to `dependencies` in `backend/package.json`; paste
   the diff. (One line; zero risk.)
2. **DEP2 (P0)** — add `app.set('trust proxy', 1)` to `backend/src/server.ts` with
   the proxy-IP comment; run `rate-limit.test.ts` and paste the summary.
3. **E4b test (P1)** — close §2.3 via option (t1) (testable helper + 2–3 unit
   tests; optionally delete the duplicate helper so `main.tsx` imports the tested
   one). Paste the vitest summary for `api.test.ts`.
4. **User decision: DEP3 model id** — pick the `:free` id from §6 (confirm verbatim
   on openrouter.ai); record it in the progress log; it becomes `OPENROUTER_MODEL`.
5. **Final D2 full run** — backend `npm run typecheck && npm test`, root
   `npm run typecheck && npm test && npm run build`; paste ALL summaries (BF6 rule).
   This simultaneously closes E6's re-run formality.
6. **Then deployment per `plan_for_claude_deployment.md`** — §3 Render setup and §4
   Vercel wiring are USER-executed dashboard steps (each gated on explicit user
   confirmation); Claude assists with env-var values and runs the §6 checklist
   verifications against the live URLs afterwards.

Suggested Claude progress-log entries: one per numbered item, each with its diff or
summary, per the BF6 rule.

## 9. Process notes

- No commands were run; no source files were modified by Buffy. Written artifacts:
  this report, `plan_for_claude.md` (header + §DEP + C4 status correction), and
  `.agent/progress/plan_progress_claude.md` (Review #4 entry + next order).
- code_search failed intermittently (ENOTDIR on the ripgrep binary) exactly as in
  audit #3; all conclusions above rest on direct file reads and repeatable searches.
- The `video.chapters` verification and the C4 code check contradict nothing in the
  progress log; the only stale artifact found was audit #3's own §6 line about C4 —
  corrected in the dev plan this session.

— Buffy
