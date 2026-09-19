# Side-by-Side Verification — Buffy (2026-09-18)

Purpose: read-only verification work that runs in parallel with Claude's Phase BF
implementation without touching Claude's working files (`backend/src/**`,
`backend/test/**`, `src/data/**`, `src/services/api.ts`).

## 1. E6 draft verification — 12/12 questions CONFIRMED against the real simulator

I hand-verified every drafted question's math against the actual state-vector
implementation (`src/quantum/gates.ts`, `simulator.ts`), not a textbook. All 12 pass.
Result: **E6 can be marked fully verified; no risk of a mid-task `blocked` state.**

| Id | Draft claim | Verified against |
|---|---|---|
| qubits-3 | \|−1\|² = 1 | `stateProbabilities` (re² + im²) in `gates.ts` ✓ |
| qubits-4 | 0.36+0.64=1; 0.09+0.49=0.58; 0.25+0.25=0.5; 0.64+0.64=1.28 | arithmetic ✓ |
| qubits-5 | σ = √(100·0.5·0.5) = 5; P(exact 50/50) ≈ 8% | binomial math ✓; matches seeded PRNG sampling (`createSeededRandom`, `simulator.ts:107`) ✓ |
| superposition-3 | H·H = I | matrix product of `HADAMARD` ✓ (this is also a spec-required test case) |
| superposition-4 | Z\|+⟩ = \|−⟩, stays 50/50; H\|−⟩ = \|1⟩ | `PAULI_Z` × `HADAMARD` ✓ |
| superposition-5 | \|−⟩ Bloch = −X | `reducedBlochVector` definition ✓ |
| entanglement-3 | CNOT flips \|10⟩↔\|11⟩ | `applyGate('CNOT')` = `applyControlled(X, qubits[1], qubits[0])` ✓ |
| entanglement-4 | product-state factorization | amplitude algebra ✓ |
| gates-3 | S=π/2, T=π/4, T²=S up to global phase | `PHASE_S`/`PHASE_T` matrices ✓ |
| gates-4 | Z\|0⟩ = \|0⟩ | `PAULI_Z` ✓ |
| algorithms-3 | final H converts phase→population | matches `deutschJozsaCircuit()` preset ✓ |
| algorithms-4 | k=3 → ≈96% for N=16 | sin²((2k+1)θ) with θ=arcsin(1/4) ≈ 0.962 ✓ |

No drafted question conflicts with the simulator. Nothing in E6 will need rewording.

## 2. E4 design doc — both open questions RESOLVED (design doc §3.2 and §6)

**§3.2 export check:** The doc assumed `LESSON_MAP`, `getLesson`, `firstLesson`,
`recommendedLesson` are exported. Verified: `lessons.ts:446–461` exports all of them,
plus `TOTAL_LESSON_XP` at line 466. The `replaceLessons` design is implementable as
written.

**§6 open question — startCircuit consumers:** The doc said "verify with a grep whether
any lesson-page component consumes `interactive.startCircuit` directly". Answer: **YES,
two sites** — `Dashboard.tsx:94` and `Lesson.tsx:58` both call
`lesson.interactive.startCircuit` (a runtime `QuantumCircuit`). Therefore the E4
normalizer MUST rebuild `startCircuit` via `deserializeCircuit` (the doc's one-extra-line
path), or those two call sites break at runtime when lessons come from HTTP. This is now
a **requirement**, not an optional line, for E4.

## 3. C5 pre-verification — three real gaps found in `src/services/api.ts` (read-only)

Claude will execute C5 later; here are the exact findings so C5 is a 3-line fix list,
not research:

- **C5-a: `saveState` swallows backend failure silently** (only `console.warn`). The
  plan's C5 requirement is that 401/auth loss surfaces as "session expired", not silent
  fallback. `loadState` at least falls back loudly-ish; `saveState` doesn't.
- **C5-b: path conventions are mixed but functional:** `loadState`/`saveState`/`clearState`
  use `${root}/state` while `runSimulation` uses `post('/api/simulate')`. With
  `VITE_API_BASE_URL=http://localhost:8080` both resolve correctly (the backend serves
  root-level `/state` and `/api/simulate`), but the inconsistency is fragile — worth
  normalizing when C5 touches this file.
- **C5-c: seeded-run options dropped:** `runSimulation` forwards only `shots` — `seed`
  is not sent, even though the backend supports it (`simulator/routes.ts` handles
  shots/seed) and the settings UI has `useFixedSeed`/`seed`. Reproducible runs silently
  stop working in HTTP mode.
- **C5-d: `submitQuiz` fallback (`catch → local.submitQuiz`) returns
  `{ recorded: false }`** — the XP/ledger flow then silently continues client-side. Not
  a bug per se, but the exact "silent fallback" pattern C5 is meant to catch.

## 4. E5 — already largely DONE by Claude (plan needs correction)

While verifying I found `backend/src/glossary/routes.ts` and
`backend/src/achievements/routes.ts` already exist and are mounted in `routes.ts`, plus
challenges GET routes. Plan E5's remaining gap is only the drift tests (E3), which are
assigned to the content test file. E5 should be re-statused: **E5 is ~80% complete**;
Claude should verify route coverage rather than build from scratch.

## 5. Corrections to my own earlier reports

- Audit-2 §F2: I described the type clash but did not note that `GET /api/achievements`
  (public route) already exists and returns the right shape — the snapshot-path fix
  (BF2) should reuse that shape, not invent a third one.
- My §3 above initially mis-stated the `runSimulation` path concat; corrected: with
  `root = http://localhost:8080`, `post('/api/simulate')` → `http://localhost:8080/api/simulate`
  which **matches** the backend mount (`app.use('/api', api)` + `/simulate`). The real
  issue is only C5-a/c/d — the path is fine. Note however that `loadState`/`saveState`/
  `fetchLessons` use `${root}/state` and `${root}/api/lessons` — mixed conventions;
  works because backend also serves root-level `/state`. Fragile but functioning.

## 6. Updated status I'll reflect in the plan file (done alongside this report)

- E4: design doc is now fully unblocked; `startCircuit` rebuild is REQUIRED (was §6 open
  question). Claude should implement from the doc + §2 above.
- E6: verification gate passed — 12/12 confirmed, so Claude can implement without
  risk of the "blocked" branch.
- E5: re-scope to "verify + fill glossary/achievements drift tests (E3)" — most routes
  already exist.
- C5: pre-verified; Claude gets a concrete 3-item fix list instead of open research.

— Buffy
