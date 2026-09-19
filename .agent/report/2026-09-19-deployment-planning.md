# Deployment Planning Session — Buffy (2026-09-19)

Purpose: produce a deployment plan as a separate artifact, per the user's request.
No commands run, no source files touched. Deliverable:
**`.agent/plan/plan_for_claude_deployment.md`**.

## User decisions (recorded)

| Decision | Choice |
|---|---|
| Backend host | **Render** — Node web service + persistent disk for SQLite |
| Frontend | **User's existing Vercel deployment** — wire it up, don't re-create |
| AI Tutor | **Real provider at first deploy** (recommended: OpenRouter) |

## Research findings (gravity_index + repo inspection)

- Vercel/serverless was evaluated and **rejected for the backend**: serverless has no
  persistent disk, so the file-based SQLite would be wiped across requests. Research
  explicitly flagged this ("local SQLite files will not persist"); pairing serverless
  with Turso was surfaced as an alternative but rejected — the user chose plain Render.
- **Render** fits the exact shape: long-running Node service + persistent disk mount
  + static hosting. Chosen by the user.
- Critical pricing caveat surfaced in the plan: **Render's free tier has no persistent
  disks** — free-tier SQLite = user data destroyed on every restart. A paid instance
  is required for a real deploy.
- AI provider: gravity recommended Google AI (Gemini), but the backend's provider
  abstraction (`backend/src/ai/provider.ts`, `backend/.env.example`) already natively
  supports **OpenRouter / OpenAI / Anthropic / NVIDIA with zero code changes**, and
  OpenRouter's one-key/many-models model fits the tutor best. Gemini remains possible
  later via its OpenAI-compatible endpoint (endpoint/model naming must be verified
  before switching). Recommendation recorded in the plan; final model choice is the
  user's.

## Repo facts verified for the plan (2026-09-19)

- `backend/src/server.ts`: `/health` exists; prod requires `JWT_SECRET` (exits
  otherwise); debug endpoints gated off in prod; `PORT` respected; CORS from
  `CORS_ORIGIN`; boots `initializeDatabase()` + `seedDatabase()`.
- `backend/package.json`: `"start": "tsx src/server.ts"` but **tsx is a devDependency**
  → `npm ci --omit=dev` breaks the start command (DEP1). tsconfig emits CommonJS while
  the package is `"type": "module"` → `node dist/server.js` would crash; start command
  must stay tsx for now.
- `CORS_ORIGIN` docs say comma-separated but `server.ts` passes the raw string →
  multi-origin silently broken (DEP2).
- No `trust proxy` setting → behind Render's proxy, rate-limiter buckets by proxy IP,
  lumping all users together (DEP3).
- Frontend: Vite SPA, **hash routing** (`#/...`) → zero rewrite rules needed anywhere;
  `VITE_API_BASE_URL` is read at **build time** → existing Vercel deployment must be
  **redeployed** after setting the var.
- No Dockerfile / render.yaml / CI workflows exist (glob-verified).
- Backend build output: `backend/dist` (tsconfig `outDir`).

## Deliverable structure (in the plan file)

- §0 Ordering: deployment blocked until E4b + E6-chapters + C4 + D2 are Buffy-verified.
- §2 Pre-deploy code tasks DEP1–DEP4 (+ optional DEP5 render.yaml).
- §3 Render setup: paid instance, disk mounted at `/var/data` added BEFORE first
  deploy, full env-var table, `/health` check path.
- §4 Wiring the EXISTING Vercel project: set `VITE_API_BASE_URL`, redeploy, no
  rewrite config needed.
- §5 AI provider: OpenRouter key in Render env only; alternatives listed.
- §6 12-item post-deploy verification checklist, each requiring pasted evidence —
  including the **restart-persistence test** (§6.5) that directly validates the disk
  mount, and the prod 404 check on the debug endpoints.
- §7 Ops: rollback, auto-deploy caution, SQLite backup strategy (P2), uptime pinger.
- §9 Buffy audit criteria for the eventual "deployed" claim (incl. secrets audit and
  `git ls-files` DB check).

## Also updated

- `.agent/progress/plan_progress_claude.md` — log entry announcing the deployment
  plan, the ordering rule, and the four DEP tasks so Claude sees it on next read.

## Notes

- The deployment plan is deliberately a **separate file** from
  `plan_for_claude.md` so Claude's active dev queue (E4b → E6 residual → C4 → D2)
  stays unambiguous; the progress-log entry states that ordering rule explicitly.
- Every deploy/dashboard action remains gated on explicit user confirmation,
  per CLAUDE.md and the plan's ground rules.
- One tooling hiccup this session: the code_search tool failed intermittently again
  (ENOTDIR on its ripgrep binary); affected lookups were re-verified via direct reads
  and globs. No conclusion rests on a failed search.

— Buffy
