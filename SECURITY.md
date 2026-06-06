# Security posture

jira-graph is built to be safe to deploy and use in locked-down environments.
The deployed application **never makes external network requests** — this is
enforced, not just promised.

## No external requests — three layers

1. **No egress code ships.** The app bundles only mock/fixture providers.
   `fetch` appears in exactly one source file (`src/providers/JiraProvider.ts`,
   for future intranet use behind your own proxy) which nothing in the app
   imports — it is tree-shaken out of the production bundle. Verified by
   grepping `dist/`: the only `fetch(` is Vite's same-origin modulepreload
   polyfill (`credentials: 'same-origin'`, relative asset URLs only).
2. **Browser-enforced CSP.** The production build injects
   `Content-Security-Policy: default-src 'none'; script-src 'self';
   style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';
   connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'none';
   form-action 'none'` — even if a dependency tried to phone home, the
   browser blocks it.
3. **Runtime-verified.** Audited with instrumented `fetch`/`XMLHttpRequest`
   plus a `PerformanceObserver` resource watch while exercising every view,
   dataset, and theme: **zero non-same-origin requests**.

Demo data links ("Open in Jira") point at `https://jira.example.invalid` —
the RFC 2606 `.invalid` TLD is guaranteed never to resolve, so even a click
cannot reach a third party. Link hrefs are scheme-guarded to `http(s)` only,
so a hostile dataset cannot inject `javascript:` URLs.

## Dependencies

- **3 runtime dependencies** — `react`, `react-dom`, `@xyflow/react`
  (73 packages total including dev tooling; transitive runtime deps are the
  d3 micro-packages, zustand, classcat — all widely-used, org-maintained).
- `npm audit`: 0 vulnerabilities (also gated in CI at `--audit-level=high`).
- No dependency has `preinstall`/`install`/`postinstall` scripts, and CI
  installs with `npm ci --ignore-scripts` regardless.
- No web fonts, no CDN assets, no analytics, no telemetry, no service worker.

## Build & CI

- GitHub Actions are pinned to **commit SHAs**, not movable tags.
- The workflow has read-only `contents` permission; deploys via OIDC
  (`id-token`) to GitHub Pages only.
- Lockfile-faithful installs (`npm ci`).

## Data handling

- All data stays in the browser: `localStorage` (UI prefs) and `IndexedDB`
  (issue cache for the future intranet provider). Nothing is transmitted.
- Issue descriptions render as plain text (ADF → text); React escapes all
  output; no `dangerouslySetInnerHTML` anywhere.

## Using it against a real Jira (intranet)

`JiraProvider` is designed to run behind your own auth/CORS proxy on the same
origin. The shipped CSP (`connect-src 'self'`) permits exactly that and
nothing else — point the proxy at your Jira instance and the browser still
cannot talk to anything but your own host.

## Reporting

Open a GitHub issue (no sensitive details) or contact the repository owner.
