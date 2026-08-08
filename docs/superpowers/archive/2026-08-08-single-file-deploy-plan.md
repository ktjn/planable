# Single-file HTML deployment for GitHub Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy Planable as a single self-contained `dist/index.html` (JS, CSS, and fonts inlined), while keeping the existing multipart `npm run build` unchanged.

**Architecture:** Add `vite-plugin-singlefile` and a dedicated `vite.singlefile.config.ts` that extends the base Vite config and applies `viteSingleFile()`. Add an opt-in `build:single` npm script. Point the GitHub Pages deploy workflow at `npm run build:single`. No runtime or test code changes.

**Tech Stack:** Vite 8 (Rolldown), React 19, TypeScript, Tailwind CSS 4, GitHub Actions `actions/deploy-pages@v5`.

## Global Constraints

- Do not modify the existing `vite.config.ts` or the default `npm run build` behavior.
- Keep component/runtime code unchanged; this is build + CI only.
- Follow existing config style (default export of `defineConfig`).
- Record decisions in `docs/decisions.md` (already updated for this work).

---

## File map

| File | Responsibility |
|------|----------------|
| `vite.singlefile.config.ts` | Base Vite config + `viteSingleFile()` plugin. |
| `package.json` | Add `build:single` script and `vite-plugin-singlefile` devDependency. |
| `.github/workflows/deploy.yml` | Build job runs `npm run build:single`. |

---

### Task 1: Install the plugin

- [ ] **Step 1: Install `vite-plugin-singlefile` as a dev dependency**

Run: `npm i -D vite-plugin-singlefile`

Expected: `vite-plugin-singlefile` appears in `package.json` `devDependencies` and `package-lock.json`.

---

### Task 2: Add `vite.singlefile.config.ts`

**Files:**
- Create: `vite.singlefile.config.ts`

- [ ] **Step 1: Create the single-file Vite config**

Create `vite.singlefile.config.ts`:

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
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
```

- [ ] **Step 2: Verify the config type-checks**

Run: `npx tsc -b`
Expected: no errors. (`tsconfig.node.json` types `vite.config.ts`; add `vite.singlefile.config.ts` to its `include` if the build requires it.)

- [ ] **Step 3: Build once and confirm a single file**

Run: `npm run build:single` (script added in Task 3) — or run the equivalent `npx vite build --config vite.singlefile.config.ts` first if the script doesn't exist yet.

Expected: `dist/index.html` contains inlined JS + CSS + font data URIs; `dist/` has no sibling `*.js`/`*.css` bundle except any `public/` copies.

---

### Task 3: Add the `build:single` script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the script**

Add to `package.json` `scripts`:

```json
"build:single": "tsc -b && vite build --config vite.singlefile.config.ts"
```

- [ ] **Step 2: Confirm the default build is unchanged**

Run: `npm run build`
Expected: multipart `dist/` as before (separate JS/CSS + font assets).

- [ ] **Step 3: Confirm the single-file build works**

Run: `npm run build:single`
Expected: succeeds; `dist/index.html` is a single self-contained file. `npm test` still passes.

---

### Task 4: Point the deploy workflow at the single-file build

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Swap the build command**

Change the build step in `.github/workflows/deploy.yml` from:

```yaml
      - run: npm run build
```

to:

```yaml
      - run: npm run build:single
```

(`npm ci` and `npm test` steps stay). `upload-pages-artifact@v5` with `path: dist` and the `deploy` job remain unchanged.

- [ ] **Step 2: Full local verification**

Run: `npm test && npm run build:single`
Expected: tests pass and the build succeeds.

---

### Task 5: Final verification

- [ ] **Step 1: Run the test suite and both builds**

Run: `npm test` then `npm run build` then `npm run build:single`
Expected:
- All tests PASS.
- `npm run build` → multipart `dist/` (unchanged).
- `npm run build:single` → single-file `dist/index.html`.

- [ ] **Step 2: Sanity-check the single file (optional)**

Open `dist/index.html` locally (double-click) and confirm the app loads with data persisted via IndexedDB.

- [ ] **Step 3: Commit**

```bash
git add vite.singlefile.config.ts package.json package-lock.json .github/workflows/deploy.yml docs/decisions.md docs/superpowers/specs/2026-08-08-single-file-deploy-design.md
git commit -m "feat(build): single-file HTML build for portable deployment"
```

---

## Self-review

**Spec coverage:**
- Opt-in `build:single` script → Tasks 2, 3.
- Uses `vite-plugin-singlefile` → Task 1, 2.
- Separate config file extending base config → Task 2.
- `base: './'` + same `dist/` output → Task 2 (unchanged path).
- Deploy workflow uses `npm run build:single` → Task 4.
- Default `npm run build` untouched → Task 3.

**Placeholder scan:** no TBD/TODO; all steps are concrete.

**Type consistency:** config mirrors `vite.config.ts`; script name `build:single` used consistently in `package.json`, this plan, and the workflow.
