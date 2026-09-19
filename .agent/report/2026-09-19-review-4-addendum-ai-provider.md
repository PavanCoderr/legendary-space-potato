# Addendum to Review #4 — AI tutor provider verified + key-exposure containment — Buffy (2026-09-19)

Context: after Review #4, the user provided AI-tutor provider credentials in
`.agent/resource/ai_tutor_api.md` and asked whether the tutor would use them.
Same session, all actions user-approved via the ask_user flow. This addendum
records verification evidence and the security containment. It also closes
**DEP3** and supersedes every OpenRouter instruction in both deployment plans.

## 1. Provider verification (the user's actual question) ✅

- Provider: **vyceai**, OpenAI-compatible endpoint (`https://vyceai.com/v1`),
  model **`agnes-3.0-flash`**.
- **ONE approved test call** → HTTP 200:
  `{"id":"chatcmpl-f7ff4b393262d1f983626975","object":"chat.completion","model":"agnes-3.0-flash","choices":[{"message":{"content":"OK"},...}],"usage":{...}}`
  — standard OpenAI-compatible shape, model exists, key valid.
- Backend consumption: `backend/src/ai/provider.ts` `resolveProvider()` — setting
  `OPENAI_API_KEY` activates `OpenAiCompatibleProvider`, which forwards
  `OPENAI_BASE_URL` and `OPENAI_MODEL`. **Zero code changes.**
- Env contract (local `backend/.env` / Render → Environment):
  `OPENAI_API_KEY`, `OPENAI_BASE_URL=https://vyceai.com/v1`,
  `OPENAI_MODEL=agnes-3.0-flash`. Do NOT also set `OPENROUTER_API_KEY`.
- Runtime note: the provider is cached on first AI request (`ai/routes.ts:39`),
  so model changes take effect on restart/redeploy — Render redeploys on env
  changes automatically.
- **DEP3 is CLOSED.** The OpenRouter `:free`-model hunt is moot; all OpenRouter
  rows in the plans were replaced with the vyceai OPENAI_* rows. (This also
  moots the NVIDIA doc-drift note from Review #4 §7's sibling finding — the
  OpenAI path is now actively used; wiring NVIDIA keys properly remains a
  possible future task, not needed for this deploy.)

## 2. Security containment (P0, user-approved, done) ✅

Finding: the raw API key sat in `.agent/resource/ai_tutor_api.md`. `.agent/` is
**git-tracked** (`git ls-files .agent/` lists files) in a **public** repo and
`.gitignore` had no exclusion for it → one `git add .` away from publishing the
key. The key was additionally shared in chat. Actions taken:

1. **Redacted** the file — setup info kept (provider, base URL, model, snippet
   with `process.env.OPENAI_API_KEY`), key replaced by `<SET-IN-RENDER-ENV>`.
2. **Gitignored** `.agent/resource/` — `.gitignore` line 13;
   `git check-ignore -v .agent/resource/ai_tutor_api.md` → verified ignored.
3. **Created `backend/.env`** (new file, untracked, ignored via
   `backend/.gitignore` line 20 — verified) with the three OPENAI_* vars, so the
   key has exactly one on-disk home.
4. Progress-log entry written warning Claude never to copy the key anywhere.

Residual risk + recommendation: the key was briefly in a tracked file (never
committed — `git ls-files` shows the resource file was untracked at the time of
redaction, and the folder is now ignored) and in chat. For a hackathon this is
acceptable; **the user should rotate the key on the provider dashboard after the
demo.** No history scrubbing is needed since nothing was committed.

## 3. Files touched this session (Buffy; no source code)

- `.agent/resource/ai_tutor_api.md` — key redacted (user-approved)
- `.gitignore` — added `.agent/resource/`
- `backend/.env` — created (untracked, ignored) with the three AI env vars
- `.agent/plan/plan_for_user.md` — Part 1 → RESOLVED (vyceai), Render env table
  → OPENAI_* rows, appendix env list updated, status board updated
- `.agent/plan/plan_for_claude_deployment.md` — DEP3 → RESOLVED, §3 env rows →
  OPENAI_*, §5 rewritten for vyceai
- `.agent/plan/plan_for_claude.md` — §DEP3 → RESOLVED with security notes
- `.agent/progress/plan_progress_claude.md` — DEP3-resolution log entry
- This addendum

## 4. What changes for the user's checklist

- Part 1 is done (nothing to pick or create). The only remaining Part 1 item is
  1.5: at deploy time, copy the three OPENAI_* values from `backend/.env` into
  Render env vars — never from chat or any repo file.
- Part 2's env table already reflects the new rows. Everything else in the plan
  (Parts 2–5) is unchanged and still gated on DEP1 + DEP2 + the D2 run.

— Buffy
