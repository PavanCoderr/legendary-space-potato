# Deployment Plan for Claude CLI — QubitVerse FREE-TIER Deploy (Hackathon)

Written by Buffy (planner) 2026-09-19. Revised same day for $0 budget per user decisions
(supersedes the paid-tier version). Separate from `plan_for_claude.md` (development).

## User decisions (2026-09-19, recorded)

- **Budget:** $0 — free tiers only.
- **Context:** hackathon project, not real production. **User explicitly accepts that
  the SQLite database is wiped on every redeploy/restart/spin-down.** No database
  migration (Turso/Postgres) will be done now.
- **Backend:** Render **free** web service, local SQLite file (as-is, no code change).
- **Frontend:** the user's **existing Vercel deployment** — wire it to the backend.
- **AI Tutor:** **OpenRouter free models** (`:free` model ids) — zero code changes,
  key lives in Render env only.

Ground rules (unchanged): **every deploy command or dashboard action requires explicit
user confirmation first.** Claude prepares code/config and runs read-only checks; the
user (or Claude with per-command approval) executes deploys. Update
`.agent/progress/plan_progress_claude.md` after each task. Every checklist item needs
pasted evidence before "deployed" may be claimed.

> **ACCEPTED LIMITATION (banner):** Render free tier has an ephemeral filesystem
> (per Render docs). All user accounts, progress, XP, and saved circuits are ERASED on
> every redeploy, restart, and idle spin-down (after ~15 min of no traffic). First
> request after sleep takes ~30–60 s (cold start). This is ACCEPTED by the user for
> hackathon use. Demo tip: register accounts live during the demo; don't rely on
> yesterday's data.

---

## 0. Ordering — do NOT start before the dev queue reaches these marks

Deployment starts only after ALL of the following are done in `plan_for_claude.md`:

1. **E4b — lessons bootstrap (P0)** — REQUIRED (the app must actually use backend lessons).
2. **E6 residual — `video.chapters`** — REQUIRED (small; keeps the demo content complete).
3. **D2 — full green run** (backend + root typecheck/test/build, summaries pasted) — REQUIRED.
4. ~~C4 (migrations)~~ — **NO LONGER A DEPLOY GATE.** With an ephemeral DB there is no
   persistent production schema to migrate; every deploy boots a fresh, seeded database.
   C4 stays in the dev plan for code quality, do it whenever, just not as a deploy blocker.

Reason for the remaining gates: E4b changes what the app loads at startup — deploying
without it means the demo shows bundled lessons only; D2 protects against shipping a
broken build.

---

## 1. Repo facts this plan is based on (verified 2026-09-19)

- Backend: Express 5, long-running server (`backend/src/server.ts`), file-based SQLite
  (`DATABASE_URL`, default `./data/qubitverse.db`), seeds content at boot
  (`initializeDatabase()` + `seedDatabase()`) — fresh DB seeds fine on each deploy.
  ⚠️ UPDATE 2026-09-19 (deploy attempt #2): `server.ts:40-50` is a PRODUCTION BOOT
  GUARD — with `NODE_ENV=production` it `process.exit(1)`s unless `DATABASE_URL` or
  `POSTGRES_URL` is set. On Render: `DATABASE_URL=/tmp/qubitverse.db` (SQLite file
  path — see §3). The DB layer consumes it as the sqlite filename.
- `server.ts` already: serves `/health`, requires `JWT_SECRET` in production, gates
  debug endpoints off in production, CORS from `CORS_ORIGIN`, respects `PORT`.
- `backend/package.json`: `"start": "tsx src/server.ts"` — `tsx` is currently a
  **devDependency**. Render does not set `NODE_ENV=production` automatically, so we
  WILL set it (required for the JWT_SECRET check + debug-endpoint gating), which means
  `npm ci` runs with devDeps available at build but the start command must still work
  reliably → DEP1 keeps this safe regardless of install mode.
- tsconfig emits CommonJS while the package is `"type": "module"` — do NOT switch the
  start command to plain `node dist/server.js`.
- Frontend: Vite SPA with **hash routing** (`#/...`) → no rewrite rules needed on
  Vercel. `VITE_API_BASE_URL` is read at **build time** → the existing Vercel project
  must be **redeployed** after setting the env var.
- Known code bug: `CORS_ORIGIN` docs say comma-separated but `server.ts` passes the raw
  string → only use ONE origin in prod (DEP2 makes multi-origin work, optional here).
- No Dockerfile / render.yaml / CI workflows exist (glob-verified 2026-09-19).

---

## 2. Pre-deploy code tasks (Claude implements; all small)

### DEP1 (P0) — Make the backend production-installable
- Move `tsx` from `devDependencies` to `dependencies` in `backend/package.json`.
- Verify (with approval): `cd backend && rm -rf node_modules && npm ci --omit=dev && npm start`
  → server boots, `GET /health` → 200.

### DEP2 (P1) — Correct client IPs behind Render's proxy (rate-limit correctness)
- `backend/src/server.ts`: add `app.set('trust proxy', 1)` with a comment why.
- WITHOUT this, every request behind Render's proxy shares one IP → the auth limiter
  (10 failed logins / 15 min) becomes a GLOBAL lockout affecting all users — worse
  than no limiting. With it, limiting works per real client IP.
- Test: existing `rate-limit.test.ts` must still pass (no proxy header locally →
  behavior unchanged).

### DEP3 (P1) — ✅ RESOLVED 2026-09-19 (Buffy, user-provided provider — supersedes the OpenRouter model hunt)
- User provided an OpenAI-compatible provider: base URL `https://vyceai.com/v1`,
  model `agnes-3.0-flash` (details: `.agent/resource/ai_tutor_api.md`, key redacted).
- Buffy verified with ONE user-approved curl: HTTP 200, correct response shape,
  model exists. Key stored only in `backend/.env` (gitignored); rotate after demo.
- **No OpenRouter needed.** At deploy, set on Render: `OPENAI_API_KEY` +
  `OPENAI_BASE_URL=https://vyceai.com/v1` + `OPENAI_MODEL=agnes-3.0-flash`
  (the OpenAI-compatible path in `provider.ts` consumes these with zero code changes).
- Original task text (for reference): pin a currently-available OpenRouter `:free`
  model id — made moot by the user's provider choice.

### DEP6 (P0, added 2026-09-19) — sqlite3 GLIBC crash on Render (blocks boot)

**Observed in the user's first deploy (commit `1dd7b0e`):** build 🎉, then boot crash —
`Error: /lib/x86_64-linux-gnu/libm.so.6: version \`GLIBC_2.38\' not found (required by
.../node_modules/sqlite3/build/Release/node_sqlite3.node)` → `ERR_DLOPEN_FAILED` →
crash loop. Full diagnosis: `.agent/report/2026-09-19-render-glibc-deploy-failure.md`.
Cause: `sqlite3@6.0.1`'s prebuilt native binary is compiled against glibc 2.38;
Render's native Node image (Ubuntu 22.04) ships glibc 2.35. Node version is
IRRELEVANT here (NAPI binary — same download for Node 22/24); do not chase it.

#### DEP6a — USER fix, ~2 minutes (try this FIRST)

1. Render dashboard → backend service → **Settings** → **Build Command**:
   `npm ci` → **`npm ci --build-from-source=sqlite3`** → Save (auto-redeploys).
   Alternate form if the flag is ignored: `npm ci && npm rebuild sqlite3 --build-from-source`.
2. Deploy passes ONLY if the build log shows sqlite3 **compiling from source**
   (`node-gyp rebuild` … `gyp info ok`) and the boot log reaches
   `[db] Database initialized` with NO `ERR_DLOPEN_FAILED`.
3. Continue plan_for_user.md Part 2.5+ exactly as written.

#### DEP6b — Claude's fallback (code change) — ONLY if 6a's build fails

Do NOT start speculatively. Trigger: 6a build error (missing build tools) or a
second `ERR_DLOPEN_FAILED` after a source compile. Scope (small, surgical):

1. `backend/package.json`: remove `sqlite3` AND `sqlite`; add `better-sqlite3`
   + `@types/better-sqlite3` (devDeps). Reason: better-sqlite3 prebuilds target
   glibc ≥ 2.29 (load on 2.35) and it falls back to clean source builds on any OS.
2. `backend/src/db/index.ts` ONLY: swap `open({ filename, driver })` for a
   `new Database(filename)` wrapped in a **tiny adapter exposing the same async
   surface** the codebase already consumes: `run/get/all` returning Promises
   (better-sqlite3 statements are sync; `await` on their results is legal, so the
   ~113 `db.run/db.all/db.exec` call sites in routes/rewards/seed/migrations stay
   untouched), plus `exec(sql)` passthrough and the exported `SqliteDatabase`
   type (2 type-only imports in `db/migrations/001/002` point at the same type).
3. Semantics to preserve (acceptance-checked):
   - positional params: driver-style `db.run(sql, a, b, c)` calls must map to
     `stmt.run(...normalize(args))` — accept both varargs and a single array;
   - `db.all` returns real arrays (`better-sqlite3` `.all()` does too);
   - `BEGIN`/`COMMIT`/`ROLLBACK` via `.exec()` unchanged (rewards + seed);
   - `PRAGMA foreign_keys = ON` and the existing migrations flow unchanged.
4. Verification gate before hand-back: `cd backend && npm run typecheck` exit 0
   AND `npm test` → **156/156 pasted into the progress log**. Then commit; the
   user redeploys with build command back to plain `npm ci`.

### DEP4 (P2, optional) — Fix `CORS_ORIGIN` multi-origin parsing
- Only needed if the user wants Vercel PREVIEW urls to call the backend too. For a
  single-production-domain hackathon deploy, skip it and set one origin.
- If done: parse `CORS_ORIGIN` into a trimmed, comma-split array; add one test.

### DEP5 (P2, optional) — render.yaml
- One-file IaC for the free service. Skip unless the user asks.

After DEP1–DEP3: re-run the D2 suite once and paste summaries.

---

## 3. Render backend setup (user executes; Claude assists — confirm before each step)

1. Render dashboard → **New → Web Service** → connect the repo.
2. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm ci --build-from-source=sqlite3` (DEP6a — compiles the native sqlite3 on Render's glibc-2.35 image; plain `npm ci` downloads a prebuild that crash-loops at boot, verified 2026-09-19)
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
   - **Instance Type:** Free
3. **No disk** (free tier has none — that is the accepted ephemeral-data tradeoff).
   ⚠️ CORRECTED 2026-09-19 (deploy attempt #2): `DATABASE_URL` MUST be set — the
   production boot guard (`server.ts:40-50`) calls `process.exit(1)` when
   `NODE_ENV=production` and neither `DATABASE_URL` nor `POSTGRES_URL` is present.
   Set **`DATABASE_URL=/tmp/qubitverse.db`** (a SQLite FILE PATH — the DB layer
   uses it as the sqlite filename, boot-seeds it fresh; not a secret; Postgres
   NOT involved). The original "leave it unset" advice was wrong.
4. Environment variables (Render → Environment):
   - `NODE_ENV=production` (required: enables the JWT_SECRET guard, disables debug endpoints)
   - `JWT_SECRET=<generate: openssl rand -base64 32>` — never commit it anywhere
   - `CORS_ORIGIN=https://<your-vercel-domain>` — ONE exact origin, https, no trailing slash
   - `OPENAI_API_KEY=<vyceai key — copy from backend/.env, never from chat/repo>` — server-side only, never in Vercel/frontend
   - `OPENAI_BASE_URL=https://vyceai.com/v1` — routes the OpenAI-compatible client to vyceai (DEP3, verified 2026-09-19)
   - `OPENAI_MODEL=agnes-3.0-flash` — verified working (HTTP 200 test call)
   - `MAX_SHOTS=10000` (explicit, optional)
   - Do NOT set `PORT` (Render injects it). DO set `DATABASE_URL=/tmp/qubitverse.db`
     (corrected 2026-09-19 — required by the prod boot guard; SQLite file path).
5. Deploy → confirm the log shows clean startup (no `[server] FATAL`; the two
   possible FATALs are `JWT_SECRET` and `DATABASE_URL`, both env fixes) and
   `curl https://<service>.onrender.com/health` → `{"status":"ok","service":"qubitverse-backend"}`.

Free-tier mechanics: the service sleeps after ~15 min without traffic; expect a
~30–60 s cold start on the next request. Render free gives 750 instance-hours/month —
one always-on service fits within that.

---

## 4. Wire the existing Vercel frontend (user executes)

1. Vercel dashboard → the existing project → Settings → Environment Variables:
   - `VITE_API_BASE_URL=https://<service>.onrender.com` (no trailing slash)
   - Apply to **Production** (and Preview if wanted).
2. **Redeploy** — Vite bakes env vars at build time; the current deployment will not
   pick this up until rebuilt.
3. No rewrite/redirect config needed: routing is hash-based.
   - NOTE (2026-09-19): Vercel's npm 11.6+ logs `npm warn allow-scripts` for
     `esbuild@0.28.2 (postinstall)` — warn-only on npm 11.x, build succeeded.
     Fixed for npm 12 by adding `"allowScripts": { "esbuild": true }` to the ROOT
     package.json (user-approved; uncommitted — rides with the next push). If new
     packages ever appear in that warning, approve them individually after review
     — do NOT blanket-allow scripts.
4. If the Vercel domain changes later (custom domain), update BOTH `CORS_ORIGIN`
   (Render) and `VITE_API_BASE_URL` (Vercel) + redeploy frontend.

---

## 5. AI Tutor — vyceai provider (✅ resolved 2026-09-19; supersedes the OpenRouter section)

- **Provider:** vyceai, OpenAI-compatible (`https://vyceai.com/v1`), model
  `agnes-3.0-flash` — verified with one approved test call (HTTP 200, correct shape).
- Backend consumes it via the existing `OpenAiCompatibleProvider`: set
  `OPENAI_API_KEY` + `OPENAI_BASE_URL` + `OPENAI_MODEL` on Render. Zero code changes.
- Key handling: redacted from `.agent/resource/` (now gitignored); lives only in
  `backend/.env` (local) and Render env (prod). ⚠️ Rotate the key after the demo —
  it was briefly exposed in a tracked file + chat. Never in frontend env, never in
  the repo, never in chat logs.
- Expected prod behavior (decided/tested): provider failure → HTTP 200 + `error`
  field with an honest message; no key material ever reaches the frontend.
- If the provider is down/rate-limited mid-demo: the tutor shows the honest error
  message — acceptable fallback; the local rule-based tutor still works for
  non-provider flows.

---

## 6. Post-deploy verification checklist (evidence or it didn't happen)

Run against PRODUCTION URLs; paste outputs into the progress log:

1. `GET /health` → 200 `{"status":"ok","service":"qubitverse-backend"}`.
2. Debug endpoints 404 in prod: `GET /api/debug/cors`, `GET /api/debug/jwt`.
3. Frontend on Vercel loads with NO CORS errors; API-mode label shows the backend URL.
4. Signup → login → logout → re-login round-trip through the deployed UI.
5. Cold start: after 15+ min idle, first request takes ~30–60 s then succeeds (confirm
   and note it — during the demo, open the app a minute early).
6. **Ephemerality sanity check (replaces the old persistence test):** create a user,
   then Render → Manual Restart → login fails / user gone. CONFIRM this matches the
   accepted tradeoff (if it does NOT wipe, something is caching unexpectedly — investigate).
7. Lesson pipeline (validates E4/E4b in prod): open a lesson → backend-served content
   renders; the lesson's startCircuit lab runs without runtime errors.
8. Quiz: correct answer → XP awarded; resubmit → XP awarded once (check `GET /state`).
9. Simulator: Bell circuit → only `|00⟩/|11⟩` ~50/50; X|0⟩ → |1⟩.
10. Challenge submit (bit-flip) → passes, XP awarded once.
11. AI tutor: ask a question → real OpenRouter reply with provider/model fields set;
    network tab shows NO key material client-side.
12. Rate limit: 11 failed logins → 429 on the 11th (validates DEP2 behind the proxy).
13. Shots cap: `POST /api/simulate` with `shots: 999999999` → response shows the capped value.
14. **DEP6 evidence:** build log shows sqlite3 compiled from source (`gyp info ok`,
    no prebuild download) and boot log reaches `[db] Database initialized` with no
    `ERR_DLOPEN_FAILED`. (If DEP6b was used instead: `better-sqlite3` loads, same
    boot evidence.) Note: source builds add ~1–3 min to every deploy — accepted.

## 7. Ops after go-live (free-tier edition)

- **Rollback:** Render keeps previous deploys — Rollback reverts code; DB is ephemeral
  so there is no data-compat concern.
- **Auto-deploy:** every push to the tracked branch redeploys (and WIPES the DB —
  another reason the accepted tradeoff is fine for a hackathon). Consider pausing
  auto-deploy on the demo day and deploying manually once.
- **Cold-start mitigation (free):** a free uptime pinger (e.g. UptimeRobot) on
  `/health` every 5–10 min keeps the service awake within the 750 h/month allowance —
  recommended for demo day.
- **Backups: NOT APPLICABLE** — nothing persistent to back up; that is the accepted
  tradeoff. If the project ever becomes real, see §8.

## 8. Upgrade path (documented, NOT to be done now)

If this ever needs real persistence: attach a Render paid disk OR move the DB layer to
Turso free (libSQL — SQLite-compatible; 5 GB + 500M reads/10M writes per month free;
requires swapping the sqlite3 driver for `@libsql/client` behind a same-API adapter).
Everything else in this plan (Vercel wiring, env vars, checklist) stays valid.

## 9. Buffy audit criteria for this plan

When Claude reports "deployed", Buffy verifies claim-by-claim:
1. DEP1–DEP3 present in code/log with evidence (diff + pasted test/typecheck summaries).
2. §6 checklist: every item has pasted evidence (no "should work").
3. Secrets audit: repo search shows no JWT/AI keys; `.env` not committed; keys exist
   only in Render env settings; chosen `:free` model id logged.
4. `git ls-files` shows no DB file tracked.
5. Render settings screenshot/log evidence: `NODE_ENV=production` set, health path
   `/health`, root dir `backend`, free instance, no disk assumed, build command
   `npm ci --build-from-source=sqlite3` (DEP6a), `DATABASE_URL` set to a SQLite
   file path (boot-guard requirement, corrected 2026-09-19).
6. Ephemerality check (§6.6) explicitly evidenced and acknowledged.

— Buffy
