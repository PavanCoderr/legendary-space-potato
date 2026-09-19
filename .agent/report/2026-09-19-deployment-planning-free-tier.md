# Free-Tier Deployment Planning Session — Buffy (2026-09-19)

Purpose: revise the deployment plan for a $0 budget after the user's decisions.
No commands run, no source files touched. Deliverable:
**`.agent/plan/plan_for_claude_deployment.md`** (rewritten; supersedes the paid-tier
version). Also appended a superseding entry to the progress log.

## User decisions (recorded)

| Decision | Choice |
|---|---|
| Budget | **$0 — free tiers only** |
| Context | **Hackathon project, not real production** |
| Data persistence | User **explicitly accepts** SQLite wipe on every redeploy/restart/spin-down |
| Backend | **Render free** web service, local SQLite as-is — zero DB code changes |
| Frontend | **Existing Vercel deployment**, wired via `VITE_API_BASE_URL` + redeploy |
| AI Tutor | **OpenRouter free models** (`:free` ids) — zero code changes, key server-side only |

## Research findings (web-verified 2026-09-19)

- Render free tier: **ephemeral filesystem confirmed by Render's own docs** — "any
  changes… (local SQLite databases, etc.) are lost every time the service redeploys,
  restarts, or spins down." No persistent disks on free. Sleep after ~15 min idle;
  ~30–60 s cold start. 750 free instance-hours/month.
- Turso free tier (researched as the persistence upgrade path): 5 GB storage, 500M
  row reads + 10M row writes/month, ~100 databases, $0 — would require swapping the
  sqlite3 driver for `@libsql/client` behind a same-API adapter. Documented in plan
  §8 as the future upgrade path; **explicitly not now** per the user.
- OpenRouter `:free` model ids exist and are already supported by
  `backend/src/ai/provider.ts` (`OPENROUTER_API_KEY`/`OPENROUTER_MODEL`) — zero code
  changes. Free model ids rotate, so the plan includes a DEP3 task to pick a
  currently-available id at deploy time.

## Plan changes vs the paid-tier version

- **Removed:** persistent disk setup, restart-persistence test, backup strategy
  (nothing persistent exists), and the §0 C4 deploy gate — with an ephemeral DB there
  is no production schema to migrate; every boot seeds fresh. **C4 no longer blocks
  deployment** (stays a dev-plan quality item).
- **Remaining deploy gates:** E4b (lessons bootstrap, P0) → E6 `video.chapters`
  residual → D2 full green run.
- **Re-scoped pre-deploy tasks:** DEP1 (P0) `tsx` → dependencies; **DEP2 (P1, now
  critical)** `app.set('trust proxy', 1)` — behind Render's proxy all users share one
  IP, so without it the auth rate limiter (10/15 min) becomes a **global lockout**;
  DEP3 pick + log a live OpenRouter `:free` model id; DEP4 (CORS multi-origin) and
  DEP5 (render.yaml) demoted to optional.
- **Render env table (§3):** `NODE_ENV=production` (must be set manually — enables the
  JWT_SECRET guard and disables debug endpoints), `JWT_SECRET`, single `CORS_ORIGIN`,
  `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`; explicitly do NOT set `PORT` or
  `DATABASE_URL`.
- **Checklist (§6):** 13 items, all evidence-gated — including cold-start
  confirmation and an ephemerality sanity check (user gone after Manual Restart —
  expected and acknowledged).
- **Demo-day ops (§7):** free uptime pinger on `/health` to prevent cold starts;
  consider pausing auto-deploy (each push wipes the DB).

## Repo facts re-verified for this revision

- `server.ts`: `/health` present; prod JWT_SECRET guard; debug endpoints gated by
  `NODE_ENV`; `PORT` respected; CORS single-origin from `CORS_ORIGIN`.
- `backend/package.json`: `"start": "tsx src/server.ts"`; `tsx` in devDependencies
  (DEP1); CJS tsc output vs `"type": "module"` — start command must stay tsx.
- Vite + hash routing → no rewrite rules needed on Vercel; `VITE_API_BASE_URL` is a
  build-time var → the existing deployment must be REDEPLOYED after setting it.

## Status of artifacts

- `.agent/plan/plan_for_claude_deployment.md` — rewritten for free tier (verified by
  re-read after a tool anomaly reported the write as a string-replace).
- `.agent/progress/plan_progress_claude.md` — superseding log entry appended.
- No source files touched; all deploys/dashboard actions remain gated on explicit
  user confirmation.

— Buffy
