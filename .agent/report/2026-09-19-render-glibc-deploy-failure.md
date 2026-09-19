# Render Deploy Failure — sqlite3 GLIBC mismatch — Buffy (2026-09-19)

Purpose: diagnose the user's Render deploy crash (pasted log during Part 2 of the
free-tier deployment) and write the fix plan. **No commands run, no source files
touched.** Artifacts updated: this report, `plan_for_claude_deployment.md` (new
DEP6), `plan_for_user.md` (Part 2 build command + gate), progress log.

## 1. The error (user-provided deploy log, commit `1dd7b0e`, branch master)

```
==> Running 'npm start'
> qubitverse-backend@0.1.0 start
> tsx src/server.ts

Error: /lib/x86_64-linux-gnu/libm.so.6: version `GLIBC_2.38' not found
  (required by /opt/render/project/src/backend/node_modules/sqlite3/build/Release/node_sqlite3.node)
    at Object..node (node:internal/modules/cjs/loader:2087)
    ...
    at bindings (node_modules/bindings/bindings.js:112:48)
    at Object.<anonymous> (node_modules/sqlite3/lib/sqlite3-binding.js:1:37)
  code: 'ERR_DLOPEN_FAILED'
Node.js v24.21.0
==> Exited with status 1   ← repeated on retry: crash loop
```

## 2. Root cause chain (each step verified)

1. `backend/package.json` has `"sqlite3": "^6.0.1"` — a **native** (C++) module.
   Registry check 2026-09-19: 6.0.1 is `latest`, engines `>=20.17.0`, install
   script `prebuild-install -r napi || node-gyp rebuild`.
2. During Render's build (`npm ci`), `prebuild-install` **downloads a prebuilt
   binary** (`node_sqlite3.node`) instead of compiling. Downloading executes no
   code → **the build "succeeds" 🎉 even though the binary is incompatible.**
3. That 6.0.1 prebuilt binary was compiled against **glibc 2.38** (very new
   toolchain — the 6.x line is freshly published by the TryGhost maintainers).
4. Render's native Node runtime image is Ubuntu 22.04-based → system glibc is
   **2.35** (the error itself proves the runtime glibc < 2.38, whatever the
   exact base).
5. At boot, the first `import Database from 'sqlite3'` (`backend/src/db/index.ts:1`)
   triggers `dlopen` → symbol-version lookup fails → `ERR_DLOPEN_FAILED` → the
   process exits → Render restarts it → identical crash (the two attempts in the
   log). The service is currently crash-looping.

## 3. Why it works locally / on Railway but not on Render

- Codespace: newer Ubuntu base (24.04, glibc ≥ 2.39) → the same prebuilt binary
  loads fine → all 156 backend tests green locally.
- Railway (nixpacks): recent NixOS glibc — also newer than 2.38.
- **This is NOT a Node-version problem.** `sqlite3` 6.x ships NAPI binaries —
  ABI-stable across Node versions, so the SAME binary is downloaded for Node 22
  and Node 24. **Pinning `NODE_VERSION` will not fix this.** The mismatch is
  binary-vs-OS (glibc), not binary-vs-Node.

## 4. Options evaluated

| Option | Change | Certainty on Render | Verdict |
|---|---|---|---|
| **B. Compile sqlite3 from source on Render** (`npm ci --build-from-source=sqlite3`) | Dashboard build command only (user, ~2 min); zero code change | High — the binary is compiled ON the runtime image, so glibc match is guaranteed by construction; Render's Node image includes node-gyp build tools | **PRIMARY (DEP6a)** |
| **C. Swap driver to `better-sqlite3` behind a small async adapter** | Code: package.json + connection layer of `db/index.ts` + 2 type imports; ~113 `db.*` call sites stay unchanged (await-compatible adapter) | Highest — better-sqlite3 prebuilds target glibc ≥ 2.29 (load fine on 2.35) and it falls back to clean source builds; fully in our control; validated by the 156-test suite | **FALLBACK (DEP6b)** — fully specced in the deployment plan |
| A. Downgrade to `sqlite3@5.1.7` | package.json + lockfile | Medium — old prebuilds probably target older glibc, but the floor is not verifiable from here; if wrong, we burn another failed deploy cycle discovering it | Rejected as primary; subsumed by B (B compiles from source, which A would need as backstop anyway) |
| D. Docker runtime with `node:24` base | New Dockerfile + runtime switch | High (Debian trixie glibc 2.41 > 2.38) but note `node:22` bookworm (glibc 2.36) would STILL crash | Unnecessary infra for a one-line fix; keep in reserve |
| E. Node built-in `node:sqlite` | Full DB-layer rewrite | — | Rejected: API rewrite, same magnitude as C with less maturity |
| F. Pin `NODE_VERSION=22` | Dashboard env var | **Does not fix** (see §3) | Not a fix; optional dev/prod parity item only (P3) |

## 5. Decision + exact fix steps (DEP6a — USER executes, ~2 minutes)

1. Render dashboard → the backend service → **Settings** → **Build Command**:
   change `npm ci` →
   ```
   npm ci --build-from-source=sqlite3
   ```
   Save (auto-triggers a redeploy; if not: Manual Deploy → Deploy latest commit).
   Equivalent alternate form if the flag is not honored:
   `npm ci && npm rebuild sqlite3 --build-from-source`.
2. Expected build log evidence: sqlite3 skips the prebuild download and runs
   `node-gyp rebuild` (`gyp info find Python` … `gyp info ok`) — build takes
   ~1–3 min longer. This compile line is the proof the fix engaged.
3. Expected boot log: migrations (`[db] Migration 001…`), `[db] Database initialized`,
   seed, listening on the Render-assigned port, `Your service is live 🎉`.
4. Then continue `plan_for_user.md` Part 2.5+ (env vars, health check) as written.

## 6. Fallback (DEP6b) — only if 6a's build fails (e.g. missing build tools)

Full spec written into `plan_for_claude_deployment.md` §DEP6: replace `sqlite3` +
`sqlite` with `better-sqlite3` (+ `@types/better-sqlite3`) behind a tiny adapter in
`backend/src/db/index.ts` that exposes the same async-shaped surface
(`run/get/all/exec` returning Promises; `await` on sync results is legal, so the
~113 call sites across routes/rewards/seed/migrations stay untouched). Mapping
rules, array-param normalization, BEGIN/COMMIT/ROLLBACK and PRAGMA handling, and
the acceptance gate (backend typecheck 0 + 156/156 pasted) are in the plan.
**Claude: do NOT start 6b speculatively — wait for 6a's build log.**

## 7. Checklist deltas

- Deployment plan §6 gains item 14: build log shows the sqlite3 source compile
  (`gyp info ok`) and boot shows no `ERR_DLOPEN_FAILED`.
- Build time increases ~1–3 min on every deploy (acceptable; free tier has no
  build-minute billing).
- No change to any env var, the health check path, Vercel wiring, or the
  ephemerality tradeoff.

## 8. Notes

- User's Render setup was otherwise CORRECT: log shows rootDir `backend` was
  honored (crash path is `src/backend/node_modules/...`) and Node 24.21 default
  was used — no settings fault.
- The fix keeps the accepted zero-code-change SQLite posture intact (ephemeral
  DB, boot-seeded) — no architecture change.
- Security: nothing exposed in this incident; no secrets in the log.

— Buffy
