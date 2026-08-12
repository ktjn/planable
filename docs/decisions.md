# Planable decision log

Record notable design and product decisions here. Each entry should state the
decision, the date, and the rationale so future work does not re-litigate them
unnecessarily.

## 2026-08-12 — Console Tab-completion (ghost text)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Keep the existing query language as-is; add inline "ghost text" Tab-completion on top of it rather than redesigning into a verb-first command grammar. | Asked directly: the smaller change keeps everyone's existing `label:bug` / `> reset` muscle memory working while still making the console feel like a real shell. |
| 2 | Completion is computed by a pure function, `suggestCompletion(query, data)` in `src/lib/consoleAutocomplete.ts`, that returns the full replacement string for the current token (field name, filter value, or `>` action invocation) or `null`. | Same shape as `parseConsoleQuery`/`searchItems` — trivially unit-testable without mounting the component. |
| 3 | Only the token after the last space is completed; a `field:` filter with no colon offers both type keywords and `field:` names (fields take priority on ties), a `field:value` filter offers values from live data (label names, project names) or fixed alias lists (kanban status, weekday, booleans). Unknown fields (e.g. `color:`) suggest nothing rather than guessing. | Mirrors the parser's own `FIELD_KINDS` rules, so what autocompletes is always something the query language actually accepts. |
| 4 | Each `ConsoleAction` gained a canonical lowercase `invoke` phrase (e.g. `"goto kanban"`, `"reset"`, `"open project <name>"`) used only for completion, separate from the fuzzy `keywords` used for filtering the results list. | The results list intentionally matches loosely (any word, any order); completion needs one canonical, deterministic string to complete *to*. |
| 5 | Rendered as classic shell-style inline ghost text — an `aria-hidden` overlay behind the input showing the typed text invisibly plus the suggested remainder in muted color — rather than a separate suggestions dropdown. | Reuses the single input the console already has; doesn't compete visually with the existing results list below it. |
| 6 | `Tab` and `ArrowRight` both accept the suggestion (only when the cursor is at the end of the input); accepting never submits the query. | Matches fish/zsh autosuggestion conventions; not auto-running on accept keeps `> reset`-style completions safe. |

## 2026-08-12 — Console batch selection and bulk actions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Batch update is checkbox multi-select on the console's item results plus a bulk action bar, not a `> verb query` command form. | The user picked this directly: seeing exactly what's checked before acting is safer for destructive-ish operations (archive, bulk relabel) than a command that fires on every match the moment `Enter` is pressed. |
| 2 | Selection lives in `ConsolePanel` as a `Set<key>` scoped to the *current* results, not a cross-query cart. It's cleared whenever the query text changes, and again automatically right after a batch operation is applied. | Keeps the mental model simple: search, check, act, done — no hidden accumulated state to lose track of across edits. |
| 3 | First-version bulk operations: complete/uncomplete, archive/unarchive, set kanban status (containers), add/remove one label. Delete was left out. | Covers the highest-value, lowest-risk edits; irreversible bulk delete can follow later behind its own confirmation if it turns out to be needed. |
| 4 | `applyBatchOperation` (in `src/lib/consoleBatch.ts`) silently skips a selected result that doesn't support the operation (e.g. `complete` on a container, `kanbanStatus` on a task) instead of erroring, and swallows the one repo call that can throw (archiving the Inbox container). | The selection is often a deliberately mixed bag of tasks and containers from one query; per-kind buttons only appear when relevant, but the underlying apply stays defensive so a stray selection never aborts the whole batch. |
| 5 | `ConsoleItemResult` gained an explicit `id` field (previously the entity id was implicit in `key`, parsed via string-splitting). | The batch layer needs the raw id directly; parsing it back out of a composite key like `task-<uuid>` was fragile and unnecessary once there's a real consumer. |

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

## 2026-08-12 — CLI console, query language, reset & sample data

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Add a foldable console anchored to the bottom of the viewport (`ConsolePanel`), toggled by `Ctrl+K` or clicking its collapsed bar. | Keeps it out of the way by default while staying reachable from every view, similar to a terminal/devtools drawer. |
| 2 | Introduce a small query language: plain text queries **items** (tasks, containers, projects, labels); a leading `>` runs an **action** (command palette). | Two clearly distinct modes read well as one input: "search for something" vs. "do something." |
| 3 | Item query grammar: optional bare type keywords (`task`/`container`/`project`/`label`, singular or plural), `field:value` filters, free-text terms, all space-separated; `"quoted phrases"` for multi-word terms; any filter or term can be negated with a leading `-`. | Mirrors familiar search syntax (GitHub/Jira/Linear issue search) so it needs no dedicated tutorial. |
| 4 | Supported filters: `label:`, `status:` (kanban), `day:` (weekly), `project:`, `done:`/`completed:`, `archived:`, `repeat:` (task/container only where the field applies), plus `color:` for labels. Using a filter that only applies to one kind (e.g. `status:`) implicitly narrows the search to that kind; unknown filter names are ignored rather than excluding every result. | Keeps queries short — `status:doing` alone is enough, no need to also type `container`. Silently ignoring unknown fields avoids a query language that punishes typos with an empty result set. |
| 5 | Selecting an item result navigates to the view that renders it (All Tasks / All Containers / Labels / the item's Project) and briefly rings the matching card after scrolling it into view. | That view is the "canvas" the console projects results onto — no new item-detail surface was needed. |
| 6 | `resetAllData()` reuses `importData` with every table emptied (Inbox is always re-seeded by `importData`), rather than a bespoke clear routine. | One codepath already handles wiping + restoring the Inbox correctly; a second implementation would drift. |
| 7 | `addSampleData()` is purely additive (fresh UUIDs each run) and exercises every schema aspect in one pass: 2 projects, all 4 kanban statuses, an archived container, 5 labels, tasks that are completed/archived/multi-labelled/weekly-scheduled across several days including Unplanned, and one repeating task with its week template. | "Should include all aspects" is easiest to keep true, and easiest to verify in a test, as a single deliberately-varied dataset rather than several small ones. |
| 8 | Reset and Sample data are both console header buttons *and* `> reset` / `> sample data` actions, sharing the same underlying functions. | One codepath for state mutation; the console remains fully keyboard-driven without losing the discoverable buttons. |

## 2026-08-11 — Task completion motion

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Use short transitions on the shared task card and checkbox when completion changes. | TaskCard is used across projects, weekly planning, kanban and search, so the interaction should feel consistent everywhere. |
| 2 | Keep the completion reorder immediate and respect `prefers-reduced-motion`. | The existing local-first feedback remains instant while motion stays optional and accessible. |
