# Planable decision log

Record notable design and product decisions here. Each entry should state the
decision, the date, and the rationale so future work does not re-litigate them
unnecessarily.

## 2026-08-08 — Hover cards, weekly tick-off, all-containers view, entity pickers

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Ticking off a task in the weekly plan marks it **globally** completed. | Matches the existing `completed` field and week-rollover behavior. |
| 2 | Newly completed tasks appear **on top of the completed group** at the bottom of the weekly day column. | Most recently finished work is verified most often. |
| 3 | Hover cards open on **hover anywhere on the card** with a short delay. | Fastest for scanning; Base UI + dnd-kit prevent accidental popups. |
| 4 | Pick-from-list applies to **tasks → weekly plan** and **containers → kanban** only. | Projects are top-level tabs; nothing currently adds an existing project. |
| 5 | Weekly ordering is stored with an `order` field inside `WeeklyTaskMembership`. | Keeps weekly data co-located; requires only a small schema bump to v5. |
| 6 | Consolidate weekly rows and `AllTasksView` rows onto the existing `TaskCard`. | One component means hover cards, tick-off, labels and badges propagate everywhere tasks are shown. |

## 2026-08-08 — Single-file HTML deployment for GitHub Pages

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Add an opt-in `build:single` script; leave `npm run build` untouched. | Non-breaking; single-file builds are slower and only needed for deployment. |
| 2 | Use `richardtallent/vite-plugin-singlefile`. | Established plugin with Vite 8/Rolldown support (`codeSplitting: false`, `assetsInlineLimit: () => true`) so fonts are base64-inlined too. |
| 3 | Use a separate `vite.singlefile.config.ts` extending the base config. | Keeps the normal `vite.config.ts` minimal and makes single-file behavior explicit. |
| 4 | Keep `base: './'` and the same `dist/` output path. | Works unchanged with the existing Pages workflow; `base` is set by the plugin. |
| 5 | GitHub Actions runs `npm run build:single` for deploys. | Opt-in single-file deploy without duplicating the pipeline. |

## 2026-08-08 — Download app button (offline single-file copy)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | "Download app" fetches `window.location.href` and saves the response as `planable.html`. | When deployed, the loaded document is exactly the single-file build, giving a faithful offline copy. |
| 2 | Fetch uses `{ cache: 'no-store' }`. | Avoids serving a stale cached copy of the page. |
| 3 | Button lives in Settings → Data, beside Backup & restore. | Groups it with the other file/portability actions. |
| 4 | Not bundled with user data. | A pure copy of the app; data portability already exists via Export/Import. |

Link: `docs/superpowers/specs/2026-08-08-download-app-design.md`.

## 2026-08-11 — Task completion motion

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Use short transitions on the shared task card and checkbox when completion changes. | TaskCard is used across projects, weekly planning, kanban and search, so the interaction should feel consistent everywhere. |
| 2 | Keep the completion reorder immediate and respect `prefers-reduced-motion`. | The existing local-first feedback remains instant while motion stays optional and accessible. |
