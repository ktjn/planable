import { useState } from 'react';
import { NavTabs, type ActiveView } from './components/layout/NavTabs';
import { ProjectView } from './components/projects/ProjectView';

export default function App() {
  const [active, setActive] = useState<ActiveView>({ kind: 'weekly' });

  return (
    <div>
      <NavTabs active={active} onSelect={setActive} />
      <main className="p-4">
        {active.kind === 'weekly' && <div>Weekly Plan view placeholder</div>}
        {active.kind === 'kanban' && <div>Kanban view placeholder</div>}
        {active.kind === 'project' && <ProjectView projectId={active.projectId} />}
      </main>
    </div>
  );
}
