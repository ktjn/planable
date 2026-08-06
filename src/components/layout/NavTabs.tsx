import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listProjects, createProject, renameProject, deleteProject } from '../../db/repositories/projects';
import { INBOX_PROJECT_ID } from '../../db/inbox';
import { fireAndForget } from '../../lib/fireAndForget';

export type ActiveView =
  | { kind: 'weekly' }
  | { kind: 'kanban' }
  | { kind: 'labels' }
  | { kind: 'settings' }
  | { kind: 'project'; projectId: string };

export function NavTabs({
  active,
  onSelect,
}: {
  active: ActiveView;
  onSelect: (view: ActiveView) => void;
}) {
  const projects = useLiveQuery(listProjects, [], []);
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const isActive = (view: ActiveView) => JSON.stringify(view) === JSON.stringify(active);

  async function handleCreateProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const project = await createProject(name);
    setNewProjectName('');
    setAddingProject(false);
    onSelect({ kind: 'project', projectId: project.id });
  }

  return (
    <nav className="flex items-center gap-2 border-b border-gray-200 px-4">
      {(['weekly', 'kanban', 'labels', 'settings'] as const).map((kind) => (
        <button
          key={kind}
          className={`px-3 py-2 ${isActive({ kind }) ? 'border-b-2 border-blue-600 font-medium' : ''}`}
          onClick={() => onSelect({ kind })}
        >
          {kind === 'weekly'
            ? 'Weekly Plan'
            : kind === 'kanban'
              ? 'Kanban'
              : kind === 'labels'
                ? 'Labels'
                : 'Settings'}
        </button>
      ))}
      {projects
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((project) => {
          const isInbox = project.id === INBOX_PROJECT_ID;

          if (editingProjectId === project.id) {
            return (
              <input
                key={project.id}
                className="px-3 py-2"
                defaultValue={project.name}
                autoFocus
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== project.name) {
                    fireAndForget(renameProject(project.id, e.target.value.trim()));
                  }
                  setEditingProjectId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setEditingProjectId(null);
                  }
                }}
              />
            );
          }

          return (
            <div key={project.id} className="flex items-center">
              <button
                className={`px-3 py-2 ${
                  isActive({ kind: 'project', projectId: project.id })
                    ? 'border-b-2 border-blue-600 font-medium'
                    : ''
                } ${isInbox ? 'italic' : ''}`}
                onClick={() => onSelect({ kind: 'project', projectId: project.id })}
                onDoubleClick={() => {
                  if (!isInbox) setEditingProjectId(project.id);
                }}
              >
                {project.name}
              </button>
              {!isInbox && (
                <button
                  aria-label={`Delete ${project.name}`}
                  onClick={() => {
                    fireAndForget(deleteProject(project.id));
                    if (active.kind === 'project' && active.projectId === project.id) {
                      onSelect({ kind: 'weekly' });
                    }
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      {addingProject ? (
        <input
          className="px-3 py-2"
          placeholder="New project name"
          autoFocus
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              fireAndForget(handleCreateProject());
            } else if (e.key === 'Escape') {
              setAddingProject(false);
              setNewProjectName('');
            }
          }}
          onBlur={() => {
            setAddingProject(false);
            setNewProjectName('');
          }}
        />
      ) : (
        <button aria-label="Add project" onClick={() => setAddingProject(true)}>
          +
        </button>
      )}
    </nav>
  );
}
