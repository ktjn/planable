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
