import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CalendarDays, KanbanSquare, Search, Settings, Tags } from 'lucide-react';
import {
  listProjects,
  createProject,
  renameProject,
  deleteProject,
  reorderProjects,
} from '../../db/repositories/projects';
import { INBOX_PROJECT_ID } from '../../db/inbox';
import type { Project } from '../../db/schema';
import { fireAndForget } from '../../lib/fireAndForget';
import { AppSettingsTab, ProjectTab } from './ProjectTab';

export type ActiveView =
  | { kind: 'weekly' }
  | { kind: 'kanban' }
  | { kind: 'labels' }
  | { kind: 'search' }
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
  const [order, setOrder] = useState<string[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const sortedProjects = [...projects]
    .sort((a, b) => a.order - b.order)
    .filter((p) => p.id !== INBOX_PROJECT_ID);
  const inbox = projects.find((p) => p.id === INBOX_PROJECT_ID);
  const ids = order.length === sortedProjects.length ? order : sortedProjects.map((p) => p.id);

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    if (!sortedProjects.some((p) => p.id === activeId)) return;
    setOrder((prev) => {
      const base = prev.length === sortedProjects.length ? prev : sortedProjects.map((p) => p.id);
      const oldIndex = base.indexOf(activeId);
      const newIndex = base.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(base, oldIndex, newIndex);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    if (!sortedProjects.some((p) => p.id === activeId)) return;
    const orderedIds = order.length === sortedProjects.length ? order : sortedProjects.map((p) => p.id);
    fireAndForget(reorderProjects(orderedIds));
  }

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
      {([
        ['weekly', 'Weekly Plan', CalendarDays] as const,
        ['kanban', 'Kanban', KanbanSquare] as const,
        ['search', 'Search', Search] as const,
        ['labels', 'Labels', Tags] as const,
        ['settings', 'Settings', Settings] as const,
      ] as const).map(([kind, label, Icon]) => (
        <AppSettingsTab
          key={kind}
          label={label}
          icon={Icon}
          active={isActive({ kind } as ActiveView)}
          onClick={() => onSelect({ kind } as ActiveView)}
        />
      ))}
      <DndContext sensors={sensors} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex items-center">
          {inbox && (
            <ProjectTab
              project={inbox}
              pinned
              active={isActive({ kind: 'project', projectId: inbox.id })}
              onSelect={() => onSelect({ kind: 'project', projectId: inbox.id })}
            />
          )}
          <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
            {ids
              .map((id) => sortedProjects.find((p) => p.id === id))
              .filter((p): p is Project => Boolean(p))
              .map((project) => (
                <ProjectTab
                  key={project.id}
                  project={project}
                  active={isActive({ kind: 'project', projectId: project.id })}
                  onSelect={() => onSelect({ kind: 'project', projectId: project.id })}
                  onDelete={() => {
                    fireAndForget(deleteProject(project.id));
                    if (active.kind === 'project' && active.projectId === project.id) {
                      onSelect({ kind: 'weekly' });
                    }
                  }}
                />
              ))}
          </SortableContext>
        </div>
      </DndContext>
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

  function isActive(view: ActiveView) {
    return JSON.stringify(view) === JSON.stringify(active);
  }
}
