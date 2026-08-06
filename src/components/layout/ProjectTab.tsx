import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical, type LucideIcon } from 'lucide-react';
import { renameProject } from '../../db/repositories/projects';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Project } from '../../db/schema';
import { Button } from '../../components/ui/button';

export function AppSettingsTab({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      className={`h-9 px-3 ${active ? 'text-foreground' : 'text-muted-foreground'}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </Button>
  );
}

export function ProjectTab({
  project,
  pinned = false,
  active,
  onSelect,
  onDelete,
}: {
  project: Project;
  pinned?: boolean;
  active: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = useSortable({
    id: project.id,
    disabled: pinned,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined }}
      className={`flex items-center ${isDragging ? 'opacity-50' : ''}`}
    >
      {!pinned && (
        <button
          ref={setActivatorNodeRef}
          aria-label={`Reorder ${project.name}`}
          className="cursor-grab text-gray-400"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {editing ? (
        <input
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          defaultValue={project.name}
          autoFocus
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== project.name) {
              fireAndForget(renameProject(project.id, e.target.value.trim()));
            }
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setEditing(false);
            }
          }}
        />
      ) : (
        <Button
          variant="ghost"
          className={`h-9 px-3 ${active ? 'text-foreground' : 'text-muted-foreground'} ${
            pinned ? 'italic' : ''
          }`}
          aria-current={active ? 'page' : undefined}
          onClick={onSelect}
          onDoubleClick={() => {
            if (!pinned) setEditing(true);
          }}
        >
          {project.name}
        </Button>
      )}
      {!pinned && onDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${project.name}`}
          onClick={onDelete}
        >
          ×
        </Button>
      )}
    </div>
  );
}
