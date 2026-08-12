import { useState, type ReactNode } from 'react';
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { GripVertical, CalendarPlus } from 'lucide-react';
import { setTaskCompleted } from '../../db/repositories/tasks';
import { addToWeek } from '../../db/repositories/taskMembership';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Task, Label, Container, Project } from '../../db/schema';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
import { TaskDialog } from './TaskDialog';
import { EntityLabels } from '../shared/EntityLabels';
import { EntityHoverCard, TaskHoverCardContent } from '../shared/EntityHoverCard';

export function TaskCard({
  task,
  labelsById,
  containerById,
  projectById,
  sortableId = task.id,
  extraData,
  showCheckbox = true,
  showWeeklyBadge = true,
  showAddToWeek = true,
  extra,
  className,
  onEdit,
  highlighted = false,
}: {
  task: Task;
  labelsById: Map<string, Label>;
  containerById?: Map<string, Container>;
  projectById?: Map<string, Project>;
  sortableId?: string | null;
  extraData?: Record<string, any>;
  showCheckbox?: boolean;
  showWeeklyBadge?: boolean;
  showAddToWeek?: boolean;
  extra?: ReactNode;
  className?: string;
  onEdit?: (task: Task) => void;
  /** Briefly rings the card, e.g. after being selected from the console. */
  highlighted?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const sortable = useSortable({
    id: sortableId ?? '__disabled__',
    disabled: sortableId === null,
    animateLayoutChanges: defaultAnimateLayoutChanges,
    data: extraData,
  });
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = sortable;

  const hoverContent = (
    <TaskHoverCardContent
      task={task}
      containerById={containerById ?? new Map()}
      projectById={projectById ?? new Map()}
      labelsById={labelsById}
    />
  );

  return (
    <>
      <EntityHoverCard content={hoverContent} disabled={isDragging}>
        <div
          ref={setNodeRef}
          id={`task-${task.id}`}
          data-dnd-draggable
          style={{
            transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
            transition: isDragging ? 'none' : undefined,
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (onEdit) onEdit(task);
            else setEditing(true);
          }}
          className={`group flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out hover:border-input hover:bg-background hover:shadow-md motion-reduce:transition-none ${
            isDragging ? 'opacity-40' : ''
          } ${highlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''} ${className ?? ''}`}
        >
          {showCheckbox && (
            <Checkbox
              checked={task.completed}
              aria-label={`Toggle completed for ${task.title}`}
              onCheckedChange={(checked) => fireAndForget(setTaskCompleted(task.id, checked))}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            />
          )}
          <div
            className={`min-w-16 flex-1 cursor-default text-left text-sm leading-snug line-clamp-2 transition-[color,text-decoration-thickness] duration-300 ease-out motion-reduce:transition-none ${
              task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
            }`}
          >
            {task.title}
          </div>
          <EntityLabels labelIds={task.labels} labelsById={labelsById} />
          {extra}
          {showWeeklyBadge && task.weekly && (
            <Badge variant="secondary" className="shrink-0">
              {task.weekly.repeatWeekly ? 'Repeats weekly' : `Week: ${task.weekly.day}`}
            </Badge>
          )}
          <span className="flex shrink-0 items-center gap-0.5">
            {showAddToWeek && !task.weekly && (
              <button
                className="rounded px-1.5 py-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-muted hover:text-foreground"
                title="Add to this week"
                onClick={(e) => {
                  e.stopPropagation();
                  fireAndForget(addToWeek(task.id));
                }}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
              </button>
            )}
            {sortableId !== null && (
              <button
                ref={setActivatorNodeRef}
                aria-label={`Drag ${task.title}`}
                className="shrink-0 cursor-grab touch-none text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-muted-foreground active:cursor-grabbing"
                {...listeners}
                {...attributes}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}
          </span>
        </div>
      </EntityHoverCard>
      {editing && (
        <TaskDialog
          mode="edit"
          projectId={task.projectId}
          containerId={task.containerId}
          task={task}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
