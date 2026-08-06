import { useState } from 'react';
import { NavTabs, type ActiveView } from './components/layout/NavTabs';
import { ProjectView } from './components/projects/ProjectView';
import { LabelManager } from './components/labels/LabelManager';
import { WeeklyPlanView } from './components/weekly/WeeklyPlanView';
import { KanbanView } from './components/kanban/KanbanView';
import { ImportExport } from './components/settings/ImportExport';

export default function App() {
  const [active, setActive] = useState<ActiveView>({ kind: 'weekly' });

  return (
    <div>
      <NavTabs active={active} onSelect={setActive} />
      <main className="p-4">
        {active.kind === 'weekly' && <WeeklyPlanView />}
        {active.kind === 'kanban' && <KanbanView />}
        {active.kind === 'labels' && <LabelManager />}
        {active.kind === 'settings' && <ImportExport />}
        {active.kind === 'project' && <ProjectView projectId={active.projectId} />}
      </main>
    </div>
  );
}
