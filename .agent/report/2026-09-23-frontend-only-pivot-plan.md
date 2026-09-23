# Frontend-only pivot — review, findings & plan — Buffy (2026-09-23)

Read-only planning session. **No commands run, no source files touched.** All findings
below are from code reads; file:line references included so Claude can move fast.

## 1. Situation

Submission is tomorrow. User decision: **ship frontend-only** — accounts and progress in
localStorage, demo sign-in, sign-out lands on the dashboard. The backend (deployed on
Render yesterday) is **paused, not deleted**; the `backend/` folder stays for future work.

## 2. What the code already gives us (verified)

1. **A complete local mode already exists** — `src/services/api.ts` `createLocalApi()`:
   - signup/login with real **bcrypt-hashed** passwords in localStorage
     (`qubitverse.local-users.v1`, `api.ts:82-100`, `api.ts:186-215`);
   - snapshots via `state/persistence.ts` (load/save/clear, corrupt-tolerant);
   - real in-browser state-vector simulator (`runSimulation` → `quantum/simulator`);
   - local challenge evaluation mirroring the backend (`api.ts:157-184`);
   - rule-based tutor fallback (`services/tutor.ts`).
2. **Mode switch is one env var** — `api.ts:222` `API_BASE = import.meta.env.VITE_API_BASE_URL`;
   HTTP if set, local otherwise. Deleting the Vercel env var + redeploy is the whole switch.
3. **Demo sign-in already exists** — `pages/Auth.tsx:215-221` "Continue as the demo learner"
   → `signIn({ email: 'alex@qubitverse.dev', demo: true })`; `StoreProvider.tsx:420-425`
   signs in locally with zero backend calls.
4. **Fresh visitors already start as the demo learner** — `state/defaults.ts:34`
   `DEFAULT_SESSION.signedIn: true, demo: true`.
5. **E4b bootstrap no-ops safely in local mode** — `api.ts` `bootstrapLessons` returns
   immediately when `!API_BASE`; `main.tsx` 1.5 s race costs nothing.
6. **AI key path for the demo** — in local mode `askTutor` routes an OpenAI-compatible
   provider typed in Settings straight from the browser (`api.ts:127-131` →
   `services/llm.ts` `remoteTutorReply`). No code change needed for the user's choice to
   paste their own key at demo time (their explicit decision; key is visible in the
   browser — rotate after the demo; the vyceai key was already exposed once, see
   `2026-09-19-review-4-addendum-ai-provider.md`).

## 3. The two real gaps (why code changes are needed at all)

### Gap 1 (P0) — sign-out cannot reach the dashboard
Both sign-out buttons (`components/Layout.tsx:267-272`, `pages/Profile.tsx:146-151`) do
`signOut(); navigate('login')`, and `App.tsx:36-38` gates every app route behind
`state.session.signedIn` — a signed-out visitor hitting `#/dashboard` is redirected to the
login page. **User requirement:** sign out → dashboard (they said "dashboard (hero page)").
**Fix:** `signOut()` ends the user session, then auto-signs-in the demo learner; the two
call sites `navigate('dashboard')`. No routing/UI redesign. If the user actually meant the
public landing hero (`#/`), the only delta is `navigate('home')` at the same two sites.

### Gap 2 (P0) — sign-out destroys the user's only copy of progress
`StoreProvider.tsx:481-489` `signOut` = dispatch sign-out (reducer resets progress,
`reducer.ts:139-165`) + `api.clearState()`. In HTTP mode the server held the data; in
frontend-only mode localStorage **is** the only store — after sign-out, re-sign-in would
show empty progress. This directly violates the user's requirement "if user sign in then
user can see their progress data".
**Fix:** per-user snapshot scoping — `persistence.ts` gets
`loadUserSnapshot/saveUserSnapshot/clearUserSnapshot` keyed
`qubitverse.snapshot.v1:<email>`; StoreProvider saves per-user on the debounced save and
before sign-out, hydrates from the per-user key on sign-in. Logic-only, no UI.

## 4. User decisions (2026-09-23)

| # | Question | Decision |
|---|---|---|
| 1 | Sign-out destination | Dashboard, as the demo learner (hero-page wording noted; one-word alternative documented) |
| 2 | Auth page | **Keep both** email/password form and demo button — zero UI change |
| 3 | AI tutor for demo | User types their own key in Settings at demo time (accepted browser-visibility tradeoff) |
| 4 | Write the .agent files | Approved — this report + both plan files |

## 5. Plans written

- **Claude:** `.agent/plan/plan_for_claude.md` — new **Phase F** (F1 sign-out→demo→dashboard,
  F2 per-user progress scoping, F3 AI-settings verification, F4 full typecheck/test/build
  gate, F5 progress logging). Backend folder untouched; all historical phases below the
  divider are paused.
- **User:** `.agent/plan/plan_for_user.md` — new **Part 0** submission-day checklist
  (delete `VITE_API_BASE_URL` on Vercel → redeploy → 5-minute verification script →
  demo-day AI key steps → rehearsal). Historical Render/backend steps kept below.

## 6. Notes & risks

- **Upside vs Render:** localStorage survives reloads — this actually fixes the free-tier
  ephemeral-DB problem (users no longer vanish on redeploy).
- **localStorage caveats:** data is per-browser/per-device; incognito windows start empty;
  "clear site data" wipes accounts. Say this out loud on demo day if a judge switches devices.
- **HTTP-mode code stays** (`createHttpApi`, token logic, bootstrap) — deliberately kept so
  the backend can be re-enabled later by setting one env var. Do not rip it out.
- **Render service:** leave it parked (it spins down for free); don't delete it.
- Standing reminder: **rotate the vyceai key** after the demo.

— Buffy
