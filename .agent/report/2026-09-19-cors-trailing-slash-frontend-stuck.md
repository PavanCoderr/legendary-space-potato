# Frontend "stuck" on Vercel — ROOT CAUSE FOUND — Buffy (2026-09-19)

Read-only session. **No commands run, no source files touched.** User pasted browser
console output from `https://qubitverse-green.vercel.app`; diagnosis below is
evidence-based from that output + code reads of `backend/src/server.ts`,
`src/services/api.ts`, `src/main.tsx`, `src/state/*`, `src/pages/*`.

## 1. Bug 1 (P0) — CORS_ORIGIN trailing slash blocks EVERY backend call

User-pasted console evidence (the smoking gun):

```
Access to fetch at 'https://qubitverse-backend.onrender.com/api/lessons' from origin
'https://qubitverse-green.vercel.app' has been blocked by CORS policy: Response to
preflight request doesn't pass access control check: The 'Access-Control-Allow-Origin'
header has a value 'https://qubitverse-green.vercel.app/' that is not equal to the
supplied origin.
```

- The server echoes `…vercel.app/` **with a trailing slash**; the browser's Origin
  header is `…vercel.app` (never has a trailing slash). `cors` middleware compares
  the strings byte-for-byte → mismatch → preflight fails → every request dies.
- `server.ts:8-13` passes `CORS_ORIGIN` through raw (exact-match mode), so the env
  value must be byte-exact: `https://qubitverse-green.vercel.app`.
- This was pre-flagged as the "#1 live risk" in `…-render-deploy-live.md` §3 — now
  confirmed live.
- Consequence chain: `/api/lessons` blocked (bootstrap falls back to bundled
  curriculum — the console's `[qubitverse] remote lessons unavailable` line is the
  designed fallback working correctly) → `/api/login` + `/api/signup` also blocked
  (same preflight) → the user can never sign in → **the app appears stuck**.

**FIX (USER, ~1 minute, dashboard only, zero code):**

1. Render dashboard → backend service → **Environment** tab → `CORS_ORIGIN` → edit
   value to `https://qubitverse-green.vercel.app` — **https included, NO trailing
   slash, no path** → Save Changes (auto-redeploys; ephemeral DB wipes — accepted).
2. Wait for "live", then hard-refresh the Vercel page (Ctrl+Shift+R).
3. Expect: no CORS errors in console; `/api/lessons` fetch succeeds; login works.

## 2. Bug 2 (P1) — render crash: `Cannot read properties of undefined (reading 'title')`

```
pages-D6HGU2xa.js:1 Uncaught TypeError: Cannot read properties of undefined (reading 'title')
    at Gt (pages-D6HGU2xa.js:1:96831) → React unmounts the tree → blank/frozen page
```

A page component crashed during render → React 19 unmounts the root → blank page
(this is the literal "stuck" symptom on top of Bug 1). Ranked candidate sites
(unguarded `.title` reads in the pages chunk; minified frame can't be attributed
statically with certainty — the deployed bundle may also be older than HEAD):

1. `src/pages/Dashboard.tsx:78/105` — `next.title` / `recommended.title` where the
   selector's final fallback is `LESSONS[LESSONS.length - 1]` → **undefined if the
   LESSONS array is ever empty** (`src/state/selectors.ts` `continueLesson` /
   `recommendedLesson`).
2. `src/pages/Learn.tsx:240` — `outline.title` where
   `outline = lesson.outline[Math.min(selected, lesson.outline.length - 1)]` →
   **undefined if a lesson's `outline` array is empty** (index resolves to −1).
   Relevant the moment backend lessons load (E4 pipeline) if any backend row has an
   empty outline — the normalizer spread can override bundled content.
3. `src/pages/Learn.tsx:278` — `lesson.video.title`; `src/pages/Lesson.tsx:85/269/282`
   — `lesson.video.title` / `lesson.example.title` — undefined if the merged lesson
   object lacks those fields.
4. Stale-localStorage replay: `StoreProvider` debounces `saveState` 250 ms after
   mount, so a snapshot persisted during a crashed session re-hydrates the same
   broken state on every reload — the crash can look permanent even after its cause
   is fixed.

**Fix path (two steps):**
- **Step 1 (user, first):** fix Bug 1, hard-refresh, and retry in an **incognito
  window** (fresh localStorage). If the crash vanishes, it was Bug 1 + stale snapshot.
- **Step 2 (Claude, only if the crash persists or when backend lessons load):**
  hardening plan §DEP7 — integrity gate on the lessons bootstrap + guards at the
  specific crash sites. Spec'd in `plan_for_claude_deployment.md` §DEP7.

## 3. Verification after the CORS fix (maps to plan_for_user Part 4)

1. Console clean on `https://qubitverse-green.vercel.app` (no CORS, no TypeError).
2. `GET https://qubitverse-backend.onrender.com/health` → 200 JSON.
3. Signup → login → dashboard renders (4.4 round-trip).
4. Network tab: `/api/lessons` → 200 with 5 lessons; API-mode label shows the Render URL.
5. If the TypeError reappears: note the page URL (hash) + full stack, and test
   incognito (stale-snapshot rule-out) → report back for §DEP7 pinpointing.

## 4. Notes

- The trailing-slash failure mode is exactly the gotcha-table row in
  `plan_for_user.md` ("CORS_ORIGIN ≠ exact Vercel domain (trailing slash …)") — the
  checklist predicted this; it wasn't executed as a byte-level check.
- `VITE_API_BASE_URL` trailing slash would be tolerated (`api.ts` strips it) — only
  `CORS_ORIGIN` is byte-exact. The domain to match is `qubitverse-green.vercel.app`.
- Reminder standing: rotate the vyceai key after the demo (prior incident).

— Buffy
