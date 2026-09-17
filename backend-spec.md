# QubitVerse Backend Specification

## 1. Authentication

Implement:

- Email/password signup
- Email/password login
- Logout
- Session persistence
- Current user
- User profile

Users must only access their own private data.

----

## 2. Learning System

Support:

- Courses
- Topics/modules
- Lessons
- Lesson descriptions
- YouTube video IDs
- Lesson ordering
- Lesson completion

Inspect the existing project for existing educational content and reuse it.

YouTube IDs must be stored as editable backend data rather than being scattered through frontend code.

---

## 3. Student Progress

Persist:

- completed lessons
- quiz attempts
- quiz scores
- XP
- streak
- achievements
- course progress
- overall progress

Prevent duplicate XP rewards.

Progress must survive logout/login and page refresh.

---

## 4. Quiz System

Store:

- quizzes
- questions
- options
- correct answers
- explanations

Implement:

- quiz retrieval
- answer submission
- secure scoring
- result persistence
- XP integration

Never expose correct answers to the client before submission.

Never trust a client-provided score.

---

## 5. Quantum Simulator

Inspect the existing circuit UI and adapt the backend to it.

Support:

- H
- X
- Y
- Z
- S
- T
- CNOT
- Measurement

Support 1–2 qubits initially.

Use a suitable quantum library if practical.

Otherwise implement a correct lightweight state-vector simulator.

Return:

- quantum state
- basis states
- amplitudes where useful
- measurement probabilities
- measurement result

Do not generate fake simulation results.

Test known circuits including:

- X|0> = |1>
- H|0> = 50/50
- H followed by H = |0>
- X followed by X = |0>
- Bell state using H + CNOT
- probability normalization

---

## 6. Saved Circuits

Users can:

- create
- save
- load
- update
- delete

Saved circuits must belong to the authenticated user.

Use authorization/RLS to prevent cross-user access.

Validate circuit data before saving or simulating.

---

## 7. AI Quantum Tutor

Inspect the existing AI Tutor UI.

Implement server-side AI access.

The tutor should support:

- concept explanations
- gate explanations
- circuit explanations
- simulation-result explanations
- hints
- common circuit mistakes

Use a provider abstraction.

Possible providers:

- NVIDIA
- Gemini
- OpenRouter
- OpenAI
- Anthropic
- another suitable provider

Choose a practical provider after inspecting the project and current availability.

Do not expose API keys in frontend code.

If no provider is configured, return a clear configuration message instead of fake AI responses.

---

## 8. Backend Security

Implement proper authorization.

Private resources must only be accessible by their owner.

Do not trust:

`user_id`

sent from the frontend.

Use the authenticated session/user identity.

If Supabase is selected:

- use migrations
- use RLS
- use authenticated requests
- keep service-role credentials server-side

---

## 9. Frontend Integration

Connect existing pages/components to the real backend.

Allowed:

- API calls
- service functions
- state updates
- loading states
- error states
- success messages
- validation

Not allowed:

- visual redesign
- replacing the existing UI
- unnecessary routing changes
- unnecessary component rewrites

Remove mock data only from production flows once real backend functionality is connected.

---

## 10. Code Architecture

Create reusable service/API functions following the existing project conventions.

Avoid scattering database calls throughout UI components.

Maintain TypeScript types if the project uses TypeScript.

Avoid unnecessary dependencies.

---

## 11. Database

If Supabase is selected:

Create reproducible SQL migrations.

Use normalized tables and appropriate:

- primary keys
- foreign keys
- indexes
- constraints
- timestamps
- RLS policies

Create seed data only where useful.

Reuse existing course/quiz content if present.

---

## 12. Testing

Create automated tests for:

### Auth
- signup
- login
- logout
- session persistence

### Security
- ownership
- unauthorized access
- ID manipulation
- RLS

### Learning
- lessons
- completion
- progress

### Quiz
- scoring
- invalid submissions
- manipulated scores

### Quantum
- H
- X
- Y
- Z
- S
- T
- CNOT
- measurement
- normalization
- Bell state

### Saved circuits
- create
- read
- update
- delete
- ownership

### AI
- configured provider
- missing provider
- provider failure

Run existing tests before and after changes.

Also run:

- typecheck
- lint
- build

Fix failures before declaring completion.

---

## 13. Environment

Create/update `.env.example`.

Never commit:

- API keys
- passwords
- Supabase service-role keys
- AI provider secrets
- real `.env` files

Document required setup.

---

## 14. Definition of Done

Do not say "complete" merely because code exists.

A feature is complete only when it is:

- implemented
- integrated
- tested
- buildable
- actually verified

Final report must contain:

### Implemented
What was completed.

### Database
Tables, migrations and security.

### Backend
Functions/services.

### Quantum
Supported gates and test results.

### AI
Provider and configuration.

### Frontend
Connected pages/features.

### Tests
Actual results.

### Setup Required
Commands, environment variables and secrets.

### Remaining
Anything genuinely unfinished.