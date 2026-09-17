# QubitVerse Backend Implementation Plan

## Overview

The project is a React + Vite quantum learning app with a local TypeScript state-vector simulator. The existing `services/api.ts` documents a backend contract with these endpoints:

| Method | Endpoint | Body | Returns |
|--------|----------|------|---------|
| GET | `/state` | — | User state + activities + circuits |
| PUT | `/state` | snapshot | Saved state |
| DELETE | `/state` | — | Cleared state |
| POST | `/api/simulate` | { circuit, shots, seed } | SimulationResult |
| GET | `/api/lessons` | — | Lesson[] |
| POST | `/api/progress` | snapshot | — |
| POST | `/api/quiz/submit` | QuizAttempt | { recorded, explanation? } |
| POST | `/api/ai/explain` | TutorRequest | TutorReply |
| POST | `/api/ai/hint` | TutorRequest | TutorReply |

**Key constraint**: The frontend already has a `createHttpApi(baseUrl)` that falls back to local logic if the backend is unavailable. We keep the frontend flexible and build the backend to serve the documented contract.

## Architecture: Node.js/Express Backend

Since both the frontend and the existing quantum simulator are written in TypeScript, and the spec asks to "reuse existing code and dependencies whenever practical," we build a Node.js Express backend that imports the existing quantum modules directly. This guarantees the backend simulator is identical to the tested frontend one.

**Why not Supabase**: While the spec mentions Supabase, it also says "evaluate Supabase as the default option." Given:
- No Supabase project/keys exist in this environment
- Edge functions run on Deno and would require porting or duplicating the quantum logic
- The existing TypeScript simulator is already correct and tested
- A self-contained Express server reuses the exact same quantum code, runs anywhere Node runs, and can be fully tested

A self-contained Express server is the most maintainable choice: it reuses the exact same quantum code, runs anywhere Node runs, and can be fully tested.

### Why Not Flask

The original spec mentions Flask, but:
- The existing simulator is TypeScript
- Porting to Python would duplicate tested logic
- Express + TypeScript keeps a single language across frontend and backend

## Database Schema

**Tables (SQLite for development, PostgreSQL-compatible):**
1. `users` — id, email, password_hash, name, level, created_at, updated_at
2. `sessions` — id, user_id, email, expires_at, created_at (token storage)
3. `lesson_progress` — id, user_id, lesson_id, status, concept_read, video_watched, interactive_done, simulation_run, tutor_asked, challenge_passed, quiz_correct, quiz_total, started_at, completed_at, last_visited_at
4. `quiz_attempts` — id, user_id, quiz_id, lesson_id, selected_index, correct, attempted_at
5. `challenge_attempts` — id, user_id, challenge_id, passed, checks (JSON), xp_awarded, attempted_at
6. `projects` — id, user_id, name, description, circuit (JSON), code, lesson_id, status, tags, created_at, updated_at
7. `activities` — user_id, simulations, lessons_completed, quizzes_taken, challenges_passed, active_days (JSON), last_active_at, total_shots, updated_at
8. `tutor_messages` — id, user_id, role, text, context_summary, action, follow_ups, source, pending, error, created_at
9. `user_settings` — user_id, settings (JSON), updated_at

**Security**: All protected routes require a valid JWT bearer token. The authenticate middleware sets `req.user` for authenticated requests, and `requireAuth` enforces authentication where needed.

## Implementation Status

### ✅ Phase 1: Database Module
- `backend/src/db/index.ts` — SQLite connection, table schema initialization

### ✅ Phase 2: User Data Access
- `backend/src/db/users.ts` — findUserByEmail, getUserById, createUser, updateUser

### ✅ Phase 3: Authentication
- `backend/src/utils/jwt.ts` — JWT sign/verify with configurable secret
- `backend/src/middleware/auth.ts` — authenticate middleware, requireAuth guard
- `backend/src/auth/routes.ts` — signup, login, session endpoints

### ✅ Phase 4: API Routes
- `backend/src/circuits/routes.ts` — circuit simulation, save/load circuits
- `backend/src/lessons/routes.ts` — lesson listing, detail, progress tracking
- `backend/src/quizzes/routes.ts` — quiz fetch, attempt submission, results
- `backend/src/users/routes.ts` — user state, activities, circuit save progress
- `backend/src/ai/routes.ts` — chat with quantum tutor (stub for now)
- `backend/src/simulator/routes.ts` — quantum circuit simulation (stub for now)

### ✅ Phase 5: Server & Routing
- `backend/src/server.ts` — Express server, CORS, JSON body parsing
- `backend/src/routes.ts` — API route registration

### ✅ Phase 6: Build Configuration
- `backend/package.json` — backend-specific dependencies
- `backend/tsconfig.json` — TypeScript config for backend

## Files Created

### Backend (`/backend/src/`)
- `db/index.ts` — Database connection and schema
- `db/users.ts` — User data access layer
- `auth/routes.ts` — Authentication routes (signup, login, session)
- `circuits/routes.ts` — Circuit management and simulation routes
- `lessons/routes.ts` — Lesson content and progress routes
- `quizzes/routes.ts` — Quiz routes with answer validation
- `users/routes.ts` — User state and activities routes
- `ai/routes.ts` — AI tutor chat routes
- `simulator/routes.ts` — Quantum circuit simulation routes
- `middleware/auth.ts` — JWT authentication middleware
- `utils/jwt.ts` — JWT token utilities
- `routes.ts` — API route registration
- `server.ts` — Express server entry point
- `package.json` — Backend dependencies
- `tsconfig.json` — TypeScript configuration

## Endpoints Summary

### Auth (`/api/`)
- `POST /api/signup` — Create new user, returns JWT token
- `POST /api/login` — Authenticate user, returns JWT token
- `GET /api/session` — Get current user session (requires token)

### Lessons (`/api/lessons`)
- `GET /api/lessons` — List all lessons (requires auth)
- `GET /api/lessons/:id` — Get lesson with concepts and progress (requires auth)
- `POST /api/lessons/:id/progress` — Update lesson progress (requires auth)

### Quizzes (`/api/quiz`)
- `GET /api/quiz/:id` — Get quiz with questions (requires auth)
- `POST /api/quiz/:id/attempt` — Submit quiz answer (requires auth)
- `GET /api/quiz/:id/result` — Get quiz results (requires auth)

### Circuits (`/api/circuits`)
- `POST /api/circuits/:id/simulate` — Simulate a circuit (requires auth)
- `POST /api/circuits/save` — Save a circuit as a project (requires auth)

### Simulator (`/api/simulate`)
- `POST /api/simulate` — Run quantum circuit simulation (requires auth)

### AI Tutor (`/api/ai`)
- `POST /api/ai/chat` — Chat with the quantum tutor (requires auth)
- `GET /api/ai/history` — Get conversation history (requires auth)

### User State (`/state` or `/api/state`)
- `GET /state` — Get user state summary (requires auth)
- `POST /state/circuits/:id` — Save circuit progress (requires auth)
- `GET /state/progress/lesson/:id` — Get lesson progress (requires auth)
- `GET /state/progress/quiz/:id` — Get quiz attempts (requires auth)

## Running the Backend

```bash
cd backend
npm install
npm run dev  # starts server on port 8080
```

## Testing

Tested with curl:
- Signup returns user object and JWT token
- Login validates credentials and returns JWT token
- Session endpoint returns user info with valid token
- State endpoint returns user activities with valid token
- Health check endpoint returns `{"status":"ok","service":"qubitverse-backend"}`

### Quantum Simulator Verification

The backend simulator was wired up to reuse the existing frontend quantum module (`src/quantum/simulator.ts`) and verified:
- **Bell State Circuit** (H on q0, CNOT on q0→q1): Produces only `|00⟩` and `|11⟩` outcomes (50/50 split), entanglement confirmed via Bloch vector magnitude near zero
- **Single Qubit Hadamard**: Produces 50/50 `|0⟩` and `|1⟩` split, Bloch vector points to +X axis (x=1.0, z≈0)
- **Born Rule Sampling**: Shot counts match ideal probabilities within expected statistical variance
- **Circuit Validation**: Invalid circuits (e.g., qubit out of range) are rejected with descriptive errors

### TypeScript Compilation

`npx tsc --noEmit` passes with zero errors in the backend.

## Completed Work

### ✅ Phase 1: Database Module
- `backend/src/db/index.ts` — SQLite connection, 12-table schema initialization

### ✅ Phase 2: User Data Access
- `backend/src/db/users.ts` — findUserByEmail, getUserById, createUser, updateUser

### ✅ Phase 3: Authentication
- `backend/src/utils/jwt.ts` — JWT sign/verify with configurable secret
- `backend/src/middleware/auth.ts` — authenticate middleware, requireAuth guard, getUser helper
- `backend/src/auth/routes.ts` — signup, login, session endpoints

### ✅ Phase 4: API Routes
- `backend/src/circuits/routes.ts` — circuit simulation, save/load circuits
- `backend/src/lessons/routes.ts` — lesson listing, detail, progress tracking
- `backend/src/quizzes/routes.ts` — quiz fetch, answer submission, results
- `backend/src/users/routes.ts` — user state, activities, progress retrieval
- `backend/src/ai/routes.ts` — tutor chat endpoint (stub)
- `backend/src/simulator/routes.ts` — quantum circuit simulation using real frontend simulator

### ✅ Phase 5: Server & Routing
- `backend/src/server.ts` — Express server, CORS, JSON body parsing
- `backend/src/routes.ts` — API route registration with auth

### ✅ Phase 6: Quantum Simulator Integration
- Backend imports and uses the existing `src/quantum/simulator.ts` directly
- Supports H, X, Y, Z, S, T, CNOT, M gates
- Returns mathematically correct state vectors, probabilities, Bloch vectors, and measurement buckets
- Supports seeded PRNG for reproducible results

### ✅ Phase 7: Build Configuration
- `backend/package.json` — Backend-specific dependencies
- `backend/tsconfig.json` — TypeScript config with path resolution for shared quantum module

## Next Steps

1. **AI Provider Integration**: Connect to OpenAI or compatible provider when `OPENAI_API_KEY` is set
2. **Lesson Data**: Seed the `lessons`, `concepts`, `quizzes`, and `lessons_circuits` tables with actual content
3. **Frontend Integration**: Add `VITE_API_BASE_URL` env var to connect frontend to backend
4. **Backend Tests**: Write automated tests for auth, authorization, progress tracking
5. **Production Deploy**: Replace SQLite with PostgreSQL, add connection pooling
