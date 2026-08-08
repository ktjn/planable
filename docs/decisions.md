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
