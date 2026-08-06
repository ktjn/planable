# Planable Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 1 of Planable — project/container/task/label CRUD, the Weekly Plan and Kanban views with independent task membership, drag-and-drop, IndexedDB persistence, and JSON import/export — as a working static React app.

**Architecture:** A Vite + React + TypeScript SPA. Dexie wraps IndexedDB as the single source of truth; all reads/writes go through small repository modules (`src/db/repositories/*`), never touched directly by components. Components subscribe to live data via `dexie-react-hooks`' `useLiveQuery`. Drag-and-drop (`@dnd-kit`) only ever calls repository membership-update functions — it never mutates state directly. Three top-level views (Weekly Plan, Kanban, Project/Inbox tabs) share the same Task data but read/write disjoint slices of it, per the approved data-model spec.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Lucide React, Dexie + dexie-react-hooks, @dnd-kit/core + @dnd-kit/sortable, Vitest + @testing-library/react + fake-indexeddb.

## Global Constraints

- Data model, membership rules, and view behavior follow
  `docs/superpowers/specs/2026-08-06-core-data-model-design.md` exactly —
  Kanban and Weekly membership are independent, optional, additive objects
  on a Task, never always-present fields.
- No backend, no authentication, no network calls. Everything persists to
  IndexedDB via Dexie.
- Phase 1 excludes weekly rollover and weekly-template spawning (those are
  Phase 2 per the original project plan) — the `weekly.repeatWeekly` flag
  exists on the schema but nothing acts on it yet.
- UI in this plan uses plain Tailwind-styled elements (no shadcn/ui or
  Base UI component scaffolding yet) to keep the plan self-contained;
  adopting those component libraries is follow-up work, not blocking.
- All repository functions are async and return plain data (no
  React-specific types), so they're usable from both components and tests.
- IDs are generated with `crypto.randomUUID()`.
- Every repository module gets unit tests using `fake-indexeddb` (no real
  browser needed). Every interactive component gets a
  `@testing-library/react` test covering its primary interaction.
- **Amendment (post-Task-1):** dependencies are pinned to the latest
  version available at install time rather than the versions originally
  drafted below — Task 1 was re-run against latest and the versions in its
  code block are now historical, not authoritative. Tailwind CSS landed on
  v4 during Task 1, which is CSS-first and has no `tailwind.config.js` /
  `postcss.config.js`: Tailwind is wired via the `@tailwindcss/vite` plugin
  in `vite.config.ts`/`vitest.config.ts`, and `src/index.css` is just
  `@import "tailwindcss";`. `tsconfig.json`'s `types` array also needs
  `"vite/client"` (ahead of `"vitest/globals"`) so CSS side-effect imports
  type-check. A root `.gitignore` (`node_modules/`, `dist/`, `.superpowers/`,
  `*.local`, `*.tsbuildinfo`) and `.github/dependabot.yml` (weekly npm +
  github-actions updates) were added as part of Task 1 and are not
  otherwise mentioned in the per-task file lists below. None of this
  changes any task's produced interfaces (npm scripts, component APIs,
  repository function signatures) — only how the toolchain is wired.

---

## File Structure

```
package.json, vite.config.ts, tsconfig.json, index.html, vitest.config.ts,
src/test-setup.ts, .gitignore, .github/dependabot.yml
src/main.tsx                        - app entry
src/App.tsx                         - top-level layout, view switching
src/db/schema.ts                    - Project/Container/Task/Label types
src/db/inbox.ts                     - Inbox pseudo-project constants
src/db/db.ts                        - Dexie class + db instance
src/db/repositories/labels.ts
src/db/repositories/tasks.ts        - core task CRUD
src/db/repositories/taskMembership.ts - kanban/weekly membership helpers
src/db/repositories/containers.ts
src/db/repositories/projects.ts
src/lib/week.ts                     - current-week id helper
src/lib/importExport.ts
src/components/layout/NavTabs.tsx
src/components/projects/ProjectView.tsx
src/components/projects/ContainerColumn.tsx
src/components/projects/TaskCard.tsx
src/components/projects/TaskDialog.tsx
src/components/labels/LabelManager.tsx
src/components/weekly/WeeklyPlanView.tsx
src/components/weekly/AddToWeekPicker.tsx
src/components/kanban/KanbanView.tsx
src/components/kanban/AddToKanbanPicker.tsx
src/components/settings/ImportExport.tsx
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`,
  `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`,
  `index.html`, `vitest.config.ts`, `src/test-setup.ts`, `src/main.tsx`,
  `src/App.tsx`, `src/index.css`

**Interfaces:**
- Produces: a working `npm run dev`, `npm run build`, and `npm test`
  (Vitest) toolchain; a root `<App />` component rendering `"Planable"`.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "planable",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "dexie": "^4.0.8",
    "dexie-react-hooks": "^1.1.7",
    "lucide-react": "^0.462.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.9",
    "vitest": "^2.1.3"
  }
}
```

- [ ] **Step 2: Write build/test config files**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
});
```

`src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

`postcss.config.js`:
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Planable</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return <div>Planable</div>;
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: installs without error, creates `node_modules` and `package-lock.json`.

- [ ] **Step 4: Verify test runner works**

Run: `npm test`
Expected: Vitest runs with "No test files found" (no test files exist yet) — confirms the toolchain is wired correctly rather than broken.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts vitest.config.ts tsconfig.json tsconfig.node.json tailwind.config.js postcss.config.js index.html src/test-setup.ts src/main.tsx src/App.tsx src/index.css
git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest project"
```

---

### Task 2: Data Schema & Dexie Database

**Files:**
- Create: `src/db/schema.ts`, `src/db/inbox.ts`, `src/db/db.ts`
- Test: `src/db/db.test.ts`

**Interfaces:**
- Produces: types `Project`, `Container`, `Task`, `Label`, `KanbanStatus`,
  `WeekDay`, `KanbanMembership`, `WeeklyMembership` (from `src/db/schema.ts`);
  constants `INBOX_PROJECT_ID`, `INBOX_CONTAINER_ID` and objects
  `INBOX_PROJECT`, `INBOX_CONTAINER` (from `src/db/inbox.ts`); class
  `PlanableDB` and instance `db` with tables `db.projects`, `db.containers`,
  `db.tasks`, `db.labels` (from `src/db/db.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// src/db/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PlanableDB } from './db';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from './inbox';

describe('PlanableDB', () => {
  let db: PlanableDB;

  beforeEach(() => {
    db = new PlanableDB(`test-db-${Math.random()}`);
  });

  it('seeds the Inbox project and container on first open', async () => {
    await db.open();
    const inboxProject = await db.projects.get(INBOX_PROJECT_ID);
    const inboxContainer = await db.containers.get(INBOX_CONTAINER_ID);
    expect(inboxProject?.name).toBe('Inbox');
    expect(inboxContainer?.projectId).toBe(INBOX_PROJECT_ID);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- db.test.ts`
Expected: FAIL — `./db` and `./inbox` modules don't exist yet.

- [ ] **Step 3: Write the schema, inbox constants, and db class**

```ts
// src/db/schema.ts
export type KanbanStatus = 'Todo' | 'Doing' | 'Blocked' | 'Done';
export type WeekDay = 'Unplanned' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

export interface Project {
  id: string;
  name: string;
  order: number;
}

export interface Container {
  id: string;
  projectId: string;
  name: string;
  order: number;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface KanbanMembership {
  status: KanbanStatus;
}

export interface WeeklyMembership {
  weekId: string;
  day: WeekDay;
  repeatWeekly: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  labels: string[];
  projectId: string;
  containerId: string;
  completed: boolean;
  completedDate: number | null;
  kanban: KanbanMembership | null;
  weekly: WeeklyMembership | null;
}
```

```ts
// src/db/inbox.ts
import type { Project, Container } from './schema';

export const INBOX_PROJECT_ID = 'inbox';
export const INBOX_CONTAINER_ID = 'inbox-container';

export const INBOX_PROJECT: Project = {
  id: INBOX_PROJECT_ID,
  name: 'Inbox',
  order: -1,
};

export const INBOX_CONTAINER: Container = {
  id: INBOX_CONTAINER_ID,
  projectId: INBOX_PROJECT_ID,
  name: 'Inbox',
  order: 0,
};
```

```ts
// src/db/db.ts
import Dexie, { type Table } from 'dexie';
import type { Project, Container, Task, Label } from './schema';
import { INBOX_PROJECT, INBOX_CONTAINER } from './inbox';

export class PlanableDB extends Dexie {
  projects!: Table<Project, string>;
  containers!: Table<Container, string>;
  tasks!: Table<Task, string>;
  labels!: Table<Label, string>;

  constructor(name = 'planable') {
    super(name);
    this.version(1).stores({
      projects: 'id, order',
      containers: 'id, projectId, order',
      tasks: 'id, projectId, containerId, completed',
      labels: 'id, name',
    });
    this.on('populate', () => {
      this.projects.add(INBOX_PROJECT);
      this.containers.add(INBOX_CONTAINER);
    });
  }
}

export const db = new PlanableDB();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/inbox.ts src/db/db.ts src/db/db.test.ts
git commit -m "feat: add Dexie schema with seeded Inbox pseudo-project"
```

---

### Task 3: Label Repository

**Files:**
- Create: `src/db/repositories/labels.ts`
- Test: `src/db/repositories/labels.test.ts`

**Interfaces:**
- Consumes: `db` from `src/db/db.ts`, `Label` from `src/db/schema.ts`.
- Produces: `listLabels(): Promise<Label[]>`,
  `createLabel(name: string, color: string): Promise<Label>`,
  `updateLabel(id: string, changes: Partial<Pick<Label, 'name' | 'color'>>): Promise<void>`,
  `deleteLabel(id: string): Promise<void>` (also strips the label id out of
  every task's `labels[]`).

- [ ] **Step 1: Write the failing test**

```ts
// src/db/repositories/labels.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PlanableDB } from '../db';
import { createLabel, listLabels, updateLabel, deleteLabel } from './labels';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-labels-${Math.random()}`) };
});

describe('label repository', () => {
  it('creates, lists, updates, and deletes labels, and strips deleted labels from tasks', async () => {
    const label = await createLabel('Security', '#ff0000');
    expect((await listLabels()).map((l) => l.name)).toContain('Security');

    await updateLabel(label.id, { color: '#00ff00' });
    expect((await listLabels()).find((l) => l.id === label.id)?.color).toBe('#00ff00');

    const { db } = await import('../db');
    await db.tasks.add({
      id: 't1',
      title: 'Task',
      description: '',
      labels: [label.id],
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
      completed: false,
      completedDate: null,
      kanban: null,
      weekly: null,
    });

    await deleteLabel(label.id);
    expect((await listLabels()).find((l) => l.id === label.id)).toBeUndefined();
    expect((await db.tasks.get('t1'))?.labels).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- labels.test.ts`
Expected: FAIL — `./labels` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/db/repositories/labels.ts
import { db } from '../db';
import type { Label } from '../schema';

export async function listLabels(): Promise<Label[]> {
  return db.labels.orderBy('name').toArray();
}

export async function createLabel(name: string, color: string): Promise<Label> {
  const label: Label = { id: crypto.randomUUID(), name, color };
  await db.labels.add(label);
  return label;
}

export async function updateLabel(
  id: string,
  changes: Partial<Pick<Label, 'name' | 'color'>>,
): Promise<void> {
  await db.labels.update(id, changes);
}

export async function deleteLabel(id: string): Promise<void> {
  await db.transaction('rw', db.labels, db.tasks, async () => {
    await db.labels.delete(id);
    const affected = await db.tasks.filter((t) => t.labels.includes(id)).toArray();
    await Promise.all(
      affected.map((t) =>
        db.tasks.update(t.id, { labels: t.labels.filter((l) => l !== id) }),
      ),
    );
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- labels.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/labels.ts src/db/repositories/labels.test.ts
git commit -m "feat: add label repository with cascading delete from tasks"
```

---

### Task 4: Task Repository (Core CRUD)

**Files:**
- Create: `src/db/repositories/tasks.ts`
- Test: `src/db/repositories/tasks.test.ts`

**Interfaces:**
- Consumes: `db`, `Task`, `INBOX_PROJECT_ID`, `INBOX_CONTAINER_ID`.
- Produces: `listTasksByContainer(containerId: string): Promise<Task[]>`,
  `createTask(input: { title: string; description?: string; labels?: string[]; projectId: string; containerId: string }): Promise<Task>`,
  `updateTask(id: string, changes: Partial<Pick<Task, 'title' | 'description' | 'labels' | 'projectId' | 'containerId'>>): Promise<void>`,
  `setTaskCompleted(id: string, completed: boolean): Promise<void>` (sets
  `completedDate` to `Date.now()` when completing, `null` when uncompleting),
  `deleteTask(id: string): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/db/repositories/tasks.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-tasks-${Math.random()}`) };
});

import { createTask, listTasksByContainer, updateTask, setTaskCompleted, deleteTask } from './tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';

describe('task repository', () => {
  it('creates a task with defaults', async () => {
    const task = await createTask({
      title: 'Write plan',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    expect(task.completed).toBe(false);
    expect(task.completedDate).toBeNull();
    expect(task.kanban).toBeNull();
    expect(task.weekly).toBeNull();
    expect(task.labels).toEqual([]);
  });

  it('lists tasks by container', async () => {
    const task = await createTask({
      title: 'Task in inbox',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    const tasks = await listTasksByContainer(INBOX_CONTAINER_ID);
    expect(tasks.map((t) => t.id)).toContain(task.id);
  });

  it('updates a task', async () => {
    const task = await createTask({
      title: 'Original',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    await updateTask(task.id, { title: 'Renamed' });
    const [updated] = await listTasksByContainer(INBOX_CONTAINER_ID);
    expect(updated.title).toBe('Renamed');
  });

  it('sets completed with a completedDate, and clears it when uncompleted', async () => {
    const task = await createTask({
      title: 'Finish me',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    await setTaskCompleted(task.id, true);
    let [t] = await listTasksByContainer(INBOX_CONTAINER_ID).then((ts) => ts.filter((x) => x.id === task.id));
    expect(t.completed).toBe(true);
    expect(t.completedDate).not.toBeNull();

    await setTaskCompleted(task.id, false);
    [t] = await listTasksByContainer(INBOX_CONTAINER_ID).then((ts) => ts.filter((x) => x.id === task.id));
    expect(t.completed).toBe(false);
    expect(t.completedDate).toBeNull();
  });

  it('deletes a task', async () => {
    const task = await createTask({
      title: 'Delete me',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    await deleteTask(task.id);
    const tasks = await listTasksByContainer(INBOX_CONTAINER_ID);
    expect(tasks.find((t) => t.id === task.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tasks.test.ts`
Expected: FAIL — `./tasks` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/db/repositories/tasks.ts
import { db } from '../db';
import type { Task } from '../schema';

export async function listTasksByContainer(containerId: string): Promise<Task[]> {
  return db.tasks.where('containerId').equals(containerId).toArray();
}

export async function createTask(input: {
  title: string;
  description?: string;
  labels?: string[];
  projectId: string;
  containerId: string;
}): Promise<Task> {
  const task: Task = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description ?? '',
    labels: input.labels ?? [],
    projectId: input.projectId,
    containerId: input.containerId,
    completed: false,
    completedDate: null,
    kanban: null,
    weekly: null,
  };
  await db.tasks.add(task);
  return task;
}

export async function updateTask(
  id: string,
  changes: Partial<Pick<Task, 'title' | 'description' | 'labels' | 'projectId' | 'containerId'>>,
): Promise<void> {
  await db.tasks.update(id, changes);
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<void> {
  await db.tasks.update(id, {
    completed,
    completedDate: completed ? Date.now() : null,
  });
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tasks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/tasks.ts src/db/repositories/tasks.test.ts
git commit -m "feat: add task repository with core CRUD and completion tracking"
```

---

### Task 5: Task Membership Helpers (Kanban & Weekly)

**Files:**
- Create: `src/db/repositories/taskMembership.ts`
- Test: `src/db/repositories/taskMembership.test.ts`

**Interfaces:**
- Consumes: `db`, `Task`, `KanbanStatus`, `WeekDay`, `setTaskCompleted` (from
  `./tasks`).
- Produces: `addToKanban(taskId: string): Promise<void>` (sets
  `kanban = { status: 'Todo' }`), `setKanbanStatus(taskId: string, status: KanbanStatus): Promise<void>`
  (updates `kanban.status`; if `status === 'Done'` also calls
  `setTaskCompleted(taskId, true)`; moving *out* of Done to another status
  does not un-complete the task), `removeFromKanban(taskId: string): Promise<void>`
  (sets `kanban = null`), `addToWeek(taskId: string, weekId: string): Promise<void>`
  (sets `weekly = { weekId, day: 'Unplanned', repeatWeekly: false }`),
  `setWeeklyDay(taskId: string, day: WeekDay): Promise<void>` (updates
  `weekly.day`), `removeFromWeek(taskId: string): Promise<void>` (sets
  `weekly = null`).

- [ ] **Step 1: Write the failing test**

```ts
// src/db/repositories/taskMembership.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-membership-${Math.random()}`) };
});

import { createTask } from './tasks';
import {
  addToKanban,
  setKanbanStatus,
  removeFromKanban,
  addToWeek,
  setWeeklyDay,
  removeFromWeek,
} from './taskMembership';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';
import { db } from '../db';

async function makeTask() {
  return createTask({ title: 'T', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
}

describe('task membership helpers', () => {
  it('adds to kanban with Todo default, updates status, and completes on Done', async () => {
    const task = await makeTask();
    await addToKanban(task.id);
    expect((await db.tasks.get(task.id))?.kanban).toEqual({ status: 'Todo' });

    await setKanbanStatus(task.id, 'Doing');
    expect((await db.tasks.get(task.id))?.kanban).toEqual({ status: 'Doing' });
    expect((await db.tasks.get(task.id))?.completed).toBe(false);

    await setKanbanStatus(task.id, 'Done');
    const done = await db.tasks.get(task.id);
    expect(done?.kanban).toEqual({ status: 'Done' });
    expect(done?.completed).toBe(true);
    expect(done?.completedDate).not.toBeNull();
  });

  it('removes kanban membership without touching weekly or completed', async () => {
    const task = await makeTask();
    await addToKanban(task.id);
    await removeFromKanban(task.id);
    expect((await db.tasks.get(task.id))?.kanban).toBeNull();
  });

  it('adds to week with Unplanned default, updates day, and can be removed', async () => {
    const task = await makeTask();
    await addToWeek(task.id, '2026-W32');
    expect((await db.tasks.get(task.id))?.weekly).toEqual({
      weekId: '2026-W32',
      day: 'Unplanned',
      repeatWeekly: false,
    });

    await setWeeklyDay(task.id, 'Tue');
    expect((await db.tasks.get(task.id))?.weekly?.day).toBe('Tue');

    await removeFromWeek(task.id);
    expect((await db.tasks.get(task.id))?.weekly).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- taskMembership.test.ts`
Expected: FAIL — `./taskMembership` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/db/repositories/taskMembership.ts
import { db } from '../db';
import type { KanbanStatus, WeekDay } from '../schema';
import { setTaskCompleted } from './tasks';

export async function addToKanban(taskId: string): Promise<void> {
  await db.tasks.update(taskId, { kanban: { status: 'Todo' } });
}

export async function setKanbanStatus(taskId: string, status: KanbanStatus): Promise<void> {
  await db.tasks.update(taskId, { kanban: { status } });
  if (status === 'Done') {
    await setTaskCompleted(taskId, true);
  }
}

export async function removeFromKanban(taskId: string): Promise<void> {
  await db.tasks.update(taskId, { kanban: null });
}

export async function addToWeek(taskId: string, weekId: string): Promise<void> {
  await db.tasks.update(taskId, {
    weekly: { weekId, day: 'Unplanned', repeatWeekly: false },
  });
}

export async function setWeeklyDay(taskId: string, day: WeekDay): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task?.weekly) return;
  await db.tasks.update(taskId, { weekly: { ...task.weekly, day } });
}

export async function removeFromWeek(taskId: string): Promise<void> {
  await db.tasks.update(taskId, { weekly: null });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- taskMembership.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/taskMembership.ts src/db/repositories/taskMembership.test.ts
git commit -m "feat: add independent kanban/weekly task membership helpers"
```

---

### Task 6: Container Repository

**Files:**
- Create: `src/db/repositories/containers.ts`
- Test: `src/db/repositories/containers.test.ts`

**Interfaces:**
- Consumes: `db`, `Container`, `listTasksByContainer` (from `./tasks`),
  `INBOX_CONTAINER_ID`.
- Produces: `listContainersByProject(projectId: string): Promise<Container[]>`,
  `createContainer(projectId: string, name: string): Promise<Container>`,
  `renameContainer(id: string, name: string): Promise<void>`,
  `reorderContainers(projectId: string, orderedIds: string[]): Promise<void>`,
  `deleteContainer(id: string): Promise<void>` (reassigns every task in the
  deleted container to `INBOX_CONTAINER_ID`/`INBOX_PROJECT_ID` before
  deleting the container; refuses to delete the Inbox's own container by
  throwing).

- [ ] **Step 1: Write the failing test**

```ts
// src/db/repositories/containers.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-containers-${Math.random()}`) };
});

import {
  createContainer,
  listContainersByProject,
  renameContainer,
  reorderContainers,
  deleteContainer,
} from './containers';
import { createProject } from './projects';
import { createTask } from './tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';
import { db } from '../db';

describe('container repository', () => {
  it('creates, lists, renames, and reorders containers', async () => {
    const project = await createProject('Demo');
    const c1 = await createContainer(project.id, 'Backlog');
    const c2 = await createContainer(project.id, 'Doing');
    expect((await listContainersByProject(project.id)).map((c) => c.name)).toEqual(['Backlog', 'Doing']);

    await renameContainer(c1.id, 'Ideas');
    expect((await listContainersByProject(project.id))[0].name).toBe('Ideas');

    await reorderContainers(project.id, [c2.id, c1.id]);
    expect((await listContainersByProject(project.id)).map((c) => c.id)).toEqual([c2.id, c1.id]);
  });

  it('reassigns tasks to Inbox when deleting a container', async () => {
    const project = await createProject('Demo2');
    const container = await createContainer(project.id, 'Backlog');
    const task = await createTask({ title: 'T', projectId: project.id, containerId: container.id });

    await deleteContainer(container.id);

    const moved = await db.tasks.get(task.id);
    expect(moved?.containerId).toBe(INBOX_CONTAINER_ID);
    expect(moved?.projectId).toBe(INBOX_PROJECT_ID);
    expect(await db.containers.get(container.id)).toBeUndefined();
  });

  it('refuses to delete the Inbox container', async () => {
    await expect(deleteContainer(INBOX_CONTAINER_ID)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- containers.test.ts`
Expected: FAIL — `./containers` module doesn't exist (and `./projects` doesn't exist yet either).

- [ ] **Step 3: Write the implementation**

```ts
// src/db/repositories/containers.ts
import { db } from '../db';
import type { Container } from '../schema';
import { INBOX_CONTAINER_ID, INBOX_PROJECT_ID } from '../inbox';

export async function listContainersByProject(projectId: string): Promise<Container[]> {
  return db.containers.where('projectId').equals(projectId).sortBy('order');
}

export async function createContainer(projectId: string, name: string): Promise<Container> {
  const count = await db.containers.where('projectId').equals(projectId).count();
  const container: Container = { id: crypto.randomUUID(), projectId, name, order: count };
  await db.containers.add(container);
  return container;
}

export async function renameContainer(id: string, name: string): Promise<void> {
  await db.containers.update(id, { name });
}

export async function reorderContainers(projectId: string, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.containers, async () => {
    await Promise.all(orderedIds.map((id, index) => db.containers.update(id, { order: index })));
  });
}

export async function deleteContainer(id: string): Promise<void> {
  if (id === INBOX_CONTAINER_ID) {
    throw new Error('Cannot delete the Inbox container');
  }
  await db.transaction('rw', db.containers, db.tasks, async () => {
    const tasks = await db.tasks.where('containerId').equals(id).toArray();
    await Promise.all(
      tasks.map((t) =>
        db.tasks.update(t.id, { containerId: INBOX_CONTAINER_ID, projectId: INBOX_PROJECT_ID }),
      ),
    );
    await db.containers.delete(id);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- containers.test.ts`
Expected: PASS (once Task 7's `createProject` also exists — see note below)

Note: this test imports `createProject` from `./projects`, written in Task 7.
Implement Task 7 immediately after this one before running the full suite;
running just this file will fail to resolve the import until then.

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/containers.ts src/db/repositories/containers.test.ts
git commit -m "feat: add container repository with Inbox reassignment on delete"
```

---

### Task 7: Project Repository

**Files:**
- Create: `src/db/repositories/projects.ts`
- Test: `src/db/repositories/projects.test.ts`

**Interfaces:**
- Consumes: `db`, `Project`, `listContainersByProject`, `deleteContainer`
  (from `./containers`), `INBOX_PROJECT_ID`.
- Produces: `listProjects(): Promise<Project[]>`,
  `createProject(name: string): Promise<Project>`,
  `renameProject(id: string, name: string): Promise<void>`,
  `reorderProjects(orderedIds: string[]): Promise<void>`,
  `deleteProject(id: string): Promise<void>` (deletes every container in the
  project via `deleteContainer`, which reassigns their tasks to Inbox, then
  deletes the project itself; refuses to delete `INBOX_PROJECT_ID`).

- [ ] **Step 1: Write the failing test**

```ts
// src/db/repositories/projects.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-projects-${Math.random()}`) };
});

import { createProject, listProjects, renameProject, reorderProjects, deleteProject } from './projects';
import { createContainer, listContainersByProject } from './containers';
import { createTask } from './tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';
import { db } from '../db';

describe('project repository', () => {
  it('creates, lists, renames, and reorders projects', async () => {
    const p1 = await createProject('Alpha');
    const p2 = await createProject('Beta');
    const names = (await listProjects()).map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Inbox', 'Alpha', 'Beta']));

    await renameProject(p1.id, 'Alpha Renamed');
    expect((await listProjects()).find((p) => p.id === p1.id)?.name).toBe('Alpha Renamed');

    await reorderProjects([p2.id, p1.id]);
    const ordered = await listProjects();
    expect(ordered.findIndex((p) => p.id === p2.id)).toBeLessThan(
      ordered.findIndex((p) => p.id === p1.id),
    );
  });

  it('deletes a project, cascading containers and reassigning tasks to Inbox', async () => {
    const project = await createProject('Gamma');
    const container = await createContainer(project.id, 'Backlog');
    const task = await createTask({ title: 'T', projectId: project.id, containerId: container.id });

    await deleteProject(project.id);

    expect(await db.projects.get(project.id)).toBeUndefined();
    expect(await listContainersByProject(project.id)).toEqual([]);
    const moved = await db.tasks.get(task.id);
    expect(moved?.projectId).toBe(INBOX_PROJECT_ID);
    expect(moved?.containerId).toBe(INBOX_CONTAINER_ID);
  });

  it('refuses to delete the Inbox project', async () => {
    await expect(deleteProject(INBOX_PROJECT_ID)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- projects.test.ts`
Expected: FAIL — `./projects` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/db/repositories/projects.ts
import { db } from '../db';
import type { Project } from '../schema';
import { INBOX_PROJECT_ID } from '../inbox';
import { listContainersByProject, deleteContainer } from './containers';

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy('order').toArray();
}

export async function createProject(name: string): Promise<Project> {
  const count = await db.projects.count();
  const project: Project = { id: crypto.randomUUID(), name, order: count };
  await db.projects.add(project);
  return project;
}

export async function renameProject(id: string, name: string): Promise<void> {
  await db.projects.update(id, { name });
}

export async function reorderProjects(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.projects, async () => {
    await Promise.all(orderedIds.map((id, index) => db.projects.update(id, { order: index })));
  });
}

export async function deleteProject(id: string): Promise<void> {
  if (id === INBOX_PROJECT_ID) {
    throw new Error('Cannot delete the Inbox project');
  }
  const containers = await listContainersByProject(id);
  for (const container of containers) {
    await deleteContainer(container.id);
  }
  await db.projects.delete(id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all repository tests (Tasks 2–7) pass together now.

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/projects.ts src/db/repositories/projects.test.ts
git commit -m "feat: add project repository with cascading delete to Inbox"
```

---

### Task 8: App Shell & Nav Tabs

**Files:**
- Create: `src/components/layout/NavTabs.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/layout/NavTabs.test.tsx`

**Interfaces:**
- Consumes: `listProjects` (from `../../db/repositories/projects`),
  `INBOX_PROJECT_ID` (from `../../db/inbox`), `useLiveQuery` from
  `dexie-react-hooks`.
- Produces: `<NavTabs active={activeView} onSelect={(view) => void} />`
  where `activeView` is `{ kind: 'weekly' } | { kind: 'kanban' } | { kind: 'project'; projectId: string }`,
  rendered by the updated `<App />`, which owns `activeView` in `useState`
  and renders a placeholder `<div>` per view (real views arrive in later
  tasks and replace the placeholders).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/layout/NavTabs.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../../db/db';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-navtabs-${Math.random()}`) };
});

import { NavTabs } from './NavTabs';
import { createProject } from '../../db/repositories/projects';

describe('NavTabs', () => {
  it('renders Weekly Plan, Kanban, Inbox, and project tabs, and calls onSelect', async () => {
    await createProject('Alpha');
    const onSelect = vi.fn();
    render(<NavTabs active={{ kind: 'weekly' }} onSelect={onSelect} />);

    expect(await screen.findByText('Weekly Plan')).toBeInTheDocument();
    expect(screen.getByText('Kanban')).toBeInTheDocument();
    expect(await screen.findByText('Inbox')).toBeInTheDocument();
    expect(await screen.findByText('Alpha')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Kanban'));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'kanban' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- NavTabs.test.tsx`
Expected: FAIL — `./NavTabs` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/layout/NavTabs.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { listProjects } from '../../db/repositories/projects';
import { INBOX_PROJECT_ID } from '../../db/inbox';

export type ActiveView =
  | { kind: 'weekly' }
  | { kind: 'kanban' }
  | { kind: 'project'; projectId: string };

export function NavTabs({
  active,
  onSelect,
}: {
  active: ActiveView;
  onSelect: (view: ActiveView) => void;
}) {
  const projects = useLiveQuery(listProjects, [], []);

  const isActive = (view: ActiveView) => JSON.stringify(view) === JSON.stringify(active);

  return (
    <nav className="flex gap-2 border-b border-gray-200 px-4">
      {(['weekly', 'kanban'] as const).map((kind) => (
        <button
          key={kind}
          className={`px-3 py-2 ${isActive({ kind }) ? 'border-b-2 border-blue-600 font-medium' : ''}`}
          onClick={() => onSelect({ kind })}
        >
          {kind === 'weekly' ? 'Weekly Plan' : 'Kanban'}
        </button>
      ))}
      {projects
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((project) => (
          <button
            key={project.id}
            className={`px-3 py-2 ${
              isActive({ kind: 'project', projectId: project.id }) ? 'border-b-2 border-blue-600 font-medium' : ''
            } ${project.id === INBOX_PROJECT_ID ? 'italic' : ''}`}
            onClick={() => onSelect({ kind: 'project', projectId: project.id })}
          >
            {project.name}
          </button>
        ))}
    </nav>
  );
}
```

```tsx
// src/App.tsx
import { useState } from 'react';
import { NavTabs, type ActiveView } from './components/layout/NavTabs';

export default function App() {
  const [active, setActive] = useState<ActiveView>({ kind: 'weekly' });

  return (
    <div>
      <NavTabs active={active} onSelect={setActive} />
      <main className="p-4">
        {active.kind === 'weekly' && <div>Weekly Plan view placeholder</div>}
        {active.kind === 'kanban' && <div>Kanban view placeholder</div>}
        {active.kind === 'project' && <div>Project view placeholder: {active.projectId}</div>}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- NavTabs.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/NavTabs.tsx src/components/layout/NavTabs.test.tsx src/App.tsx
git commit -m "feat: add app shell with nav tabs for Weekly Plan, Kanban, and projects"
```

---

### Task 9: Project View & Container Columns

**Files:**
- Create: `src/components/projects/ProjectView.tsx`, `src/components/projects/ContainerColumn.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/projects/ProjectView.test.tsx`

**Interfaces:**
- Consumes: `listContainersByProject`, `createContainer`, `renameContainer`,
  `deleteContainer` (from `../../db/repositories/containers`),
  `listTasksByContainer` (from `../../db/repositories/tasks`).
- Produces: `<ProjectView projectId={string} />`,
  `<ContainerColumn container={Container} />` (renders its tasks as plain
  `<li>` items for now — `TaskCard` replaces this in Task 10).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/projects/ProjectView.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-projectview-${Math.random()}`) };
});

import { ProjectView } from './ProjectView';
import { createProject } from '../../db/repositories/projects';

describe('ProjectView', () => {
  it('creates a container via the UI and lists it', async () => {
    const project = await createProject('Demo');
    render(<ProjectView projectId={project.id} />);

    await userEvent.type(screen.getByPlaceholderText('New container name'), 'Backlog');
    await userEvent.click(screen.getByText('Add container'));

    expect(await screen.findByDisplayValue('Backlog')).toBeInTheDocument();
  });
});
```

Note: `findByDisplayValue`, not `findByText` — the container name renders
inside an editable `<input defaultValue={container.name} />` in
`ContainerColumn`, not as plain text content, so `findByText` cannot match
it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ProjectView.test.tsx`
Expected: FAIL — `./ProjectView` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/projects/ContainerColumn.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { listTasksByContainer } from '../../db/repositories/tasks';
import { renameContainer, deleteContainer } from '../../db/repositories/containers';
import type { Container } from '../../db/schema';

export function ContainerColumn({ container }: { container: Container }) {
  const tasks = useLiveQuery(() => listTasksByContainer(container.id), [container.id], []);

  return (
    <div className="w-64 shrink-0 rounded border border-gray-200 p-2">
      <div className="mb-2 flex items-center justify-between">
        <input
          className="font-medium"
          defaultValue={container.name}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== container.name) {
              void renameContainer(container.id, e.target.value.trim());
            }
          }}
        />
        <button
          aria-label={`Delete ${container.name}`}
          onClick={() => void deleteContainer(container.id)}
        >
          ×
        </button>
      </div>
      <ul>
        {tasks.map((task) => (
          <li key={task.id} className="py-1">
            {task.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

```tsx
// src/components/projects/ProjectView.tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listContainersByProject, createContainer } from '../../db/repositories/containers';
import { ContainerColumn } from './ContainerColumn';

export function ProjectView({ projectId }: { projectId: string }) {
  const containers = useLiveQuery(() => listContainersByProject(projectId), [projectId], []);
  const [newName, setNewName] = useState('');

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          className="border border-gray-300 px-2 py-1"
          placeholder="New container name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          onClick={async () => {
            if (!newName.trim()) return;
            await createContainer(projectId, newName.trim());
            setNewName('');
          }}
        >
          Add container
        </button>
      </div>
      <div className="flex gap-4">
        {containers.map((container) => (
          <ContainerColumn key={container.id} container={container} />
        ))}
      </div>
    </div>
  );
}
```

```tsx
// src/App.tsx (modify the project branch only)
{active.kind === 'project' && <ProjectView projectId={active.projectId} />}
```
Add `import { ProjectView } from './components/projects/ProjectView';` to the top of `src/App.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ProjectView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/ProjectView.tsx src/components/projects/ContainerColumn.tsx src/App.tsx src/components/projects/ProjectView.test.tsx
git commit -m "feat: add project view with container creation and listing"
```

---

### Task 10: Task Card & Task Dialog

**Files:**
- Create: `src/components/projects/TaskCard.tsx`, `src/components/projects/TaskDialog.tsx`
- Modify: `src/components/projects/ContainerColumn.tsx`
- Test: `src/components/projects/TaskDialog.test.tsx`

**Interfaces:**
- Consumes: `createTask`, `updateTask`, `deleteTask`, `setTaskCompleted`
  (from `../../db/repositories/tasks`), `listLabels` (from
  `../../db/repositories/labels`), `Task`, `Label` types.
- Produces: `<TaskCard task={Task} />` (checkbox for `completed`, click to
  open edit dialog, delete button), `<TaskDialog mode={'create' | 'edit'} projectId containerId task?={Task} onClose={() => void} />`
  (title, markdown-plaintext description textarea, label multi-select,
  save/cancel).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/projects/TaskDialog.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-taskdialog-${Math.random()}`) };
});

import { TaskDialog } from './TaskDialog';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';
import { listTasksByContainer } from '../../db/repositories/tasks';

describe('TaskDialog', () => {
  it('creates a task with a title and description', async () => {
    const onClose = vi.fn();
    render(
      <TaskDialog
        mode="create"
        projectId={INBOX_PROJECT_ID}
        containerId={INBOX_CONTAINER_ID}
        onClose={onClose}
      />,
    );

    await userEvent.type(screen.getByLabelText('Title'), 'Write spec');
    await userEvent.type(screen.getByLabelText('Description'), 'Some **markdown**');
    await userEvent.click(screen.getByText('Save'));

    expect(onClose).toHaveBeenCalled();
    const tasks = await listTasksByContainer(INBOX_CONTAINER_ID);
    expect(tasks.find((t) => t.title === 'Write spec')?.description).toBe('Some **markdown**');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- TaskDialog.test.tsx`
Expected: FAIL — `./TaskDialog` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/projects/TaskDialog.tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createTask, updateTask, deleteTask } from '../../db/repositories/tasks';
import { listLabels } from '../../db/repositories/labels';
import type { Task } from '../../db/schema';

export function TaskDialog({
  mode,
  projectId,
  containerId,
  task,
  onClose,
}: {
  mode: 'create' | 'edit';
  projectId: string;
  containerId: string;
  task?: Task;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [labels, setLabels] = useState<string[]>(task?.labels ?? []);
  const allLabels = useLiveQuery(listLabels, [], []);

  async function save() {
    if (!title.trim()) return;
    if (mode === 'create') {
      await createTask({ title: title.trim(), description, labels, projectId, containerId });
    } else if (task) {
      await updateTask(task.id, { title: title.trim(), description, labels });
    }
    onClose();
  }

  return (
    <div role="dialog" className="fixed inset-0 flex items-center justify-center bg-black/30">
      <div className="w-96 rounded bg-white p-4">
        <label htmlFor="task-title">Title</label>
        <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mb-2 block w-full border" />

        <label htmlFor="task-description">Description</label>
        <textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-2 block w-full border"
        />

        <fieldset className="mb-2">
          <legend>Labels</legend>
          {allLabels.map((label) => (
            <label key={label.id} className="mr-2">
              <input
                type="checkbox"
                checked={labels.includes(label.id)}
                onChange={(e) =>
                  setLabels((prev) =>
                    e.target.checked ? [...prev, label.id] : prev.filter((l) => l !== label.id),
                  )
                }
              />
              {label.name}
            </label>
          ))}
        </fieldset>

        <div className="flex justify-between">
          {mode === 'edit' && task && (
            <button
              onClick={async () => {
                await deleteTask(task.id);
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose}>Cancel</button>
            <button onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// src/components/projects/TaskCard.tsx
import { useState } from 'react';
import { setTaskCompleted } from '../../db/repositories/tasks';
import type { Task } from '../../db/schema';
import { TaskDialog } from './TaskDialog';

export function TaskCard({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center gap-2 py-1">
      <input
        type="checkbox"
        checked={task.completed}
        onChange={(e) => void setTaskCompleted(task.id, e.target.checked)}
      />
      <button className="flex-1 text-left" onClick={() => setEditing(true)}>
        {task.title}
      </button>
      {editing && (
        <TaskDialog
          mode="edit"
          projectId={task.projectId}
          containerId={task.containerId}
          task={task}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
```

```tsx
// src/components/projects/ContainerColumn.tsx (replace the <ul> block)
import { TaskCard } from './TaskCard';
import { TaskDialog } from './TaskDialog';
import { useState } from 'react';
// ...keep existing imports and component signature...
```
Replace the `<ul>...</ul>` in `ContainerColumn` with:
```tsx
<ul>
  {tasks.map((task) => (
    <li key={task.id}>
      <TaskCard task={task} />
    </li>
  ))}
</ul>
<AddTaskButton projectId={container.projectId} containerId={container.id} />
```
Add this small helper in the same file:
```tsx
function AddTaskButton({ projectId, containerId }: { projectId: string; containerId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>+ Add task</button>
      {open && (
        <TaskDialog mode="create" projectId={projectId} containerId={containerId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- TaskDialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/TaskCard.tsx src/components/projects/TaskDialog.tsx src/components/projects/ContainerColumn.tsx src/components/projects/TaskDialog.test.tsx
git commit -m "feat: add task card and create/edit/delete task dialog"
```

---

### Task 11: Drag & Drop Tasks Between Containers

**Files:**
- Modify: `src/components/projects/TaskCard.tsx`, `src/components/projects/ContainerColumn.tsx`, `src/components/projects/ProjectView.tsx`
- Test: `src/components/projects/ContainerColumn.test.tsx` (new)

**Interfaces:**
- Consumes: `DndContext` (from `@dnd-kit/core`, wraps the board in
  `ProjectView`), `useDroppable`, `useDraggable`, `updateTask` (from
  `../../db/repositories/tasks`).
- Produces: `TaskCard` becomes a drag source via
  `useDraggable({ id: task.id })` wrapping its existing root element
  (no change to its props or behavior — same component used everywhere
  else); `ContainerColumn` becomes a drop target via
  `useDroppable({ id: container.id })` wrapping its existing root element;
  `ProjectView` wraps its container list in `<DndContext onDragEnd={...}>`
  where `onDragEnd` calls
  `updateTask(taskId, { containerId: newContainerId, projectId })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/projects/ContainerColumn.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DndContext } from '@dnd-kit/core';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-containercolumn-dnd-${Math.random()}`) };
});

import { ContainerColumn } from './ContainerColumn';
import { createProject } from '../../db/repositories/projects';
import { createContainer } from '../../db/repositories/containers';
import { createTask } from '../../db/repositories/tasks';

describe('ContainerColumn drag-and-drop', () => {
  it('renders itself as a drop target and its tasks as drag sources', async () => {
    const project = await createProject('Demo');
    const container = await createContainer(project.id, 'Backlog');
    await createTask({ title: 'Movable task', projectId: project.id, containerId: container.id });

    render(
      <DndContext onDragEnd={() => {}}>
        <ContainerColumn container={container} />
      </DndContext>,
    );

    const columnHeading = await screen.findByDisplayValue('Backlog');
    expect(columnHeading.closest('[data-dnd-droppable]')).toBeInTheDocument();
    const taskRow = await screen.findByText('Movable task');
    expect(taskRow.closest('[data-dnd-draggable]')).toBeInTheDocument();
  });
});
```

Note: full pointer-drag simulation with `@dnd-kit` requires a real pointer
sensor and is out of scope for a jsdom unit test — this test only verifies
the drag/drop scaffolding is present. The `onDragEnd` → `updateTask` wiring
is exercised manually (see the Manual Smoke Test after Task 21) and is a
thin, already-tested call (Task 4 covers `updateTask`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ContainerColumn.test.tsx`
Expected: FAIL — no `[data-dnd-droppable]`/`[data-dnd-draggable]` attributes exist yet.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/projects/TaskCard.tsx (wrap the existing root <div> in a draggable)
import { useDraggable } from '@dnd-kit/core';
// ...keep existing imports...

export function TaskCard({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      data-dnd-draggable
      {...listeners}
      {...attributes}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined }}
      className="flex items-center gap-2 py-1"
    >
      {/* ...unchanged existing checkbox, title button, badges, and dialog JSX... */}
    </div>
  );
}
```

```tsx
// src/components/projects/ContainerColumn.tsx (wrap the existing root <div> in a droppable)
import { useDroppable } from '@dnd-kit/core';
// ...keep existing imports...

export function ContainerColumn({ container }: { container: Container }) {
  const tasks = useLiveQuery(() => listTasksByContainer(container.id), [container.id], []);
  const { setNodeRef } = useDroppable({ id: container.id });

  return (
    <div ref={setNodeRef} data-dnd-droppable className="w-64 shrink-0 rounded border border-gray-200 p-2">
      {/* ...unchanged existing header input/delete button, task list, and AddTaskButton... */}
    </div>
  );
}
```

```tsx
// src/components/projects/ProjectView.tsx (wrap the container list in a DndContext)
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { updateTask } from '../../db/repositories/tasks';
// ...keep existing imports...

export function ProjectView({ projectId }: { projectId: string }) {
  // ...keep existing containers query and newName state...

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    await updateTask(String(active.id), { containerId: String(over.id), projectId });
  }

  return (
    <div>
      {/* ...unchanged "add container" input/button... */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4">
          {containers.map((container) => (
            <ContainerColumn key={container.id} container={container} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ContainerColumn.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/TaskCard.tsx src/components/projects/ContainerColumn.tsx src/components/projects/ProjectView.tsx src/components/projects/ContainerColumn.test.tsx
git commit -m "feat: add drag-and-drop between containers within a project"
```

---

### Task 12: Label Manager UI

**Files:**
- Create: `src/components/labels/LabelManager.tsx`
- Modify: `src/App.tsx`, `src/components/layout/NavTabs.tsx`
- Test: `src/components/labels/LabelManager.test.tsx`

**Interfaces:**
- Consumes: `listLabels`, `createLabel`, `updateLabel`, `deleteLabel`.
- Produces: `<LabelManager />`; `ActiveView` gains
  `| { kind: 'labels' }`; `NavTabs` gets a "Labels" button alongside
  "Weekly Plan"/"Kanban".

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/labels/LabelManager.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-labelmanager-${Math.random()}`) };
});

import { LabelManager } from './LabelManager';

describe('LabelManager', () => {
  it('creates and lists a label', async () => {
    render(<LabelManager />);
    await userEvent.type(screen.getByPlaceholderText('Label name'), 'Security');
    await userEvent.click(screen.getByText('Add label'));
    expect(await screen.findByDisplayValue('Security')).toBeInTheDocument();
  });
});
```

Note: `findByDisplayValue`, not `findByText` — the label name renders inside
an editable `<input defaultValue={label.name} />` (same pattern as
`ContainerColumn`'s rename input from Task 9), not as plain text content.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- LabelManager.test.tsx`
Expected: FAIL — `./LabelManager` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/labels/LabelManager.tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listLabels, createLabel, updateLabel, deleteLabel } from '../../db/repositories/labels';

export function LabelManager() {
  const labels = useLiveQuery(listLabels, [], []);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          className="border border-gray-300 px-2 py-1"
          placeholder="Label name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button
          onClick={async () => {
            if (!name.trim()) return;
            await createLabel(name.trim(), color);
            setName('');
          }}
        >
          Add label
        </button>
      </div>
      <ul>
        {labels.map((label) => (
          <li key={label.id} className="flex items-center gap-2 py-1">
            <span style={{ backgroundColor: label.color }} className="inline-block h-3 w-3 rounded-full" />
            <input
              defaultValue={label.name}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== label.name) {
                  void updateLabel(label.id, { name: e.target.value.trim() });
                }
              }}
            />
            <button onClick={() => void deleteLabel(label.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Update `ActiveView` in `NavTabs.tsx` to add `| { kind: 'labels' }` and add a
"Labels" tab button next to "Weekly Plan"/"Kanban" (same pattern as the
existing two buttons, iterate `['weekly', 'kanban', 'labels'] as const` and
map `'labels'` to the text `'Labels'`).

Update `App.tsx` to render `active.kind === 'labels' && <LabelManager />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- LabelManager.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/labels/LabelManager.tsx src/components/layout/NavTabs.tsx src/App.tsx src/components/labels/LabelManager.test.tsx
git commit -m "feat: add label manager UI and Labels nav tab"
```

---

### Task 13: Week Helper

**Files:**
- Create: `src/lib/week.ts`
- Test: `src/lib/week.test.ts`

**Interfaces:**
- Produces: `getCurrentWeekId(date?: Date): string` — returns an
  ISO-week-style id like `"2026-W32"` (year + ISO week number, zero-padded
  to 2 digits).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/week.test.ts
import { describe, it, expect } from 'vitest';
import { getCurrentWeekId } from './week';

describe('getCurrentWeekId', () => {
  it('returns an ISO week id for a known date', () => {
    // 2026-08-06 is a Thursday in ISO week 32 of 2026
    expect(getCurrentWeekId(new Date('2026-08-06T12:00:00Z'))).toBe('2026-W32');
  });

  it('handles a date in the first week of January correctly', () => {
    // 2026-01-01 is a Thursday, ISO week 1 of 2026
    expect(getCurrentWeekId(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- week.test.ts`
Expected: FAIL — `./week` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/week.ts
export function getCurrentWeekId(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- week.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/week.ts src/lib/week.test.ts
git commit -m "feat: add ISO week id helper for weekly plan"
```

---

### Task 14: Weekly Plan View

**Files:**
- Create: `src/components/weekly/WeeklyPlanView.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/weekly/WeeklyPlanView.test.tsx`

**Interfaces:**
- Consumes: `getCurrentWeekId` (from `../../lib/week`), `db` (queried
  directly via `useLiveQuery(() => db.tasks.filter(...).toArray())` since
  no repository function yet filters by weekly membership), `WeekDay`.
- Produces: `<WeeklyPlanView />` rendering columns
  `['Unplanned', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']`, each listing tasks
  whose `weekly?.weekId === getCurrentWeekId()` and `weekly.day === column`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/weekly/WeeklyPlanView.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-weeklyview-${Math.random()}`) };
});

import { WeeklyPlanView } from './WeeklyPlanView';
import { createTask } from '../../db/repositories/tasks';
import { addToWeek, setWeeklyDay } from '../../db/repositories/taskMembership';
import { getCurrentWeekId } from '../../lib/week';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';

describe('WeeklyPlanView', () => {
  it('shows a task in the correct day column and not elsewhere', async () => {
    const task = await createTask({ title: 'Plan work', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(task.id, getCurrentWeekId());
    await setWeeklyDay(task.id, 'Tue');

    render(<WeeklyPlanView />);

    expect(await screen.findByText('Plan work')).toBeInTheDocument();
    expect(screen.getByText('Tue').closest('section')).toContainElement(screen.getByText('Plan work'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- WeeklyPlanView.test.tsx`
Expected: FAIL — `./WeeklyPlanView` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/weekly/WeeklyPlanView.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { getCurrentWeekId } from '../../lib/week';
import type { WeekDay } from '../../db/schema';

const COLUMNS: WeekDay[] = ['Unplanned', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function WeeklyPlanView() {
  const weekId = getCurrentWeekId();
  const tasks = useLiveQuery(
    () => db.tasks.filter((t) => t.weekly?.weekId === weekId).toArray(),
    [weekId],
    [],
  );

  return (
    <div className="flex gap-4">
      {COLUMNS.map((day) => (
        <section key={day} className="w-48 shrink-0 rounded border border-gray-200 p-2">
          <h3 className="mb-2 font-medium">{day}</h3>
          <ul>
            {tasks
              .filter((t) => t.weekly?.day === day)
              .map((t) => (
                <li key={t.id} className="py-1">
                  {t.title}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

Update `src/App.tsx`: replace the `'weekly'` placeholder `<div>` with
`<WeeklyPlanView />` and add the import.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- WeeklyPlanView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/weekly/WeeklyPlanView.tsx src/App.tsx src/components/weekly/WeeklyPlanView.test.tsx
git commit -m "feat: add weekly plan view with day columns"
```

---

### Task 15: Add-to-Week Action & Picker

**Files:**
- Create: `src/components/weekly/AddToWeekPicker.tsx`
- Modify: `src/components/projects/TaskCard.tsx`, `src/components/weekly/WeeklyPlanView.tsx`
- Test: `src/components/weekly/AddToWeekPicker.test.tsx`

**Interfaces:**
- Consumes: `addToWeek`, `removeFromWeek` (from
  `../../db/repositories/taskMembership`), `db` (for an all-tasks search
  query), `getCurrentWeekId`.
- Produces: an "Add to this week" button on `TaskCard` calling
  `addToWeek(task.id, getCurrentWeekId())` directly (no picker needed for
  this single-task case); `<AddToWeekPicker onClose={() => void} />`
  rendered from a new "+ Add existing task" button inside
  `WeeklyPlanView`'s Unplanned column — a search input over all tasks not
  already in the current week, clicking a result calls `addToWeek` and
  closes the picker.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/weekly/AddToWeekPicker.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-addtoweek-${Math.random()}`) };
});

import { AddToWeekPicker } from './AddToWeekPicker';
import { createTask } from '../../db/repositories/tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';
import { db } from '../../db/db';
import { getCurrentWeekId } from '../../lib/week';

describe('AddToWeekPicker', () => {
  it('finds a task by search and adds it to the current week on click', async () => {
    await createTask({ title: 'Findable task', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const onClose = vi.fn();
    render(<AddToWeekPicker onClose={onClose} />);

    await userEvent.type(screen.getByPlaceholderText('Search tasks'), 'Findable');
    await userEvent.click(await screen.findByText('Findable task'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const task = await db.tasks.filter((t) => t.title === 'Findable task').first();
    expect(task?.weekly?.weekId).toBe(getCurrentWeekId());
    expect(task?.weekly?.day).toBe('Unplanned');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AddToWeekPicker.test.tsx`
Expected: FAIL — `./AddToWeekPicker` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/weekly/AddToWeekPicker.tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addToWeek } from '../../db/repositories/taskMembership';
import { getCurrentWeekId } from '../../lib/week';

export function AddToWeekPicker({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const weekId = getCurrentWeekId();
  const results = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) =>
            t.weekly?.weekId !== weekId &&
            t.title.toLowerCase().includes(query.toLowerCase()) &&
            query.trim().length > 0,
        )
        .toArray(),
    [query, weekId],
    [],
  );

  return (
    <div role="dialog" className="rounded border border-gray-300 bg-white p-2">
      <input
        className="mb-2 block w-full border"
        placeholder="Search tasks"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul>
        {results.map((task) => (
          <li key={task.id}>
            <button
              onClick={async () => {
                await addToWeek(task.id, weekId);
                onClose();
              }}
            >
              {task.title}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

In `TaskCard.tsx`, add an "Add to this week" button next to the existing
title button:
```tsx
import { addToWeek } from '../../db/repositories/taskMembership';
import { getCurrentWeekId } from '../../lib/week';
// ...inside the returned JSX, alongside the existing title button:
<button onClick={() => void addToWeek(task.id, getCurrentWeekId())}>Add to this week</button>
```

In `WeeklyPlanView.tsx`, add state to toggle the picker and render it above
the Unplanned column:
```tsx
import { useState } from 'react';
import { AddToWeekPicker } from './AddToWeekPicker';
// ...inside WeeklyPlanView component body:
const [pickerOpen, setPickerOpen] = useState(false);
// ...in the JSX, before the COLUMNS.map(...) section:
<button onClick={() => setPickerOpen(true)}>+ Add existing task</button>
{pickerOpen && <AddToWeekPicker onClose={() => setPickerOpen(false)} />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- AddToWeekPicker.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/weekly/AddToWeekPicker.tsx src/components/projects/TaskCard.tsx src/components/weekly/WeeklyPlanView.tsx src/components/weekly/AddToWeekPicker.test.tsx
git commit -m "feat: add ways to add existing tasks to the current week"
```

---

### Task 16: Drag & Drop Within Weekly Plan

**Files:**
- Modify: `src/components/weekly/WeeklyPlanView.tsx`
- Test: `src/components/weekly/WeeklyPlanView.test.tsx` (extend)

**Interfaces:**
- Consumes: `DndContext`, `useDraggable`, `useDroppable` (from
  `@dnd-kit/core`), `setWeeklyDay` (from
  `../../db/repositories/taskMembership`).
- Produces: dragging a task card between day columns in `WeeklyPlanView`
  calls `setWeeklyDay(taskId, newDay)`.

- [ ] **Step 1: Write the failing test**

Add to `WeeklyPlanView.test.tsx`:
```tsx
it('renders day columns as drop targets and task rows as drag sources', async () => {
  const task = await createTask({ title: 'Draggable', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
  await addToWeek(task.id, getCurrentWeekId());

  render(<WeeklyPlanView />);
  const row = await screen.findByText('Draggable');
  expect(row).not.toHaveAttribute('draggable'); // dnd-kit uses pointer events, not native HTML5 DnD
  expect(row.closest('[data-dnd-draggable]')).toBeInTheDocument();
});
```
(This mirrors Task 11's approach: full pointer-drag simulation is out of
scope for jsdom, so the test asserts the drag/drop scaffolding is present.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- WeeklyPlanView.test.tsx`
Expected: FAIL — no `[data-dnd-draggable]` attribute exists yet.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/weekly/WeeklyPlanView.tsx
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { getCurrentWeekId } from '../../lib/week';
import { setWeeklyDay } from '../../db/repositories/taskMembership';
import type { WeekDay } from '../../db/schema';
import { AddToWeekPicker } from './AddToWeekPicker';

const COLUMNS: WeekDay[] = ['Unplanned', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function DraggableTaskRow({ id, title }: { id: string; title: string }) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id });
  return (
    <li
      ref={setNodeRef}
      data-dnd-draggable
      {...listeners}
      {...attributes}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined }}
      className="cursor-grab py-1"
    >
      {title}
    </li>
  );
}

function DayColumn({ day, titles }: { day: WeekDay; titles: { id: string; title: string }[] }) {
  const { setNodeRef } = useDroppable({ id: day });
  return (
    <section ref={setNodeRef} className="w-48 shrink-0 rounded border border-gray-200 p-2">
      <h3 className="mb-2 font-medium">{day}</h3>
      <ul>
        {titles.map((t) => (
          <DraggableTaskRow key={t.id} id={t.id} title={t.title} />
        ))}
      </ul>
    </section>
  );
}

export function WeeklyPlanView() {
  const weekId = getCurrentWeekId();
  const tasks = useLiveQuery(
    () => db.tasks.filter((t) => t.weekly?.weekId === weekId).toArray(),
    [weekId],
    [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    await setWeeklyDay(String(active.id), over.id as WeekDay);
  }

  return (
    <div>
      <button onClick={() => setPickerOpen(true)}>+ Add existing task</button>
      {pickerOpen && <AddToWeekPicker onClose={() => setPickerOpen(false)} />}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="mt-4 flex gap-4">
          {COLUMNS.map((day) => (
            <DayColumn
              key={day}
              day={day}
              titles={tasks.filter((t) => t.weekly?.day === day).map((t) => ({ id: t.id, title: t.title }))}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- WeeklyPlanView.test.tsx`
Expected: PASS (both the Task 14 test and the new Task 16 test)

- [ ] **Step 5: Commit**

```bash
git add src/components/weekly/WeeklyPlanView.tsx src/components/weekly/WeeklyPlanView.test.tsx
git commit -m "feat: add drag-and-drop between weekly plan day columns"
```

---

### Task 17: Kanban View

**Files:**
- Create: `src/components/kanban/KanbanView.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/kanban/KanbanView.test.tsx`

**Interfaces:**
- Consumes: `db`, `KanbanStatus`.
- Produces: `<KanbanView />` rendering columns
  `['Todo', 'Doing', 'Blocked', 'Done']`, listing every task with
  `kanban?.status === column`, across all projects.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/kanban/KanbanView.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-kanbanview-${Math.random()}`) };
});

import { KanbanView } from './KanbanView';
import { createTask } from '../../db/repositories/tasks';
import { addToKanban, setKanbanStatus } from '../../db/repositories/taskMembership';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';

describe('KanbanView', () => {
  it('shows a task in the correct status column', async () => {
    const task = await createTask({ title: 'Ship it', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToKanban(task.id);
    await setKanbanStatus(task.id, 'Doing');

    render(<KanbanView />);

    expect(await screen.findByText('Ship it')).toBeInTheDocument();
    expect(screen.getByText('Doing').closest('section')).toContainElement(screen.getByText('Ship it'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- KanbanView.test.tsx`
Expected: FAIL — `./KanbanView` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/kanban/KanbanView.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { KanbanStatus } from '../../db/schema';

const COLUMNS: KanbanStatus[] = ['Todo', 'Doing', 'Blocked', 'Done'];

export function KanbanView() {
  const tasks = useLiveQuery(() => db.tasks.filter((t) => t.kanban !== null).toArray(), [], []);

  return (
    <div className="flex gap-4">
      {COLUMNS.map((status) => (
        <section key={status} className="w-56 shrink-0 rounded border border-gray-200 p-2">
          <h3 className="mb-2 font-medium">{status}</h3>
          <ul>
            {tasks
              .filter((t) => t.kanban?.status === status)
              .map((t) => (
                <li key={t.id} className="py-1">
                  {t.title}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

Update `src/App.tsx`: replace the `'kanban'` placeholder `<div>` with
`<KanbanView />` and add the import.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- KanbanView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/kanban/KanbanView.tsx src/App.tsx src/components/kanban/KanbanView.test.tsx
git commit -m "feat: add global kanban view with status columns"
```

---

### Task 18: Add-to-Kanban Action & Picker

**Files:**
- Create: `src/components/kanban/AddToKanbanPicker.tsx`
- Modify: `src/components/projects/TaskCard.tsx`, `src/components/kanban/KanbanView.tsx`
- Test: `src/components/kanban/AddToKanbanPicker.test.tsx`

**Interfaces:**
- Consumes: `addToKanban` (from `../../db/repositories/taskMembership`), `db`.
- Produces: an "Add to Kanban" button on `TaskCard` calling
  `addToKanban(task.id)`; `<AddToKanbanPicker onClose={() => void} />`
  (search over tasks not already on the board, click adds via
  `addToKanban` and closes), rendered from a new "+ Add existing task"
  button above the Kanban columns in `KanbanView`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/kanban/AddToKanbanPicker.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-addtokanban-${Math.random()}`) };
});

import { AddToKanbanPicker } from './AddToKanbanPicker';
import { createTask } from '../../db/repositories/tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';
import { db } from '../../db/db';

describe('AddToKanbanPicker', () => {
  it('finds a task by search and adds it to Kanban as Todo on click', async () => {
    await createTask({ title: 'Board me', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const onClose = vi.fn();
    render(<AddToKanbanPicker onClose={onClose} />);

    await userEvent.type(screen.getByPlaceholderText('Search tasks'), 'Board');
    await userEvent.click(await screen.findByText('Board me'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const task = await db.tasks.filter((t) => t.title === 'Board me').first();
    expect(task?.kanban).toEqual({ status: 'Todo' });
  });
});
```

Note: the `onClose` assertion is wrapped in `waitFor` — the click handler
awaits a real IndexedDB write (`addToKanban`) before calling `onClose`, so
asserting immediately after `userEvent.click` is flaky (same issue as
Task 15's `AddToWeekPicker` test).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AddToKanbanPicker.test.tsx`
Expected: FAIL — `./AddToKanbanPicker` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/kanban/AddToKanbanPicker.tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addToKanban } from '../../db/repositories/taskMembership';

export function AddToKanbanPicker({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const results = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) => t.kanban === null && t.title.toLowerCase().includes(query.toLowerCase()) && query.trim().length > 0,
        )
        .toArray(),
    [query],
    [],
  );

  return (
    <div role="dialog" className="rounded border border-gray-300 bg-white p-2">
      <input
        className="mb-2 block w-full border"
        placeholder="Search tasks"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul>
        {results.map((task) => (
          <li key={task.id}>
            <button
              onClick={async () => {
                await addToKanban(task.id);
                onClose();
              }}
            >
              {task.title}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

In `TaskCard.tsx`, add:
```tsx
import { addToKanban } from '../../db/repositories/taskMembership';
// ...alongside the existing "Add to this week" button:
<button onClick={() => void addToKanban(task.id)}>Add to Kanban</button>
```

In `KanbanView.tsx`, add picker toggle state and render above the columns
(same pattern as Task 15's Weekly Plan picker):
```tsx
import { useState } from 'react';
import { AddToKanbanPicker } from './AddToKanbanPicker';
// ...inside KanbanView:
const [pickerOpen, setPickerOpen] = useState(false);
// ...in JSX, before the flex columns div:
<button onClick={() => setPickerOpen(true)}>+ Add existing task</button>
{pickerOpen && <AddToKanbanPicker onClose={() => setPickerOpen(false)} />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- AddToKanbanPicker.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/kanban/AddToKanbanPicker.tsx src/components/projects/TaskCard.tsx src/components/kanban/KanbanView.tsx src/components/kanban/AddToKanbanPicker.test.tsx
git commit -m "feat: add ways to add existing tasks to the kanban board"
```

---

### Task 19: Drag & Drop Within Kanban

**Files:**
- Modify: `src/components/kanban/KanbanView.tsx`
- Test: `src/components/kanban/KanbanView.test.tsx` (extend)

**Interfaces:**
- Consumes: `DndContext`, `useDraggable`, `useDroppable`, `setKanbanStatus`.
- Produces: dragging a task card between status columns calls
  `setKanbanStatus(taskId, newStatus)`, which (per Task 5) marks the task
  completed automatically when dropped on `Done`.

- [ ] **Step 1: Write the failing test**

Add to `KanbanView.test.tsx`:
```tsx
it('marks a task completed when its kanban card is moved to Done', async () => {
  const task = await createTask({ title: 'Finish', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
  await addToKanban(task.id);

  render(<KanbanView />);
  // Simulate the drop directly via the repository call the drag handler uses,
  // since jsdom cannot simulate real pointer-based dnd-kit drags.
  await setKanbanStatus(task.id, 'Done');

  const { db } = await import('../../db/db');
  const updated = await db.tasks.get(task.id);
  expect(updated?.completed).toBe(true);
});
```
Add `import { setKanbanStatus } from '../../db/repositories/taskMembership';`
to the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- KanbanView.test.tsx`
Expected: This particular assertion actually already passes today because
it calls `setKanbanStatus` directly (proven in Task 5) rather than through
the UI — the point of this step is the *next* one, which wires the actual
drag interaction in the component. Run `npm test -- KanbanView.test.tsx`
now and confirm it's green before proceeding, then continue to Step 3 to
add the real drag scaffolding to the component (visually confirmed via
the Manual Smoke Test after Task 21, same caveat as Tasks 11 and 16).

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/kanban/KanbanView.tsx
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { setKanbanStatus } from '../../db/repositories/taskMembership';
import type { KanbanStatus } from '../../db/schema';
import { AddToKanbanPicker } from './AddToKanbanPicker';

const COLUMNS: KanbanStatus[] = ['Todo', 'Doing', 'Blocked', 'Done'];

function DraggableCard({ id, title }: { id: string; title: string }) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id });
  return (
    <li
      ref={setNodeRef}
      data-dnd-draggable
      {...listeners}
      {...attributes}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined }}
      className="cursor-grab py-1"
    >
      {title}
    </li>
  );
}

function StatusColumn({ status, titles }: { status: KanbanStatus; titles: { id: string; title: string }[] }) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className="w-56 shrink-0 rounded border border-gray-200 p-2">
      <h3 className="mb-2 font-medium">{status}</h3>
      <ul>
        {titles.map((t) => (
          <DraggableCard key={t.id} id={t.id} title={t.title} />
        ))}
      </ul>
    </section>
  );
}

export function KanbanView() {
  const tasks = useLiveQuery(() => db.tasks.filter((t) => t.kanban !== null).toArray(), [], []);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    await setKanbanStatus(String(active.id), over.id as KanbanStatus);
  }

  return (
    <div>
      <button onClick={() => setPickerOpen(true)}>+ Add existing task</button>
      {pickerOpen && <AddToKanbanPicker onClose={() => setPickerOpen(false)} />}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="mt-4 flex gap-4">
          {COLUMNS.map((status) => (
            <StatusColumn
              key={status}
              status={status}
              titles={tasks.filter((t) => t.kanban?.status === status).map((t) => ({ id: t.id, title: t.title }))}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- KanbanView.test.tsx`
Expected: PASS (both Task 17's and this task's tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/kanban/KanbanView.tsx src/components/kanban/KanbanView.test.tsx
git commit -m "feat: add drag-and-drop between kanban columns with Done completion"
```

---

### Task 20: Membership Badges on Project Task Cards

**Files:**
- Modify: `src/components/projects/TaskCard.tsx`
- Test: `src/components/projects/TaskCard.test.tsx` (new)

**Interfaces:**
- Consumes: `task.kanban`, `task.weekly` (already on the `Task` object
  passed into `TaskCard`, no new repository calls needed).
- Produces: `TaskCard` renders a small badge reading `"Kanban: <status>"`
  when `task.kanban` is set, and `"Week: <day>"` when `task.weekly` is set.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/projects/TaskCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-taskcard-${Math.random()}`) };
});

import { TaskCard } from './TaskCard';
import type { Task } from '../../db/schema';

const baseTask: Task = {
  id: 't1',
  title: 'Badged task',
  description: '',
  labels: [],
  projectId: 'p',
  containerId: 'c',
  completed: false,
  completedDate: null,
  kanban: { status: 'Doing' },
  weekly: { weekId: '2026-W32', day: 'Tue', repeatWeekly: false },
};

describe('TaskCard membership badges', () => {
  it('shows kanban and weekly badges when the task has that membership', () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText('Kanban: Doing')).toBeInTheDocument();
    expect(screen.getByText('Week: Tue')).toBeInTheDocument();
  });

  it('shows no badges when the task has no membership', () => {
    render(<TaskCard task={{ ...baseTask, kanban: null, weekly: null }} />);
    expect(screen.queryByText(/Kanban:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Week:/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- TaskCard.test.tsx`
Expected: FAIL — no badges rendered yet.

- [ ] **Step 3: Write the implementation**

Add to `TaskCard.tsx`'s returned JSX, after the title button and before the
`AddToWeekPicker`/dialog conditionals:
```tsx
{task.kanban && (
  <span className="rounded bg-gray-100 px-1 text-xs">Kanban: {task.kanban.status}</span>
)}
{task.weekly && (
  <span className="rounded bg-gray-100 px-1 text-xs">Week: {task.weekly.day}</span>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- TaskCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/TaskCard.tsx src/components/projects/TaskCard.test.tsx
git commit -m "feat: show kanban/weekly membership badges on project task cards"
```

---

### Task 21: JSON Import / Export

**Files:**
- Create: `src/lib/importExport.ts`, `src/components/settings/ImportExport.tsx`
- Modify: `src/App.tsx`, `src/components/layout/NavTabs.tsx`
- Test: `src/lib/importExport.test.ts`

**Interfaces:**
- Consumes: `db` (reads/writes all four tables directly inside a
  transaction).
- Produces: `exportData(): Promise<PlanableExport>` where
  `PlanableExport = { version: 1; projects: Project[]; containers: Container[]; tasks: Task[]; labels: Label[] }`;
  `importData(data: PlanableExport): Promise<void>` (clears and replaces all
  four tables, then re-seeds Inbox if missing); `<ImportExport />` UI with
  a "Export" button (triggers a JSON file download) and an "Import" file
  input (reads a `.json` file, calls `importData`); `ActiveView` gains
  `| { kind: 'settings' }` with a "Settings" nav tab.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/importExport.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db/db';

vi.mock('../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db/db')>('../db/db');
  return { db: new PlanableDB(`test-importexport-${Math.random()}`) };
});

import { exportData, importData } from './importExport';
import { createProject } from '../db/repositories/projects';
import { createContainer } from '../db/repositories/containers';
import { createTask } from '../db/repositories/tasks';
import { createLabel } from '../db/repositories/labels';
import { db } from '../db/db';

describe('import/export', () => {
  it('round-trips projects, containers, tasks, and labels', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Backlog');
    const label = await createLabel('Security', '#ff0000');
    await createTask({
      title: 'Exportable',
      labels: [label.id],
      projectId: project.id,
      containerId: container.id,
    });

    const exported = await exportData();
    expect(exported.tasks.find((t) => t.title === 'Exportable')).toBeDefined();

    await db.tasks.clear();
    await db.containers.clear();
    await db.projects.clear();
    await db.labels.clear();

    await importData(exported);

    expect(await db.projects.get(project.id)).toEqual(project);
    expect(await db.containers.get(container.id)).toEqual(container);
    expect(await db.labels.get(label.id)).toEqual(label);
    const task = await db.tasks.filter((t) => t.title === 'Exportable').first();
    expect(task?.labels).toEqual([label.id]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- importExport.test.ts`
Expected: FAIL — `./importExport` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/importExport.ts
import { db } from '../db/db';
import type { Project, Container, Task, Label } from '../db/schema';
import { INBOX_PROJECT, INBOX_CONTAINER } from '../db/inbox';

export interface PlanableExport {
  version: 1;
  projects: Project[];
  containers: Container[];
  tasks: Task[];
  labels: Label[];
}

export async function exportData(): Promise<PlanableExport> {
  const [projects, containers, tasks, labels] = await Promise.all([
    db.projects.toArray(),
    db.containers.toArray(),
    db.tasks.toArray(),
    db.labels.toArray(),
  ]);
  return { version: 1, projects, containers, tasks, labels };
}

export async function importData(data: PlanableExport): Promise<void> {
  await db.transaction('rw', db.projects, db.containers, db.tasks, db.labels, async () => {
    await db.tasks.clear();
    await db.containers.clear();
    await db.projects.clear();
    await db.labels.clear();

    await db.projects.bulkAdd(data.projects);
    if (!data.projects.some((p) => p.id === INBOX_PROJECT.id)) {
      await db.projects.add(INBOX_PROJECT);
    }
    await db.containers.bulkAdd(data.containers);
    if (!data.containers.some((c) => c.id === INBOX_CONTAINER.id)) {
      await db.containers.add(INBOX_CONTAINER);
    }
    await db.labels.bulkAdd(data.labels);
    await db.tasks.bulkAdd(data.tasks);
  });
}
```

```tsx
// src/components/settings/ImportExport.tsx
import { exportData, importData, type PlanableExport } from '../../lib/importExport';

export function ImportExport() {
  async function handleExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planable-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text) as PlanableExport;
    await importData(data);
  }

  return (
    <div>
      <button onClick={handleExport}>Export</button>
      <label>
        Import
        <input type="file" accept="application/json" onChange={handleImport} />
      </label>
    </div>
  );
}
```

Update `NavTabs.tsx`: extend the iterated array to
`['weekly', 'kanban', 'labels', 'settings'] as const` and map `'settings'`
to the text `'Settings'`; update the `ActiveView` union in the same file to
add `| { kind: 'settings' }`.

Update `App.tsx`: import `ImportExport` and render
`active.kind === 'settings' && <ImportExport />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/importExport.ts src/components/settings/ImportExport.tsx src/App.tsx src/components/layout/NavTabs.tsx src/lib/importExport.test.ts
git commit -m "feat: add JSON import/export with Inbox re-seeding"
```

---

## Manual Smoke Test (after Task 21)

Run `npm run dev`, open the app, and verify by hand (drag-and-drop can't be
asserted in jsdom, per Tasks 11/16/19):

1. Create a project via NavTabs' "+" affordance, rename it via double-click
   on its tab, then create a container and a task inside it; edit and
   delete the task. Confirm the project's rename/delete controls don't
   appear on the Inbox tab.
2. Drag the task between two containers in the Project view.
3. Add the task to the current week via its card button; drag it between
   day columns in Weekly Plan.
4. Add the task to Kanban; drag it to `Done` and confirm its checkbox in
   the Project view is now checked.
5. Create a label, assign it to the task, delete the label, confirm the
   task no longer shows it.
6. Export JSON, clear IndexedDB via devtools, reload, import the file back,
   confirm everything reappears including Inbox.
7. In each of the three views (Project, Weekly Plan, Kanban), click a
   task's checkbox / "Add to this week" / "Add to Kanban" button with a
   plain click (no pointer movement) and confirm the click registers as a
   click — the action fires and the task does not get dropped into a
   different container/day/status as if it had been dragged.
8. Open a task's edit dialog and select text (click-drag to highlight)
   inside its description textarea; confirm this text-selection gesture
   does not move the task to a different container underneath the dialog.
