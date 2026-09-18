# QubitVerse Development Instructions

## Project Goal

Implement the real backend for the existing QubitVerse quantum learning platform and connect it to the existing frontend.

## Critical Rule
echo "## Subagent Rules
- Maximum 2 subagents can run in parallel at any time
- Never use Claude Sonnet for subagents, use cheap models only
- Always ask for confirmation before running deploy commands" >> CLAUDE.md

Preserve the existing frontend.

Do NOT redesign, replace, or unnecessarily restructure:
- UI
- styling
- components
- pages
- routing

Minimal frontend changes are allowed only when required for backend integration.

## Development Rules

1. Inspect the existing repository before making architectural decisions.
2. Reuse existing code and dependencies whenever practical.
3. Do not create fake/mock production functionality.
4. Do not claim a feature is complete unless it has been tested.
5. Prefer simple, maintainable architecture.
6. Do not expose API keys or secrets.
7. Use environment variables/secrets for credentials.
8. Implement proper authentication and authorization.
9. Use database security/RLS where applicable.
10. Add automated tests for important backend functionality.

## Backend

No backend is currently configured.

Inspect the repository and determine the most suitable backend.

If no suitable backend exists, evaluate Supabase as the default option for:

- PostgreSQL
- Authentication
- Row Level Security
- Server-side functions

Do not introduce multiple competing backend systems.

## AI

The AI Tutor must use a server-side provider abstraction.

Do not permanently hard-code the project to one AI provider.

Possible providers can include NVIDIA, Gemini, OpenRouter, OpenAI, Anthropic, or another suitable provider.

Choose based on the current project requirements and availability.

API keys must never be exposed to the frontend.

## Quantum Simulator

The simulator must produce real mathematically correct results.

Never use fake probabilities or hard-coded simulation responses.

Support at least:

H, X, Y, Z, S, T, CNOT, Measurement

Initially support 1–2 qubits.

## Testing

Test:

- authentication
- authorization/RLS
- learning progress
- quizzes
- saved circuits
- quantum gates
- measurement
- AI error handling
- build/typecheck

## Workflow

Always work in this order:

Inspect → Plan → Implement → Test → Fix → Verify

Do not make large architectural changes without first inspecting the existing project.

For detailed requirements, read:

`backend-spec.md`