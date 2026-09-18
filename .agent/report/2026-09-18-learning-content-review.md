# Report: Learning Content Review (Frontend + Backend) — 2026-09-18

Author: Buffy (planner/reviewer). Read-only inspection of all curriculum data on both sides.

## 1. Content inventory

| Asset | Location | Size |
|-------|----------|------|
| Lessons | `src/data/lessons.ts` + duplicate `backend/src/data/lessons.ts` | 5 lessons: qubits(60xp), superposition(80xp), entanglement(100xp), gates(90xp), algorithms(120xp) = 450 XP |
| Quizzes | `src/data/quizzes.ts` + duplicate | 10 questions (2 per lesson, 20–25 XP each = 220 XP) |
| Challenges | `src/data/challenges.ts` + duplicate | 5 challenges (bit-flip 40, superposition 50, Bell 80, HZH 70, Grover 120 = 360 XP) |
| Glossary | `src/data/glossary.ts` only | ~15 entries, not in backend at all |
| Achievements | `src/data/achievements.ts` only | 9 achievements with XP bonuses, predicate-based |
| Topics | both sides | 5 topics |
| Stages | `src/data/stages.ts` | 7-stage lesson flow definition |
| Sample projects | `src/data/projects.ts` | 4+ starter projects |

Each lesson is rich and well-structured: concept (heading/paragraphs/keyPoints/math),
outline, video (YouTube), interactive lab with completion check, worked example circuit,
visualization notes, AI prompts, 2 quizzes, 1 challenge. The quality of the existing
content is genuinely good — explanations are correct, specific, and pedagogically ordered.

## 2. Findings

### F1. MATH ERROR — `qubits-1` quiz explanation is wrong ❌ (highest priority)

`src/data/quizzes.ts:13-15` (and the backend duplicate + seeded DB copy):

> explanation: 'The Born rule says the probability is the squared magnitude of the
> amplitude: |0.6|² = 0.36 and |0.8|² = 0.64. The amplitudes themselves are not
> probabilities (and note that 0.6 + 0.8 ≠ 1).'

`|ψ⟩ = 0.6|0⟩ + 0.8|1⟩` is **not a valid quantum state** — |0.6|² + |0.8|² = 0.36 + 0.64
= 1.0. The state IS normalised. The parenthetical "(and note that 0.6 + 0.8 ≠ 1)" is
mathematically irrelevant (raw amplitudes never need to sum to 1) and the framing
suggests the question-writer thought the state was invalid. The answer option B
("0.36/0.64") is correct, but the explanation undermines confidence and contradicts the
lesson's own statement that normalization is required (`|α|² + |β|² = 1`).

**Fix options** (pick one):
- Keep numbers, fix explanation: "...0.36 + 0.64 = 1, so the state is properly
  normalised. Note the amplitudes themselves (0.6 + 0.8 = 1.4) do not sum to 1 — only
  their squared magnitudes must."
- Or change the state to an unnormalised example on purpose and make "is this state
  valid?" the question — but that changes the question id semantics and DB seeds.

### F2. Content is duplicated in two trees — drift has already started ⚠️

`src/data/lessons.ts` (466 lines) vs `backend/src/data/lessons.ts` (465 lines): same
content but the backend copy strips Lucide icon components (backend `types.ts` says icon
is a string). The two trees are copies maintained by hand — any content edit must be made
twice, and nothing enforces sync. `backend/src/db/seed.ts` seeds from the backend copy;
the frontend renders from its own copy. The spec says "YouTube IDs must be stored as
editable backend data rather than being scattered through frontend code" — today they
live in BOTH places (`src/data/lessons.ts` has real `youtu.be/...` ids).

### F3. Backend serves thin lesson data; frontend ignores it ⚠️

`GET /api/lessons` returns the raw `lessons` table row (id, title, description, order,
category, duration, difficulty) — no concepts, video, outline, labs, or example circuits.
The full lesson JSON (including video object) is stuffed into the `description` column of
the seeded row, but `GET /api/lessons` does not unpack it, and the frontend never calls
the API for lessons anyway: `pages/Learn.tsx`, `Lesson.tsx`, `Dashboard.tsx` etc. all
import `LESSONS` from `src/data/lessons.ts` directly. `services/api.ts` local fallback
returns `LESSONS` (line 142) — so the "editable backend data" requirement is not actually
met end-to-end.

### F4. Backend has no endpoints for challenges, glossary, or achievements ❌

- Challenges are seeded into 3 tables (`challenges`, `challenge_objectives`,
  `challenge_hints`) but **no route reads them** — dead data.
- Glossary and achievements exist only in the frontend bundle.

### F5. Quiz model is 1-question-per-quiz ⚠️

`quizzes.ts` models each quiz as a single question (`${quiz.id}-q-main`). The schema
supports N questions per quiz, and the lesson page shuffles "the order per attempt" per
the quizzes.ts comment — but with 1 question per quiz there is nothing to shuffle. The
`GET /api/quiz/:id` route strips `correct_index` correctly; fine. But 10 questions total
for 5 lessons is thin for a learning platform; wrong answers currently only appear after
submission.

### F6. Video metadata is incomplete ⚠️

Every lesson has `duration: ''` and `chapters: []`. The `outline` section items have
minutes that don't relate to the video. `VIDEO_PLACEHOLDER` mechanism exists but all 5
lessons already have real YouTube ids — good. The backend contract comment says IDs
should be editable backend data (spec §2) — currently they're only editable by editing
two TS files.

### F7. `prerequisites` + `locked` handling

All lessons ship `locked: false`; unlocking is computed client-side from prerequisites
(`state/selectors.ts:21-23`). The backend `/api/lessons` response carries neither
`prerequisites` (unless unpacked from description JSON) nor any authorization concept of
"you may not open lesson X yet" — fine for MVP, but spec §2 asks for lesson ordering,
which the backend does have (`order` column + lessonOrder map).

### F8. Orphan content: `SAMPLE_PROJECTS` timestamps are fake

`src/data/projects.ts` hard-codes created/updated dates (Aug 2026) for "starter
projects" that are presented as user projects. Minor, but per project rules ("no fake
data"), sample content should be clearly labeled as samples or seeded as reference data
with honest metadata.

## 3. Improvement plan (what I recommend)

### Content correctness (P0)
1. Fix F1 in BOTH `src/data/quizzes.ts` and `backend/src/data/quizzes.ts` (and reseed —
   the DB has the wrong explanation cached; `INSERT OR REPLACE` on next startup fixes it,
   but verify).
2. Add a content test: assert every quiz explanation references only mathematically valid
   states (at minimum: re-parse stated amplitudes where present; or simpler — a small
   review checklist test that |α|²+|β|²=1 for every state literal that appears in quiz
   questions/options/explanations). This is cheap and prevents regression.

### Single source of truth (P1)
3. De-duplicate: make `backend/src/data/*` re-export or copy from `src/data/*` at build
   time, OR move curriculum content to JSON files under `content/` imported by both
   sides. Given the no-frontend-redesign rule, the least invasive option is: keep TS
   modules, but add a CI/test that deep-compares `LESSONS`/`QUIZZES`/`CHALLENGES`
   between the two trees and fails on drift.
4. Serve full lesson payload from backend: `GET /api/lessons` should return the unpacked
   JSON from the seeded `description` (title, summary, objectives, video, outline, quiz
   ids, challenge id) — the frontend can then migrate `pages/*` imports to the API
   service incrementally WITHOUT UI changes (pure data-source swap in `services/api.ts`).

### Fill backend gaps (P1)
5. Add `GET /api/challenges` + `GET /api/challenges/:id` reading the already-seeded
   tables (thin route, reuses existing data — spec §2 "reuse existing educational
   content").
6. Add `GET /api/glossary` + `GET /api/achievements` (static reference data; cheap, makes
   search/profile fully backend-driven later).

### Content depth (P2 — actual learning improvements)
7. Add 2–3 more quiz questions per lesson (bank supports N questions; makes the shuffle
   feature real and retakes meaningful). Suggested new topics:
   - qubits: global vs relative phase; why shots/1000 samples (statistical estimation)
   - superposition: H·H = I verification; predicting Bloch vector after Z on |+⟩
   - entanglement: product vs entangled discrimination; CNOT truth table
   - gates: S vs T rotation angles; why Z on |0⟩ does nothing measurable
   - algorithms: oracle phase kickback; iteration count scaling ⌈π/4·√N⌉
8. Fill `video.chapters` from `outline` items with timestamps — the chapter UI already
   supports it and it improves the Watch stage.
9. Lessons `algorithms` is `intermediate` while all others are `beginner` — consider one
   more `advanced`/`intermediate` lesson (e.g. "Measurement & mixed states" using the
   existing density/Bloch-shrinkage content) so the intermediate tier isn't a single
   jump. This is additive content, not UI work — allowed.

### Honest sample data (P2)
10. Mark `SAMPLE_PROJECTS` dates as generated (e.g. relative to first load) or label
    them "sample" in metadata.

## 4. What I deliberately do NOT recommend

- Restructuring the lesson data model or UI — content quality is already good; the gaps
  are duplication, math error, and un-served endpoints.
- Adding new topics (circuit-building, programming exist as TopicIds with zero lessons) —
  tempting, but new curriculum design is a bigger decision than this review.

— Buffy
