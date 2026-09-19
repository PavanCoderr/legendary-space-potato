# Render Deploy SUCCESS — backend LIVE — Buffy (2026-09-19)

Third session entry for the Render deploy saga. **No commands run, no source files
touched.** Companion reports: `…-render-glibc-deploy-failure.md` (attempt #1),
`…-render-deploy-fix-2-database-url.md` (attempt #2).

## 1. Deploy log evidence (user-pasted, commit `1dd7b0e`)

- Build: `npm ci --build-from-source=sqlite3` → **1m** (source compile), 0 vulns,
  `Build successful 🎉`.
- Boot: `QubitVerse backend listening on port 10000`.
- DB: `Migration 001: initial_schema` + `002: add_last_active_date` both applied →
  `[db] Database initialized`.
- Seed: `[seed] Seeded 5 lessons, 22 quizzes, 5 challenges, 24 glossary terms` —
  **counts match the E4/E6 content work exactly** (22 = 10 original + 12 E6 batch).
  Strong evidence the shipped repo state is the fully-hardened one.
- Render: `Your service is live 🎉` → **https://qubitverse-backend.onrender.com**.

## 2. What was fixed between attempts (both dashboard-only, zero code change)

1. **GLIBC/DEP6a:** build command `npm ci --build-from-source=sqlite3` (sqlite3
   prebuilt needed glibc 2.38; Render image has 2.35).
2. **Boot guard (my plan defect, corrected):** `DATABASE_URL=/tmp/qubitverse.db`
   required by `server.ts:46` in production — SQLite file path, ephemeral,
   boot-seeded, not a secret, Postgres NOT involved.

## 3. Current state & what remains (user-side)

- **LIVE but NOT yet "deployed"** per the BF6-style evidence rule. Remaining:
  - 2.9 `/health` browser check (only manual confirmation still missing).
  - **Confirm `CORS_ORIGIN` is set on Render to the exact Vercel production
    domain** — the service boots fine without it (falls back to localhost:5173)
    but the frontend's API calls will fail CORS. This is the #1 risk for Part 3.
  - Part 3: Vercel `VITE_API_BASE_URL=https://qubitverse-backend.onrender.com` +
    **redeploy** (build-time var).
  - Part 4: 12-item checklist (debug-404, auth round-trip, E4 lesson pipeline,
    quiz XP idempotency, Bell sim, challenge, AI tutor, rate-limit 429,
    ephemerality restart check).
  - Part 5 demo ops: uptime pinger on `/health`, consider pausing auto-deploy
    (every push wipes the ephemeral DB — accepted).

## 4. Notes

- `PORT` was never set; Render injected 10000 and the server respected it. ✔
- Cold starts: after ~15 min idle expect 30–60 s on first request — normal free
  tier; pinger mitigates for demo day.
- Both fixes are dashboard settings: if the service is ever recreated, re-apply
  them (build command + env table) — recorded in plan_for_user.md and §9 audit.

— Buffy
