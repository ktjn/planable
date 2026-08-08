# Design: Download app button (offline single-file copy)

## Context

Planable is deployed to GitHub Pages as a **single self-contained `index.html`**
(JS, CSS, and fonts inlined via the `build:single` script). Because the deployed
page *is* the whole app, a user can download that same HTML file and open it
locally — fully offline, with its own empty IndexedDB store.

Users who want their existing data in the downloaded copy can use the existing
**Export** (JSON) action in the same Settings → Data panel, then **Import** it in
the offline copy.

## Goals

1. Add a "Download app" action in Settings → Data.
2. The action fetches the currently-loaded page HTML and saves it as
   `planable.html`.
3. No runtime behavior change; the running app is untouched.

## Decisions made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | The button fetches `window.location.href` and downloads the response as `planable.html`. | When deployed, the loaded document is exactly the single-file build, so this yields a faithful offline copy. |
| 2 | Use `fetch(..., { cache: 'no-store' })`. | Avoids serving a stale cached copy of the page. |
| 3 | Place it in Settings → Data, next to Backup & restore. | Grouped with the other file/portability actions; mirrors the "Export/Import" pattern. |
| 4 | Not bundled with user data. | Keeps the download a pure copy of the app; data portability already exists via Export/Import. |

## Non-goals

- Not bundling the user's data into the downloaded file (existing Export/Import covers this).
- Not changing data storage behavior.

## Architecture

- New `src/components/settings/DownloadApp.tsx` rendering a small description plus a
  button.
- Reuses the existing `spinner`/disabled pattern from `ImportExport` for feedback.
- Wired into `Settings.tsx` Data tab beside `ImportExport`.

Flow:

1. User clicks **Download app**.
2. `fetch(window.location.href, { cache: 'no-store' })` returns the page HTML.
3. A `Blob` (type `text/html`) is created, an `<a download="planable.html">` is
   clicked, then the object URL is revoked.
4. Errors (e.g. network) set an inline error message.

## Verification

- In the production single-file build, clicking the button downloads a file that,
  when opened locally, runs the app offline.
- `npm run build:single` output is unchanged.
- `npm test` and `npx tsc -b` pass.
