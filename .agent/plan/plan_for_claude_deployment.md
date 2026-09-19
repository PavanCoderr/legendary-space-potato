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
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
   - **Instance Type:** Free
3. **No disk** (free tier has none — that is the accepted ephemeral-data tradeoff).
   Leave `DATABASE_URL` UNSET so the default `./data/qubitverse.db` is used.
4. Environment variables (Render → Environment):
   - `NODE_ENV=production` (required: enables the JWT_SECRET guard, disables debug endpoints)
   - `JWT_SECRET=<generate: openssl rand -base64 32>` — never commit it anywhere
   - `CORS_ORIGIN=https://<your-vercel-domain>` — ONE exact origin, https, no trailing slash
   - `OPENAI_API_KEY=<vyceai key — copy from backend/.env, never from chat/repo>` — server-side only, never in Vercel/frontend
   - `OPENAI_BASE_URL=https://vyceai.com/v1` — routes the OpenAI-compatible client to vyceai (DEP3, verified 2026-09-19)
   - `OPENAI_MODEL=agnes-3.0-flash` — verified working (HTTP 200 test call)
   - `MAX_SHOTS=10000` (explicit, optional)
   - Do NOT set `PORT` (Render injects it) and do NOT set `DATABASE_URL`.
5. Deploy → confirm the log shows clean startup (no `[server] FATAL`) and
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
   `/health`, root dir `backend`, free instance, no disk assumed.
6. Ephemerality check (§6.6) explicitly evidenced and acknowledged.

— Buffy
