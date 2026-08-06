# Planable

> A local-first work planning application for engineers and architects.

Planable is a lightweight personal work planning app focused on planning and
executing work—not on managing teams. It replaces scattered notes, TODO lists,
and spreadsheets with a single local planning workspace.

## Highlights

- **Local-first** — everything is stored in your browser (IndexedDB via Dexie).
  No accounts, no servers, no cloud.
- **Fast & simple** — a static web app with no backend.
- **Keyboard-friendly** — navigate, search, and act without leaving the keyboard.
- **Drag-and-drop driven** — move tasks between weekdays, kanban columns, and
  project containers; reorder containers and project tabs.
- **Markdown descriptions**, global color-coded labels.

## Views

- **Weekly Plan** — plan each week by dragging tasks from _Unplanned_ into
  Monday–Friday. Planning is entirely manual; start a new week when you're ready
  and resolve every unfinished task.
- **Kanban** — execution board (Todo / Doing / Blocked / Done). Independent from
  the weekly plan.
- **Projects** — each project is a dynamic tab with user-defined containers.

## Tech Stack

- React 19, TypeScript, Vite
- Tailwind CSS v4, shadcn/ui (Base UI), Lucide React
- IndexedDB via Dexie + dexie-react-hooks
- Drag & drop via @dnd-kit
- Vitest + Testing Library for tests

## Development

```bash
npm install
npm run dev       # start the dev server
npm test          # run the test suite
npm run build     # type-check + production build into dist/
```

## Deployment

The app is a static site destined for GitHub Pages. The
`.github/workflows/deploy.yml` workflow builds and publishes on every push to
`main`.

## Data & Privacy

All data lives in your browser. Use **Settings → Data** to export a JSON backup
or to restore from one.

## Phases

1. **Phase 1** — projects, containers, tasks, labels, Weekly Plan, Kanban, drag
   & drop, IndexedDB, JSON export/import (complete).
2. **Phase 2** — weekly rollover, repeat-every-week templates, global search,
   keyboard shortcuts, settings.
3. **Phase 3** — PWA/offline, GitHub sync, local analytics & suggestions.

## Non-Goals

Collaboration, authentication, comments, attachments, notifications, time
tracking, Gantt charts, sprint management, story points, server-side storage.
