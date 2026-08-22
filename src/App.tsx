import { useRef, useState } from 'react';
import { NavTabs, type ActiveView } from './components/layout/NavTabs';
import { ProjectView } from './components/projects/ProjectView';
import { LabelManager } from './components/labels/LabelManager';
import { WeeklyPlanView } from './components/weekly/WeeklyPlanView';
import { KanbanView } from './components/kanban/KanbanView';
import { AllTasksView } from './components/tasks/AllTasksView';
import { AllContainersView } from './components/containers/AllContainersView';
import { SearchView } from './components/search/SearchView';
import { Settings } from './components/settings/Settings';
import { ConsolePanel } from './components/console/ConsolePanel';
import { useKeyboardShortcuts } from './lib/useKeyboardShortcuts';
import type { HighlightRequest } from './lib/useScrollHighlight';
import type { Task } from './db/schema';

export default function App() {
  const [active, setActive] = useState<ActiveView>({ kind: 'weekly' });
  const [highlight, setHighlight] = useState<HighlightRequest | null>(null);
  const highlightSeq = useRef(0);

  function handleConsoleNavigate(view: ActiveView, highlightId?: string) {
    setActive(view);
    if (highlightId) {
      highlightSeq.current += 1;
      setHighlight({ id: highlightId, key: highlightSeq.current });
    }
  }

  useKeyboardShortcuts([
    {
      key: 'w',
      handler: () => setActive({ kind: 'weekly' }),
      description: 'Go to the Weekly Plan',
      target: 'nav',
    },
    {
      key: 'k',
      handler: () => setActive({ kind: 'kanban' }),
      description: 'Go to the Kanban board',
      target: 'nav',
    },
    {
      key: 'f',
      ctrl: true,
      handler: () => setActive({ kind: 'search' }),
      description: 'Search tasks',
      target: 'nav',
    },
    {
      key: '/',
      handler: () => setActive({ kind: 'search' }),
      description: 'Quick search',
      target: 'nav',
    },
    {
      key: 'l',
      handler: () => setActive({ kind: 'labels' }),
      description: 'Manage labels',
      target: 'nav',
    },
    {
      key: 's',
      handler: () => setActive({ kind: 'settings' }),
      description: 'Open settings',
      target: 'nav',
    },
  ]);

  function openTaskInProject(task: Task) {
    setActive({ kind: 'project', projectId: task.projectId });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <NavTabs active={active} onSelect={setActive} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-14 md:px-6">
        <div key={active.kind === 'project' ? `${active.kind}-${active.projectId}` : active.kind} className="view-enter">
          {active.kind === 'weekly' && <WeeklyPlanView />}
          {active.kind === 'kanban' && <KanbanView />}
          {active.kind === 'all-tasks' && <AllTasksView highlight={highlight} />}
          {active.kind === 'all-containers' && <AllContainersView highlight={highlight} />}
          {active.kind === 'labels' && <LabelManager highlight={highlight} />}
          {active.kind === 'search' && <SearchView onOpenTask={openTaskInProject} />}
          {active.kind === 'settings' && <Settings />}
          {active.kind === 'project' && <ProjectView projectId={active.projectId} />}
        </div>
      </main>
      <ConsolePanel onNavigate={handleConsoleNavigate} />
    </div>
  );
}
