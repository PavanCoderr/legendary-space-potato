# QubitVerse

An AI-based interactive quantum learning platform: learn a concept, watch the teaching video, build the
circuit, simulate it, read the quantum state, ask a contextual tutor why, then pass a challenge.

Everything runs locally in the browser — a real state-vector simulator, real measurement sampling,
no hard-coded results and no API key required. The backend is not implemented yet; the frontend is
structured so a Python/Flask service plus a quantum backend can be connected later (see below).

Brand: **Learn Quantum. Build Quantum. Understand Quantum.** — *Your interactive journey into quantum
computing.*

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle
npm test           # 86 tests: quantum engine, state formatting, gate matrices, WCAG contrast audit, full UI journey, route smoke test
npm run typecheck
```

## The primary demo journey

Landing page → Sign up (with a learning level) → Dashboard → topic page → Superposition lesson →
**mark the teaching video watched** → interactive **H** gate → Run circuit → probabilities →
Bloch sphere → Ask AI → Bell-state practice challenge → XP and progress updated → Profile.

Each step is covered by `src/app.test.tsx`, which drives the real components and store, and every route is
rendered by `src/smoke.test.tsx`, which fails on any React error or warning.

## Adding your own YouTube teaching video

Every module has one teaching video, defined as data — the iframe is never hard-coded into a page:

```js
// src/data/lessons.ts
{
  id: 'superposition',
  title: 'Superposition',
  video: {
    youtubeId: VIDEO_PLACEHOLDER,          // ← put your video id here
    title: 'Superposition and the Hadamard gate',
    duration: '12:45',
    summary: '…',
    chapters: [{ at: '03:05', label: 'The Hadamard matrix' }],
  },
  outline: [ /* the module's named lessons, shown in the topic navigator */ ],
  …
}
```

Replace `VIDEO_PLACEHOLDER` with the id from the video URL (`https://youtu.be/<id>`) and the
`<YoutubeLessonVideo />` component picks it up, together with the chapter jump list, the duration
badge, the **Watch on YouTube** button, **Mark as watched** and the video progress bar. While the id
is still the placeholder the player renders an "add your video" poster instead of a broken iframe.
Lesson content, quizzes, challenges and outline lessons are all data too, so a new lesson never
requires touching a component. Until a video id is set, the lesson shows an author note in place of the
player rather than a broken iframe.

The `duration` and `chapters` shipped in that file are placeholders and match no real video — retune them
to the video you attach, or set `duration: ''` and `chapters: []` to hide both cleanly.

## Numbers that are counted, not typed

The hero stats, the module lesson counts, the gate count, the version in the footer and the achievement
thresholds are all derived from the data files (`LESSONS`, `GATE_DEFS`, `QUIZZES`, `CHALLENGES`,
package.json). `data/site.test.ts` asserts the displayed version against package.json, and
`data/achievements.ts` derives "finish every module" from `LESSONS.length`, so adding a sixth module
cannot leave stale copy behind.

## Areas

| Area | What it does |
| --- | --- |
| Landing (`#/`) | Hero with a live Bell-state circuit, probability bars, an animated Bloch sphere, the five modules with their lesson titles, the seven-stage walkthrough, a gate matrix reference and a footer colophon |
| Login / Signup | Mocked sessions with a learning level (Beginner / Intermediate / Advanced); signing out returns you to the gate |
| Dashboard | XP/level, continue-learning card, topic mastery, recent activity, recent projects, quick actions, achievements |
| Learn | Topic cards (number, difficulty, progress, lesson count, estimated time) plus the full curriculum, filtered by subject |
| Module page (`#/learn/:topic`) | Difficulty, estimated time and progress header, lesson navigator on the left, content on the right |
| Lesson | The seven-stage flow — Learn → Watch → Visualize → Experiment → Ask AI → Practice → Complete — with a vertical progress timeline |
| Circuit Builder | Drag-and-drop grid (H, X, Y, Z, S, T, CX, M), inspector, presets, save/load, code mode |
| Simulator | Shots/seed/auto-run controls, initial and final state in Dirac notation, probabilities, measurement counts, amplitudes, per-qubit marginals, step timeline |
| AI Tutor | Contextual answers from the live lesson, circuit, gate, state, result and challenge |
| Practice | Five validated challenges plus the full quiz bank |
| Progress | Circular overall-progress chart, per-topic mastery, skills breakdown, streak strip, checkpoints, achievements |
| Profile | Avatar, level, XP, streak, learning level, completed lessons, capability snapshot and achievement cards |
| Projects | Create/open/rename/duplicate/delete saved circuits and code |
| Settings | Simulator defaults, AI provider, profile, export/import/reset of local data |
| Global search | `Ctrl/Cmd-K` or `/`, grouped into Lessons · Videos · Practice · Concepts |
| Notifications | Progress-derived nudges (streak, next step, waiting challenge, unlocked achievements) with read state |
| Theme toggle | Light / dark / system switcher in the topbar, landing nav and auth screens; persisted with the rest of the settings and applied before first paint |

## Architecture

```
src/
  quantum/      engine: complex maths, gates, circuit model, simulator, Bloch vectors, code parser
  data/         domain types + content (lessons + videos + outlines, quizzes, challenges,
                achievements, glossary, sample projects) and the shared lesson-stage and
                site-metadata definitions
  state/        single store (reducer + context), selectors, local persistence
  services/     analysis (interpretation), tutor (offline AI engine), llm (remote provider),
                search (global index), gateReference (gate matrices for display), api (backend boundary)
  components/   layout shell, circuit grid, Bloch sphere, charts, tutor panel, challenge panel,
                quiz card, YouTube lesson player, global search, notifications, topic/lesson cards
  pages/        one page per area
```

Key invariants:

- **One circuit.** The builder, simulator, visualizations, lessons, practice and tutor all read
  `state.circuit`, so they can never disagree about what is loaded.
- **Simulation is separate from rendering.** `quantum/simulator.ts` evolves a state vector, applies the
  Born rule and samples shots; components only display the resulting data.
- **AI is separate from UI.** `services/tutor.ts` holds the offline rule engine, `services/llm.ts` wraps
  any OpenAI-compatible endpoint behind the same `TutorReply` interface.
- **Content is data, never JSX.** Videos, outline lessons, quizzes, challenges and glossary terms live in
  `src/data` so search, lessons and progress all read the same source.
- **One description of the flow, and one matrix per gate.** The seven lesson stages come from
  `data/stages.ts` and are rendered by both the landing page and the lesson rail; the matrices shown in the
  course catalogue come from `GATE_DEFS` via `services/gateReference.ts`, the same table the simulator
  multiplies. Neither can drift away from the thing it describes.
- **One icon set, one notation.** Every icon is a Lucide component (no Unicode glyphs or emoji mixed in) and
  every ket in user-facing copy is written `|0⟩`.
- **One source of theme truth.** `state/theme.ts` writes `data-theme` on `<html>`; every surface colour in
  `styles.css` reads a CSS custom property that attribute switches, and the Bloch-sphere canvas picks its
  palette from the same resolved theme at draw time.
- **Session is mocked but real in shape.** `state.session` records who is learning and at what level;
  no password is ever stored or sent. Swapping in a real auth service means replacing `signIn`/`signOut`.
- **Backend boundary.** All persistence goes through `services/api.ts`. Setting `VITE_API_BASE_URL`
  switches state, simulation, tutoring and progress sync to HTTP.

## Backend contract (future Python/Flask service)

| Method | Endpoint | Body | Returns |
| --- | --- | --- | --- |
| `loadState` | `GET /state` | — | `PersistedSnapshot` |
| `saveState` | `PUT /state` | snapshot | — |
| `clearState` | `DELETE /state` | — | — |
| `runSimulation` | `POST /api/simulate` | `{ circuit, shots }` | `SimulationResult` |
| `askTutor` | `POST /api/ai/explain` | `{ prompt, action, context }` | `TutorReply` |
| `askHint` | `POST /api/ai/hint` | `{ prompt, action, context }` | `TutorReply` |
| `fetchLessons` | `GET /api/lessons` | — | `Lesson[]` |
| `saveProgress` | `POST /api/progress` | snapshot | — |
| `submitQuiz` | `POST /api/quiz/submit` | `QuizAttempt` | `{ recorded, explanation? }` |

Any endpoint the backend does not implement yet falls back to the local implementation, so the app
stays fully functional while the service is built out one route at a time.

## Physics notes

- Qubit 0 is the leftmost character of a basis label (`|q0 q1⟩`).
- Measurement gates execute at the end of the circuit, matching Qiskit's `measure_all()`; counts are
  sampled from the final state via the Born rule, so Bell circuits really do yield only `|00⟩`/`|11⟩`.
- Bloch vectors come from the reduced density matrix, so entangled qubits correctly show a vector
  shorter than the sphere radius.
- Exponents, gate identities and challenge thresholds are computed at check time; none of the numbers
  in the UI are stored constants.
- Skills scores, mastery percentages and the activity feed are all derived from recorded activity —
  see `src/state/selectors.ts`.
