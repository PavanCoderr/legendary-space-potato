# QubitVerse Backend Hardening — Progress (Claude)

Started: 2026-09-18

## Phase A — Security & correctness (P0)

- [x] A1: Removed fake simulation result in `backend/src/circuits/routes.ts` — replaced with real `simulate()` call using deserializeCircuit + simulate from quantum module
- [x] A2: Enabled `PRAGMA foreign_keys = ON` in `backend/src/db/index.ts` for every connection
- [x] A3: Git hygiene — `.gitignore` updated with `*.db`, `data/`, `.env`, `.env.*`, `!.env.example`; `.env.example` created with all env var names. **Awaiting user approval for `git rm --cached data/qubitverse.db`**
- [x] A4: Debug endpoints (`/api/debug/cors`, `/api/debug/jwt`) now gated behind `NODE_ENV !== 'production'`
- [x] A5: Real logout/session revocation — sessions table writes at login/signup, JWT jti, authenticate middleware checks session validity, logout deletes only current session
- [x] A6: Delete `backend/test-tsx5.ts` — confirmed file doesn't exist

All 88 existing tests pass after Phase A changes.

## Phase B — XP, streak, achievements server-side (P0)

- [ ] B1: Schema changes (xp, streak columns; xp_ledger, user_achievements tables)
- [ ] B2: Server-side award logic
- [ ] B3: Expose state to existing UI

## Phase C — Hardening (P1)

- [ ] C1: Rate limiting
- [ ] C2: Validate circuit JSON on save
- [ ] C3: AI stub honesty
- [ ] C4: Minimal migrations
- [ ] C5: Frontend auth integration check

## Phase D — Tests & verification

- [ ] D1: New/updated backend tests
- [ ] D2: Full verification run

## Phase E — Learning content fixes (added by Buffy 2026-09-18)

Evidence: `.agent/report/2026-09-18-learning-content-review.md`. Content edits go in BOTH `src/data/` and `backend/src/data/`.

- [ ] E1 (P0): Fix `qubits-1` quiz explanation — the state 0.6|0⟩+0.8|1⟩ IS normalised (0.36+0.64=1). New text is in the report §F1 / plan E1. Then reseed and verify `GET /api/quiz/qubits-1`.
- [ ] E2 (P0): Content sanity test — valid correctIndex, non-empty options, and every amplitude state literal in a question satisfies |a|²+|b|²=1 (tol 1e-9). Both sides.
- [ ] E3 (P1): Drift test — deep-compare content fields between the two data trees (ids, titles, xp, quizIds, challengeId, video.youtubeId, all quiz question/options/correctIndex/explanation).
- [ ] E4 (P1): `GET /api/lessons` returns full unpacked lesson JSON. **Design doc: `.agent/report/2026-09-18-e4-design.md` — implement from it as written.** No frontend page/component changes (doc's allowed footprint: `services/api.ts`, additive `src/data/lessons.ts`, 3 lines in `main.tsx`).
- [ ] E5 (P1): Add `GET /api/challenges(/:id)` (data already seeded, no route reads it), plus `GET /api/glossary` and `GET /api/achievements`.
- [ ] E6 (P2, ✅ user-approved 2026-09-18): Implement the 12 quiz questions EXACTLY as drafted in `.agent/report/2026-09-18-e6-quiz-draft.md` — no rewording — in both trees; fill `video.chapters` from outlines. If any question conflicts with the simulator, mark E6 blocked and ask — do not edit approved content.

## Log (append-only, newest last)

- 2026-09-18 (Buffy) — A1 VERIFIED against code: fake 256-counts block, TODO comment, and `qiskit-stubs` note are gone from `backend/src`. Claim confirmed.
- 2026-09-18 (Buffy) — A6 handling confirmed honest: file was already absent, correctly noted instead of fake-checked.
- 2026-09-18 (Buffy) — Phase E added. E6 contains user-approved quiz content: implement exactly as drafted.
- 2026-09-18 (Buffy) — **AUDIT #1 complete → `.agent/report/2026-09-18-audit-1.md`.** A1–A6 verified TRUE. B work exists but: ❌ duplicate-XP hole (xp_ledger has no UNIQUE constraint; quiz route awards every correct resubmit — fix with UNIQUE index + INSERT OR IGNORE), ❌ B3 not wired (`/state` response has no xp/streak/achievements), ⚠️ streak bug (updateStreak UPDATEs activities row that may not exist yet — INSERT OR IGNORE first), ⚠️ add `requireAuth` to protected route chains in routes.ts, ⚠️ progress file stale: mark B1/B2/B3 partial. E1 (P0) still untouched. Claude: address audit items before Phase C.

## Questions for Buffy (Claude writes here; Buffy answers below each question)

- (none yet)
