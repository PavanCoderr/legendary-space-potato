# Render Deploy Attempt #2 — DATABASE_URL boot guard — Buffy (2026-09-19)

Follow-up to `2026-09-19-render-glibc-deploy-failure.md` (attempt #2, same commit
`1dd7b0e`, after the user applied the DEP6a build-command fix). **No commands run,
no source files touched.** Artifacts updated: this report, both deployment plans,
progress log.

## 1. What the new log shows

- **DEP6a VERIFIED WORKING:** build command `npm ci --build-from-source=sqlite3`
  ran **1m10s** (vs ~2s with prebuild download) → sqlite3 compiled on Render's
  image. Boot got past the `sqlite3` dlopen — **no `ERR_DLOPEN_FAILED` anywhere**.
  The GLIBC issue is closed.
- **JWT_SECRET guard PASSED** (`server.ts:42`) → `NODE_ENV=production` and
  `JWT_SECRET` are set correctly by the user.
- **New crash — `server.ts:46-49`:**
  `[server] FATAL: DATABASE_URL or POSTGRES_URL must be set in production` → exit 1.

## 2. Root cause — a defect in MY deployment plan, not the code

The free-tier plan said "leave `DATABASE_URL` UNSET so the default
`./data/qubitverse.db` is used". That advice conflicts with the actual production
boot guard in `backend/src/server.ts` (lines 40–50), which hard-requires
`DATABASE_URL` **or** `POSTGRES_URL` whenever `NODE_ENV=production`. I verified the
JWT_SECRET guard when writing the plan but missed this second check. The runtime
code itself is consistent: `db/index.ts` uses `DATABASE_URL` as a **SQLite file
path** — so the correct action is to set it, not to change code.

## 3. Fix (USER, ~1 minute — zero code change)

Render dashboard → backend service → **Environment** → add:

- `DATABASE_URL` = `/tmp/qubitverse.db`

Save (auto-redeploy). Rationale:

- It is a plain local file path — satisfies the guard, keeps the accepted
  ephemeral-SQLite posture (no Postgres, no disk, boot-seeded fresh DB).
- `/tmp` chosen as guaranteed-writable; `./data/qubitverse.db` would work too
  (the DB layer `mkdirSync`es its directory), but `/tmp` removes all doubt.
- NOT a secret; no rotation/care needed.

## 4. Verification that nothing else will trip at boot

- Searched all of `backend/src` for `FATAL`/`process.exit` boot guards: exactly
  TWO exist, both in `server.ts:40-50` — `JWT_SECRET` (✅ passing) and
  `DATABASE_URL` (fixed by §3). No further env guards.
- After the guard: `initializeDatabase()` → migrations (fresh DB → 001 applied) →
  `ensureTablesExist` → seed → listen on Render's `PORT`. All paths verified
  compatible with a fresh `/tmp` DB (dir auto-created; `resetDb` unlink is
  test-only).
- Non-fatal envs behave as documented: `CORS_ORIGIN` unset would fall back to
  localhost (no crash, but Part 4.3 CORS check would fail — user should still set
  it); missing AI vars → honest stub, no crash.

## 5. Artifacts corrected

- `plan_for_user.md`: gate note (GLIBC ✅ → new blocker), step 2.4, 2.5 env table,
  appendix 2.4/2.5 + gotcha table row, Do-NOT list ("don't set DATABASE_URL" was
  wrong — it is REQUIRED as a file path).
- `plan_for_claude_deployment.md` §1 (repo facts: boot guard recorded), §3 steps
  3–4 (env table row + rationale), §9 audit item 5.
- Progress log: dated entry.

— Buffy
