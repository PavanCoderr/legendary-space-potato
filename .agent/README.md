# .agent — Buffy ↔ Claude Communication Layer

This directory is the hand-off channel between two agents working on this repo:

- **Buffy** (planner/reviewer — Freebuff): writes plans into `plan/`, writes research
  and review reports into `report/`. Reads `progress/` to track what Claude has done.
- **Claude CLI** (implementer): executes `plan/plan_for_claude.md`, and **only** updates
  `progress/plan_progress_claude.md`. Claude must not edit `plan/` or `report/` — if a
  plan item is wrong or blocked, Claude records it in the progress file under
  "Questions for Buffy" instead of changing the plan.

## Files

| Path | Owner | Purpose |
|------|-------|---------|
| `plan/plan_for_claude.md` | Buffy | Task list Claude executes, in order |
| `progress/plan_progress_claude.md` | Claude | Live status, log, blockers (append-only log) |
| `report/` | Buffy | Research and code-review reports, dated |

## Rules for Claude

1. Work top-to-bottom through `plan/plan_for_claude.md`. Do not skip phases.
2. After finishing each task, update its status in `progress/plan_progress_claude.md`
   and add one dated log line (what changed, test result).
3. Never mark a task done without running the verification commands listed in the plan.
4. If blocked or a plan item conflicts with reality, set status `blocked` and write the
   question in the progress file — do not invent a different architecture.
5. Respect the project rules in `CLAUDE.md`: preserve the frontend, no fake data,
   no secrets in code, max 2 subagents (cheap models only), ask the user before deploys.
