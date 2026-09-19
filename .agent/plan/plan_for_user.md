# Plan for USER — deployment & user-side tasks (QubitVerse, $0 free tier)

Written by Buffy (planner) 2026-09-19. Companion to `plan_for_claude_deployment.md`
(full technical detail lives there) and Review #4
(`.agent/report/2026-09-19-review-4-e4b-e6-c4-dep.md` §6). This file is YOUR
checklist — tick items off as you go.

## Golden rules

- **Never paste secrets** (JWT_SECRET, OPENROUTER_API_KEY) into chat, the repo, or
  screenshots. They live ONLY in Render's env-var settings.
- Do the parts **in order**. Part 1 you can do TODAY; Parts 2–3 wait until Claude
  lands DEP1 + DEP2 and the final D2 run is green (check
  `.agent/progress/plan_progress_claude.md` for "D2 full run … summaries pasted").
- Every dashboard click is yours. Ask Claude if a screen doesn't match the
  description — don't improvise settings.
- Accepted tradeoff (hackathon): **the database wipes on every redeploy/restart/
  spin-down.** Register demo accounts live; don't rely on yesterday's data.

---

## Part 1 — AI tutor provider (DEP3) — ✅ RESOLVED 2026-09-19 (supersedes the OpenRouter steps)

The user provided an OpenAI-compatible provider (details in
`.agent/resource/ai_tutor_api.md` — key redacted there, lives only in env).
Buffy verified it with ONE approved test call: **HTTP 200, model responded
correctly**. Nothing left to pick or create.

- [x] 1.1 Provider chosen: **vyceai** (OpenAI-compatible endpoint, base URL
      `https://vyceai.com/v1`).
- [x] 1.2 Model: **`agnes-3.0-flash`** — verified exists and responds (2026-09-19).
- [x] 1.3 Key: provided by user; redacted from `.agent/resource/` (gitignored) and
      stored ONLY in `backend/.env` (local) and later Render env vars (prod).
      ⚠️ Treat the key as exposed (it was briefly in a tracked file + chat) —
      rotate it on the provider dashboard after the demo.
- [x] 1.4 Backend wiring: zero code changes — `OPENAI_API_KEY` + `OPENAI_BASE_URL`
      + `OPENAI_MODEL` activate the OpenAI-compatible path in `provider.ts`.
- [ ] 1.5 REMAINING (at deploy time): copy the same three values into Render env
      vars (Part 2.5) — from `backend/.env`, never from chat or any file.

## Part 2 — Render: backend service (after DEP1+DEP2 land)

> 🚨 **GATE (2026-09-19, update 2): GLIBC blocker RESOLVED ✅** — build command
> `npm ci --build-from-source=sqlite3` worked (build 1m10s, boot got past the
> sqlite3 load, no `ERR_DLOPEN_FAILED`). **NEW blocker:**
> `[server] FATAL: DATABASE_URL or POSTGRES_URL must be set in production`
> (`server.ts:46` prod boot guard — the earlier "leave DATABASE_URL unset"
> advice was WRONG). **FIX (~1 min):** add env var `DATABASE_URL=/tmp/qubitverse.db`
> (step 2.5 table), Save → auto-redeploy. Success = boot reaches
> `[db] Database initialized` + listening; then continue 2.7–2.9.
> Diagnosis: `.agent/report/2026-09-19-render-deploy-fix-2-database-url.md`.

- [x] 2.1 Sign in at https://render.com (GitHub login is fine).
- [x] 2.2 New → **Web Service** → connect this GitHub repo.
- [x] 2.3 Settings:
      | Setting | Value |
      |---|---|
      | Root Directory | `backend` |
      | Runtime | Node |
      | Build Command | `npm ci --build-from-source=sqlite3` ⚠️ NOT plain `npm ci` — fixes the GLIBC boot crash (step 2.3 of the appendix, note b) |
      | Start Command | `npm start` |
      | Health Check Path | `/health` |
      | Instance Type | **Free** |
- [x] 2.4 **No disk** — free tier has none; the DB is a local ephemeral SQLite file.
      ⚠️ CORRECTED 2026-09-19 (deploy attempt #2): `DATABASE_URL` MUST be set —
      see the env table in 2.5 (`/tmp/qubitverse.db`). The prod boot guard
      (`server.ts:46`) exits without it. Plain file path, not a secret; Postgres
      NOT involved.
- [x] 2.5 Environment variables (Render → Environment):
      | Key | Value | Notes |
      |---|---|---|
      | `NODE_ENV` | `production` | required — enables the JWT secret guard, disables debug endpoints |
      | `JWT_SECRET` | *(generate — see 2.6)* | never commit anywhere |
      | `CORS_ORIGIN` | `https://<your-vercel-domain>` | ONE origin, https, NO trailing slash |
      | `DATABASE_URL` | `/tmp/qubitverse.db` | ⚠️ REQUIRED (updated 2026-09-19): SQLite FILE PATH, satisfies the prod boot guard `server.ts:46`; ephemeral + boot-seeded; NOT a secret. Postgres NOT involved. |
      | `OPENAI_API_KEY` | the vyceai key (copy from `backend/.env`) | server-side only — never in Vercel/frontend/repo |
      | `OPENAI_BASE_URL` | `https://vyceai.com/v1` | routes the OpenAI-compatible client to vyceai |
      | `OPENAI_MODEL` | `agnes-3.0-flash` | verified working 2026-09-19 |
      | `MAX_SHOTS` | `10000` | optional but explicit |
      Do **NOT** set `PORT` (Render injects it). **DO set** `DATABASE_URL=/tmp/qubitverse.db`
      (corrected 2026-09-19 — required by the prod boot guard; SQLite file path).
- [x] 2.6 Generate `JWT_SECRET` in your own terminal:
      `openssl rand -base64 32` (or any long random string from a password manager).
- [x] 2.7 Deploy → watch the log: it must show clean startup (no `FATAL`), DB
      seeding, and the port Render assigned.
- [x] 2.8 Paste your Render service URL (e.g. `https://qubitverse-backend.onrender.com`)
      into the chat so the env-var wiring in Part 3 is exact.
- [x] 2.9 Sanity check: open `https://<service-url>/health` in a browser →
      `{"status":"ok","service":"qubitverse-backend"}`. First load after idle may
      take 30–60 s (free-tier cold start — normal).

## Part 3 — Vercel: wire the existing frontend

- [x] 3.1 Vercel dashboard → your existing QubitVerse project → Settings →
      Environment Variables → add:
      `VITE_API_BASE_URL = https://<service-url-from-2.8>` (no trailing slash).
      Apply to **Production** (Preview too if you want).
- [x] 3.2 **Redeploy** the project (Deployments → Redeploy). This is mandatory —
      Vite bakes env vars at build time; the current deployment won't pick it up.
- [x] 3.3 Cross-check: `CORS_ORIGIN` (Render) and the browser origin of the Vercel
      app must be the SAME domain, byte-for-byte, or API calls will fail CORS.

## Part 4 — Post-deploy verification (evidence or it didn't happen)

Run these against the LIVE urls; paste results into
`.agent/progress/plan_progress_claude.md` (or just tell Buffy — I'll record them).
Full detail: deployment plan §6.

- [ ] 4.1 `/health` → 200 JSON (from 2.9).
- [ ] 4.2 `https://<service>/api/debug/cors` and `/api/debug/jwt` → both **404**.
- [ ] 4.3 Open the Vercel app: no CORS errors in the browser console; the API-mode
      label shows the Render URL.
- [ ] 4.4 Signup → login → logout → re-login round-trip works in the UI.
- [ ] 4.5 Open a lesson: backend-served content renders; the lesson's circuit lab
      runs (this proves E4/E4b in production).
- [ ] 4.6 Quiz: answer correctly → XP awarded; answer again → XP awarded ONCE
      (check the profile/state view).
- [ ] 4.7 Simulator: Bell circuit → only `00`/`11` ≈ 50/50.
- [ ] 4.8 Challenge submit (bit-flip) → passes, XP once.
- [ ] 4.9 AI tutor: ask something → a real reply appears (check network tab: no key
      material client-side). If it errors, note the message — the honest-error
      fallback is expected behavior when the free model is rate-limited.
- [ ] 4.10 Rate limit: 11 failed logins → 429 on the 11th.
- [ ] 4.11 Ephemerality sanity check (expected!): create a user → Render dashboard →
      **Manual Restart** → that user can no longer log in. This confirms the
      accepted tradeoff, not a bug.
- [ ] 4.12 Tell Buffy "deployed" — I audit claim-by-claim per deployment plan §9.

## Part 5 — Demo-day ops (optional but recommended)

- [ ] 5.1 Free uptime pinger: UptimeRobot (or similar) → HTTP monitor on
      `https://<service-url>/health` every 5–10 min. Keeps the service awake within
      Render's 750 free instance-hours/month and avoids demo-day cold starts.
- [ ] 5.2 Consider pausing auto-deploy on Render for demo day (every push REDEPLOYS
      and WIPES the DB). Deploy once manually, then freeze.
- [ ] 5.3 30–60 min before the demo: open the app once (warm it), register a fresh
      demo account, run one Bell simulation.

## Do-NOT list

- Don't commit `.env`, DB files, or any key.
- Don't set `PORT` on Render (Render injects it). **Do set `DATABASE_URL=/tmp/qubitverse.db`** (SQLite file path, required by the prod boot guard — updated 2026-09-19).
- Don't migrate to Turso/Postgres now (documented upgrade path, deployment plan §8 —
  explicitly out of scope per your decision).
- Don't rename/redo frontend hosting — we wire the EXISTING Vercel project only.
- Don't mark anything "done" without its evidence line (BF6 rule applies to you too 🙂).

---

## Quick status board

| Part | Depends on | Owner | Status |
|---|---|---|---|
| 1 — model + key | nothing | USER | ✅ RESOLVED — vyceai / `agnes-3.0-flash`, verified |
| 2 — Render backend | DEP1+DEP2 landed, D2 green (Claude) | USER | ☐ |
| 3 — Vercel wiring | Part 2 URL | USER | ☐ |
| 4 — verification | Parts 2+3 | USER + Buffy audit | ☐ |
| 5 — demo ops | Part 4 | USER | ☐ |

---

# Appendix — Dashboard walkthrough, step by step (added 2026-09-19)

Detailed, click-by-click notes for every dashboard step above. UIs change
occasionally — if a screen looks different, don't guess; ask Buffy in chat.

## Part 2 — Render (backend), step by step

**2.1 — Sign in.** render.com → **Sign in with GitHub** → authorize Render. If your
repo doesn't appear later: Render → top-right → **Account Settings → GitHub** →
grant access to the repo (or "All repositories").

**2.2 — Create the service.** Dashboard → **New +** (top right) → **Web Service**.
If asked "deploy an existing repo vs blueprint", pick **existing repo**, find
`qubitverse` in the list → **Connect**.

**2.3 — The settings form** (shown before the first deploy):

| Field | What to enter | Why |
|---|---|---|
| **Name** | e.g. `qubitverse-backend` | becomes your URL: `<name>.onrender.com` |
| **Project** | optional — skip or "QubitVerse" | dashboard grouping only |
| **Language / Runtime** | **Node** | Express server |
| **Branch** | `master` (your default) | pushes here trigger auto-deploys |
| **Root Directory** | `backend` ⚠️ critical | monorepo — without this, `npm ci` runs in the repo root where there's no `package.json` and the build dies instantly |
| **Build Command** | `npm ci --build-from-source=sqlite3` ⚠️ changed 2026-09-19 | clean install per lockfile **+ compile the sqlite3 native module on Render itself**. Plain `npm ci` downloads a prebuilt binary that needs glibc 2.38; Render's image has 2.35 → boot crash `ERR_DLOPEN_FAILED` (see note b). Cost: ~1–3 min extra build time. Never `npm install`. |
| **Start Command** | `npm start` | runs `tsx src/server.ts` (DEP1 must have landed, else boot fails) |
| **Health Check Path** | `/health` | Render pings it after boot; deploy counts "live" only on 200 |
| **Instance Type** | **Free** | the $0 choice; "spin down after 15 min" warning = accepted tradeoff |

**2.4 — No disk.** Skip the **Disks** section entirely (free tier has none). The
server creates + seeds its own local SQLite at boot — **but** the production boot
guard (`server.ts:46`) requires `DATABASE_URL` to be SET: add
`DATABASE_URL=/tmp/qubitverse.db` in step 2.5 (plain file path, not a secret;
updated 2026-09-19 — earlier advice to leave it unset was wrong).

**2.5 — Environment variables.** Same creation page → **Environment Variables** →
**Add Environment Variable**, one row each: `NODE_ENV=production`, `JWT_SECRET`
(from 2.6), `CORS_ORIGIN`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`,
`MAX_SHOTS=10000`. The eye icon toggles reveal; values are **write-only after
save** (nobody can read them back — by design).

⚠️ Two common mistakes:
- `CORS_ORIGIN` must be the **exact** Vercel URL: `https://your-app.vercel.app` —
  https included, **no trailing slash**, no path.
- Do **NOT** add `PORT` (Render injects it). **DO** add `DATABASE_URL=/tmp/qubitverse.db`
  (updated 2026-09-19 — required by the prod boot guard; SQLite file path).

**2.6 — Generate JWT_SECRET** before reaching the env-var form. In any terminal
(Codespace is fine): `openssl rand -base64 32` → copy output → paste as the value.
Never put this string anywhere else.

**2.7 — First deploy.** **Create Web Service** → you land on the service page →
**Events / Logs** tab. Healthy log: install lines → build → server boot → DB
init/seed → "listening on port …" → "Your service is live 🎉".
Red flags: `FATAL` + exit (almost always a missing/misspelled env var — the server
refuses to boot in production without `JWT_SECRET`), or `tsx: not found` /
`Cannot find module` (DEP1 didn't land — stop and tell Buffy).

**2.8 — Your URL.** Top of the service page (and Settings): e.g.
`https://qubitverse-backend.onrender.com`. Copy it — Parts 3 and 4 need it.

**2.9 — Health check.** Open `<url>/health` in a browser. If the service was idle,
the tab may spin **30–60 s** first (cold start — normal). Expected body:
`{"status":"ok","service":"qubitverse-backend"}`.

**Notes for 2.3/2.7:**

- **(a)** The start command stays `npm start` — it runs `tsx src/server.ts`
  (tsx is a real dependency since DEP1; no change).
- **(b) GLIBC fix (why the build command changed):** `sqlite3` is a native C++
  module. Plain `npm ci` downloads a prebuilt binary compiled against glibc 2.38;
  Render's Ubuntu 22.04 image has glibc 2.35 → at boot Node cannot load it:
  `version 'GLIBC_2.38' not found … ERR_DLOPEN_FAILED`. `--build-from-source=sqlite3`
  compiles the module ON Render's own image → glibc match guaranteed. Healthy
  deploy = build log shows `node-gyp rebuild`/`gyp info ok` for sqlite3, boot log
  shows `[db] Database initialized` and NO `ERR_DLOPEN_FAILED`. If the build
  instead fails (e.g. compiler errors) → STOP, paste the log to Buffy — Claude's
  code-level fallback (DEP6b: swap to better-sqlite3 behind a tiny adapter) is
  already specced in the deployment plan. **Do not try downgrading Node or
  `sqlite3` versions — Node version does not matter here (NAPI binary).**

💡 **Editing env vars later:** service page → **Environment** tab (left sidebar) →
edit → **Save Changes**. Saving triggers an automatic redeploy (which wipes the
ephemeral DB — fine, accepted).

## Part 3 — Vercel (frontend), step by step

**3.1 — Add the variable.** vercel.com → dashboard → click your **existing**
QubitVerse project (don't create a new one) → **Settings** (top bar) →
**Environment Variables** (left sidebar):
- Key: `VITE_API_BASE_URL` — the `VITE_` prefix is mandatory; Vite only exposes
  prefixed vars to the frontend bundle.
- Value: `https://<your-render-url>` — no trailing slash.
- Environments: check **Production** (Preview only if you want preview branches
  calling the backend).
- **Save**.

**3.2 — Redeploy (mandatory).** Env vars are baked at **build time** — the running
site still has the old build. **Deployments** (top bar) → newest deployment →
**⋯ menu** → **Redeploy** → confirm. Leave "Use existing Build Cache" ON; **if the
app still talks to localStorage after deploy, redeploy again with build cache
OFF** to force a fully fresh build.

**3.3 — Cross-check the domain.** Project → **Settings → Domains**: copy the
production domain (e.g. `https://qubitverse.vercel.app`) — that exact string must
equal `CORS_ORIGIN` on Render. One character off = every API call blocked by CORS.

## Dashboard steps inside Parts 4–5

**4.2 — Debug 404 check:** open `<render-url>/api/debug/cors` and
`/api/debug/jwt` in the browser. A plain **404 "Cannot GET …"** page = correct
(endpoints are disabled in production).

**4.10 — Rate-limit check:** deployed app → login page → wrong password 11 times →
expect **429** / rate-limit message on the 11th. If it never 429s, DEP2's
`trust proxy` may be missing — tell Buffy.

**4.11 — Manual Restart (ephemerality check):** Render service page →
**Manual Deploy ▾** or **⋯ / Restart** → **Restart service**. Wait for "live",
then log in as the user created before the restart → login should **FAIL**
(user wiped). That confirms the accepted tradeoff, not a bug.

**5.1 — UptimeRobot:** uptimerobot.com → free account → **Add New Monitor** →
type **HTTP(s)** → name `qubitverse` → URL `https://<render-url>/health` →
interval 5–10 min → Create. 750 free Render-hours/month covers one always-on
service, so leaving it on is fine.

## Gotcha table

| Symptom | Likely cause |
|---|---|
| Render build fails instantly, "no package.json" | Root Directory not set to `backend` |
| Boot log: `tsx: not found` / module error | DEP1 not landed — stop, tell Buffy |
| Boot log: FATAL about JWT_SECRET | `NODE_ENV=production` set but `JWT_SECRET` missing/typo'd key name |
| Boot log: `FATAL: DATABASE_URL or POSTGRES_URL must be set in production` | Add `DATABASE_URL=/tmp/qubitverse.db` (SQLite file path — prod boot guard `server.ts:46`, updated 2026-09-19) |
| Frontend loads but says "Local storage" mode | `VITE_API_BASE_URL` missing **or** deployed before adding it — redeploy |
| Browser console CORS errors | `CORS_ORIGIN` ≠ exact Vercel domain (trailing slash / wrong domain) |
| Every user gets rate-limited globally | DEP2 (`trust proxy`) missing — tell Buffy |
| First request slow (30–60 s) | Normal free-tier cold start |

— Buffy
