# Design: Single-file HTML deployment for GitHub Pages

## Context

Planable is a local-first static web app (React + Vite). It is the only deployed
artifact, and the goal is to distribute the entire app as **one portable
`index.html`** — ideal for GitHub Pages (served at `/`) and for sharing a single
downloadable file that runs entirely offline.

The project currently builds with Vite 8 (Rolldown) into a `dist/` folder
containing separate JS/CSS chunks plus font assets, then GitHub Pages deploys the
whole `dist/` directory via a Pages workflow.

## Goals

1. Produce a **single self-contained `dist/index.html`** with all JS, CSS, and
   fonts inlined (base64 data URIs), deployable by the existing Pages workflow.
2. Keep the normal multipart `npm run build` unchanged for fast local rebuilds.
3. Add an **opt-in** `build:single` script for the single-file variant.
4. No runtime behavior change for users; IndexedDB (Dexie) is unaffected.

## Decisions made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Add `build:single` opt-in script; leave `build` untouched. | Non-breaking; single-file is slower and only needed for deployment. |
| 2 | Use **`richardtallent/vite-plugin-singlefile`** (npm `vite-plugin-singlefile`). | Established (`~1.9M` weekly downloads), and its Vite 8/Rolldown support sets `codeSplitting: false` and `assetsInlineLimit: () => true`, so fonts are base64-inlined too. |
| 3 | Use a **separate `vite.singlefile.config.ts`** extending the base config. | Keeps the normal `vite.config.ts` minimal and makes the single-file behavior explicit and easy to audit. |
| 4 | Deploy workflow keeps `base: './'` and the same `dist/` output path. | `vite-plugin-singlefile` already sets `base: './'`; Pages serves relative paths fine. The workflow change is limited to which build command runs. |
| 5 | GitHub Actions runs `npm run build:single` instead of `npm run build`. | Accomplishes the opt-in single-file deploy without duplicating the pipeline; `npm test` still runs first. |

## Non-goals

- Not replacing the multipart build as the default.
- No service-worker / PWA change in this step (the app has no PWA yet).
- No runtime code changes.

## Architecture (single-file build)

`vite.singlefile.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
});
```

- `vite-plugin-singlefile` applies its recommended build config automatically:
  `build.assetsInlineLimit = () => true`, `build.cssCodeSplit = false`,
  `build.assetsDir = ''`, and for Vite 8 it sets Rolldown output
  `codeSplitting = false`.
- Because `assetsInlineLimit` is `() => true`, the Geist woff2 fonts (CSS
  `@import "@fontsource-variable/geist"`) are emitted as base64 data URIs inside
  the inlined `<style>`. The JS is inlined into `<script>`.
- Result: `dist/index.html` is the entire app; `dist/` contains no sibling files
  that matter for deployments.

`package.json` script:

```json
"build:single": "tsc -b && vite build --config vite.singlefile.config.ts"
```

The inline theme `<script>` and `<style>` already in `index.html` remain in place
and are unaffected by the plugin (only the built module script + CSS references
are inlined).

## Data flow / deployment

`.github/workflows/deploy.yml` build job:

```yaml
- run: npm ci
- run: npm test
- run: npm run build:single
- uses: actions/upload-pages-artifact@v5
  with:
    path: dist
```

Pages uploads `dist/` unchanged. The deploy job is untouched.

## Verification

- `npm run build` still produces the multipart `dist/` (unchanged).
- `npm run build:single` produces a `dist/index.html` whose size is roughly the
  sum of the previously separate JS + CSS + fonts (fonts become base64), and
  `dist/` contains only `index.html` (plus any pre-existing `public/` files).
- `npm test` and `npx tsc -b` still pass.

## Rollout

1. `npm i -D vite-plugin-singlefile`.
2. Add `vite.singlefile.config.ts`.
3. Add `build:single` script to `package.json`.
4. Point the deploy workflow at `npm run build:single`.
5. Record decisions and this design doc.
