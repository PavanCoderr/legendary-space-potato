# Vercel allow-scripts warning — diagnosis + fix — Buffy (2026-09-19)

Context: during Part 3 (Vercel frontend wiring), the Vercel build log showed:

```
npm warn allow-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn allow-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn allow-scripts Run `npm approve-scripts --allow-scripts-pending` to review,
npm warn allow-scripts   or `npm approve-scripts <pkg>` to allow.
```

**Verdict: harmless warning, build SUCCEEDED (user-confirmed).** One future-proofing
fix applied (user-approved).

## 1. What this is

npm 11.6+ / 12's new install-scripts security feature (shipped 2026 in response to
the npm supply-chain worm attacks). Dependencies with `preinstall/install/postinstall`
scripts must be explicitly allowlisted via an `allowScripts` field in the project's
package.json (`npm approve-scripts <pkg>` manages it). On npm 11.x (Vercel's current
build image) this is **warn-only**; npm 12 (July 2026) makes it blocking-by-default.
Web-verified 2026-09-19 (npm docs: `npm-approve-scripts`, npm/cli#9562, npm v12
migration guides).

## 2. Why it doesn't break this project

- `esbuild`'s real binary ships in the platform-specific optional dependency
  (`@esbuild/linux-x64` on Vercel), installed without any script. The postinstall
  (`node install.js`) is only a fallback/validator for setups where optional deps
  don't deliver the binary.
- This frontend builds with **Vite 8 + Rolldown** (`vite.config.ts` uses
  `rolldownOptions`); esbuild is only present via tooling deps (vitest/vite tree).
- User confirmed the deployment finished successfully.

## 3. Fix applied (user-approved 2026-09-19)

Root `package.json` — added exactly what `npm approve-scripts esbuild` would write:

```json
"allowScripts": {
  "esbuild": true
}
```

- Silences the warning and future-proofs against Vercel bumping its build image to
  npm 12 (a blocked esbuild script mid-hackathon would be a bad surprise).
- esbuild is a first-party trusted build dependency — safe to allowlist. Do NOT
  blanket-allow all scripts; per-package review is the point of the feature.
- Note for the NEXT Vercel redeploy: the redeploy is still REQUIRED for
  `VITE_API_BASE_URL` to take effect (build-time var) — this edit rides along with
  that push if committed together.
- Not committed — user handles commits/pushes (standing arrangement).

## 4. Watch-item (non-blocking)

If a future build log adds MORE packages to the allow-scripts warning (e.g. after
dependency updates), approve them individually after checking what the script does —
or expect hard failure once npm 12 is the builder. Backend on Render is unaffected
(its npm ci ran clean; sqlite3 is handled by DEP6a's build-from-source flag).

— Buffy
