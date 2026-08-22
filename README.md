# Planable

> A local-first work planning application for engineers and architects.

[![Live Demo](https://img.shields.io/badge/demo-ktjn.github.io%2Fplanable-blue?style=flat-square)](https://ktjn.github.io/planable/)
[![Latest Release](https://img.shields.io/github/v/release/ktjn/planable?style=flat-square&label=release)](https://github.com/ktjn/planable/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Planable is a lightweight personal work planning app focused on planning and
executing work—not on managing teams. It replaces scattered notes, TODO lists,
and spreadsheets with a single, fast, local planning workspace.

🌐 **Live Web App**: [https://ktjn.github.io/planable/](https://ktjn.github.io/planable/)  
📦 **Download Single-File HTML**: [GitHub Releases](https://github.com/ktjn/planable/releases)

---

## Highlights

- **Local-first & Private** — Everything is stored directly in your browser's IndexedDB (via Dexie). No accounts, no telemetry, no servers, and no cloud dependencies.
- **Single-File Portable HTML Release** — Distributes as a standalone `planable.html` file with all scripts, styles, and assets inlined. Download it and double-click to run anywhere offline without installing anything.
- **Live Static Web App** — Automatically deployed to [GitHub Pages](https://ktjn.github.io/planable/).
- **Keyboard & CLI-Driven** — Interactive console drawer (`Ctrl+K`) supporting item queries, command palette actions (`> reset`, `> sample data`), tab autocomplete, and transactional SQL sandbox (`SELECT`, `UPDATE`, `DELETE`, `BEGIN`/`COMMIT`).
- **Drag-and-Drop Planning** — Intuitive drag-and-drop boards powered by `@dnd-kit` for tasks, containers, weekdays, and kanban columns.
- **Data Portability** — Export and import full JSON backups anytime from **Settings → Data**, or click **Download app** to save an offline single-file copy directly from the browser.

---

## Views

- **Weekly Plan** — Two independent boards plan each week: **Containers** and **Tasks**. Drag items from *Unplanned* into Monday–Friday columns. Containers and child tasks are scheduled independently. Planning is deliberate and manual: rollover prompts you to resolve every scheduled container and unfinished task when starting a new week.
- **Kanban** — Execution board with columns for *Todo*, *Doing*, *Blocked*, and *Done*. Task-focused and independent of the weekly plan.
- **Projects** — Dynamic project tabs organizing work into custom containers with per-container weekly scheduling actions.
- **All Tasks & All Containers** — Global lists with instant search, label filters, and batch selection actions.
- **CLI Console** — Bottom-anchored terminal interface (`Ctrl+K`) for lightning-fast search, bulk operations, tab-completed ghost text, and SQL query executions.

---

## How to Run

### Option 1: Use the Web App
Visit **[https://ktjn.github.io/planable/](https://ktjn.github.io/planable/)** in any modern web browser.

### Option 2: Run Offline (Single HTML File)
1. Go to [Releases](https://github.com/ktjn/planable/releases).
2. Download `planable.html` from the latest release.
3. Double-click the file to open it in Chrome, Firefox, Safari, or Edge.
4. All data will be saved locally in that browser's IndexedDB.

*(You can also download a standalone copy anytime from inside the running web app under **Settings → Data → Download app**.)*

---

## Tech Stack

- **Framework & Language**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/)
- **Styling & Components**: [Tailwind CSS v4](https://tailwindcss.com/), [Base UI](https://base-ui.com/) / [shadcn/ui](https://ui.shadcn.com/), [Lucide React](https://lucide.dev/), [Geist](https://fontsource.org/fonts/geist)
- **Local Storage**: [Dexie.js](https://dexie.org/) + [dexie-react-hooks](https://github.com/dexie/Dexie.js) (IndexedDB)
- **Drag & Drop**: [@dnd-kit](https://dndkit.com/)
- **Single-File Bundling**: [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)
- **Testing**: [Vitest](https://vitest.dev/), [Testing Library](https://testing-library.com/), [Playwright](https://playwright.dev/)

---

## Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v22 or later recommended)
- `npm`

### Setup & Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run unit and integration tests (Vitest)
npm test

# Run tests in watch mode
npm run test:watch

# Run end-to-end tests (Playwright)
npm run test:e2e

# Standard production build (dist/)
npm run build

# Standalone single-file HTML build (dist/index.html)
npm run build:single
```

---

## Releases & Continuous Deployment

- **GitHub Pages**: Pushes to `main` automatically test and deploy the latest single-file build to GitHub Pages via `.github/workflows/deploy.yml`.
- **GitHub Releases**: Pushing a version tag (e.g. `v0.1.0`) triggers `.github/workflows/release.yml` to run tests, build the standalone bundle, and publish `planable.html` as a release asset.

---

## Props & Acknowledgments

Planable stands on the shoulders of wonderful open-source projects:

- **[Dexie.js](https://dexie.org/)** by David Fahlander — for making IndexedDB reactive, robust, and delightful to use.
- **[@dnd-kit](https://dndkit.com/)** by Claudéric Demers — for modular, accessible, and high-performance drag-and-drop primitives.
- **[Tailwind CSS](https://tailwindcss.com/)** & **[shadcn/ui](https://ui.shadcn.com/)** / **[Base UI](https://base-ui.com/)** — for clean, flexible design systems and components.
- **[Lucide](https://lucide.dev/)** — for beautiful, consistent iconography.
- **[Vite](https://vite.dev/)** & **[vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)** — for lightning-fast build tooling and zero-dependency single-file HTML generation.
- **[Vitest](https://vitest.dev/)** & **[Playwright](https://playwright.dev/)** — for reliable, fast unit and end-to-end testing environments.

---

## Non-Goals

Planable is intentionally personal. Non-goals include:
Multi-user collaboration, user accounts/auth, cloud databases, server-side APIs, comments, attachments, notifications, time-tracking, sprint story points, and Gantt charts.

---

## License

This project is open source and available under the [MIT License](LICENSE).
