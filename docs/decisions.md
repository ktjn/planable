# Planable decision log

Record notable design and product decisions here. Each entry should state the
decision, the date, and the rationale so future work does not re-litigate them
unnecessarily.

## 2026-08-12 — SQL-like console statements and sandbox transactions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Add SQL-ish statements as a *third* console mode alongside the existing item query (`task label:bug`) and `>` actions, rather than replacing either. Detected by a leading keyword (`SELECT`/`UPDATE`/`DELETE`/`BEGIN`/`COMMIT`/`ROLLBACK`); anything else falls through to the existing modes unchanged. | The existing query language and checkbox batch actions were just built, tested, and shipped — a rip-and-replace would throw that away for no benefit. Layering SQL on top keeps both working and lets `SELECT` results feed the same checkbox/batch-action UI item queries already use. |
| 2 | Grammar is intentionally small: `SELECT * FROM <table> [WHERE ...]`, `UPDATE <table> SET field=value[, ...] WHERE ...`, `DELETE FROM <table> WHERE ...`, `BEGIN [TRANSACTION]`, `COMMIT`, `ROLLBACK`. `WHERE` conditions are `field (= | != | LIKE) value`, ANDed only (no OR/parentheses). | Matches the mental model of the existing filter language (which is also AND-only) instead of inventing two different query dialects with different power. `WHERE`/`SET` reuse the exact same field set and matching semantics as `field:value` — `whereToItemQuery` translates a parsed `WHERE` straight into the same filter/term shape `searchItems` already consumes. |
| 3 | `UPDATE`/`DELETE` require an explicit `WHERE` clause; there is no bare "affect everything" form. Typing `WHERE 1=1` is the documented, deliberate escape hatch. | A single stray keystroke turning into "delete every task" with no confirmation would be a bad accident to make easy. Forcing `1=1` makes "yes, really everything" a conscious, greppable choice. |
| 4 | `UPDATE`/`DELETE` never run merely by being typed — they resolve to a single preview row (e.g. "UPDATE tasks — 3 changes across 3 rows (apply on Enter)") that must be explicitly selected via `Enter` or click, exactly like `>` actions already work. A parse error (e.g. missing `WHERE`) renders as a non-selectable error row instead of silently falling back to a free-text search. | Consistent, predictable "nothing mutates until you confirm" behavior across the whole console, and a broken statement staying visibly broken (rather than quietly reinterpreted as a text search) avoids a confusing "why did nothing/the wrong thing happen" moment. |
| 5 | `BEGIN` opens a sandbox: subsequent `UPDATE`/`DELETE` (via SQL **and** via the existing checkbox action bar) stage `PendingChange`s in React state instead of writing to Dexie. `SELECT`/`WHERE` matching runs against a live-data-plus-staged-changes overlay (`applyPendingOverlay`), so a `SELECT` run mid-transaction shows what the data will look like after `COMMIT` — before anything is written. Outside a transaction, statements autocommit immediately (ordinary SQL default). | This is the actual ask: "work in a sandbox until you commit or rollback." Reusing the same staging path for checkbox batch actions (not just SQL) means the sandbox represents *all* pending work in the console, not just SQL-issued edits. |
| 6 | `COMMIT` replays every staged change inside one real `db.transaction('rw', ...)` call, using the same repository functions (`setTaskCompleted`, `updateContainer`, `deleteTask`, ...) the rest of the app already uses — it doesn't hand-write raw table writes. `ROLLBACK` just discards the in-memory array; nothing was ever written, so there's nothing to undo. | Dexie transactions are already atomic and already the codebase's unit of consistency; replaying through the existing, tested repo functions (rather than a parallel write path) means COMMIT can't drift from what direct UI actions do, and an interrupted COMMIT can't leave partial writes. |
| 7 | The sandbox is `ConsolePanel` React state, not something that lives in IndexedDB. It survives folding/reopening the console (the component stays mounted) but is lost on page reload — there is no `beforeunload` warning yet. | In-memory scope matches "you're mid-edit in this session"; persisting a sandbox across reloads would need its own storage and conflict-resolution story, which is out of scope for a first version. Folding must not silently discard staged work, so that much *is* guaranteed. |
| 8 | Protected-entity deletes (e.g. the Inbox project/container) are skipped rather than aborting a whole `COMMIT`/batch, matching the existing checkbox-batch behavior for archiving. | A `DELETE FROM containers WHERE 1=1` shouldn't fail (or partially apply then throw) just because Inbox happens to be one of the matched rows; it should delete everything deletable and leave the one protected row alone. |

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

## 2026-08-12 — SQL clause autocomplete and sample queries

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | SQL ghost-text completion (`src/lib/sqlAutocomplete.ts`) is a separate, purpose-built state machine keyed on token position per statement verb, not a reuse of `parseSqlStatement`'s recursive-descent parser. It shares only the tokenizer (`tokenize`, exported from `sqlLanguage.ts`) and the `firstStartingWith` prefix-matcher (exported from `consoleAutocomplete.ts`). | The real parser is built to accept-or-reject a *complete* statement; driving it incrementally on every partial keystroke to derive "what comes next" would mean catching and interpreting its own error states as the signal, which is more fragile than a small explicit table of "after token X at position N, suggest Y." |
| 2 | `WHERE` and `SET` clause suggestion is one shared function each (`suggestWhereNext`, `suggestSetNext`) called from `SELECT`/`UPDATE`/`DELETE` and just `UPDATE` respectively, splitting the remaining tokens on `AND` / `,` to find position-within-condition (field / operator / value / conjunction). | `WHERE` has identical grammar across all three statement kinds; one implementation avoids three copies drifting apart as the grammar grows. |
| 3 | Structural tokens (keywords, table names, field names, operators) only suggest once at least one character is typed (`matchKeyword`); value slots (label/project/status/day/bool literals) suggest immediately with zero characters typed (`matchValue`), same as the plain query language's `label:` behavior. | Suggesting `FROM`/`WHERE`/etc. on an empty slot would fire constantly while the user is mid-word on the previous token; but for a value slot there's nothing to be "mid-word" in yet, so offering the first live option immediately (e.g. first known label) is helpful, not noisy. |
| 4 | The completer only reasons about tokens split on plain spaces; a quoted multi-word `WHERE` value (e.g. `WHERE project = 'Website Redesign'`) is not specially handled by the completer, even though the real parser accepts it. | Documented as a known limitation. The parser itself is unaffected — this only means autocomplete stops offering suggestions once inside a quoted value, which is an acceptable gap for a first version. |
| 5 | Added a row of clickable sample-query chips (`SAMPLE_QUERIES` in `ConsolePanel.tsx`) shown in the console's empty state, covering all three console modes (plain query, `>` action, SQL). Clicking one fills the input and focuses it but does not run it. | With three coexisting query syntaxes now, blank-console discoverability was the main gap; showing real, working examples teaches the syntax faster than prose, and not auto-running avoids surprising a click with an immediate mutation for the `UPDATE`/`DELETE` examples. |

## 2026-08-12 — Label chip wrapping instead of overflowing

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | `EntityLabels`'s outer wrapper changed from `inline-flex shrink-0` (fixed-width, single line, forces sibling flex items in the row to overflow once enough labels are attached) to `flex min-w-0 flex-wrap` (can shrink as a flex item and wraps its own children onto multiple lines within whatever width it's given). Individual label chips gained `shrink-0` so wrapping — not squeezing each chip — absorbs the overflow. | Single fix in the shared component covers every call site (`TaskCard`, `AllContainersView`, `SearchView`, `KanbanView`) instead of patching each view's row layout separately; relying on the browser's normal flex-shrink/wrap algorithm avoids hand-tuning per-view widths. |

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
