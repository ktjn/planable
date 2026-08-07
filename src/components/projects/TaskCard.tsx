import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import { setTaskCompleted } from '../../db/repositories/tasks';
import { addToWeek } from '../../db/repositories/taskMembership';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Task, Label } from '../../db/schema';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
import { CalendarPlus } from 'lucide-react';
import { TaskDialog } from './TaskDialog';
import { EntityLabels } from '../shared/EntityLabels';

export function TaskCard({
  task,
  labelsById,
}: {
  task: Task;
  labelsById: Map<string, Label>;
}) {
  const [editing, setEditing] = useState(false);
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <>
      <div
        ref={setNodeRef}
        data-dnd-draggable
        style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
        onDoubleClick={() => setEditing(true)}
        className={`group flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 shadow-sm hover:border-input hover:bg-background hover:shadow-md ${
          isDragging ? 'opacity-50' : ''
        }`}
      >
        <Checkbox
          checked={task.completed}
          aria-label={`Toggle completed for ${task.title}`}
          onCheckedChange={(checked) => fireAndForget(setTaskCompleted(task.id, checked))}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className={`min-w-0 flex-1 truncate text-left text-sm ${
            task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {task.title}
        </button>
        <EntityLabels labelIds={task.labels} labelsById={labelsById} />
        {task.weekly && (
          <Badge variant="secondary" className="shrink-0">
            {task.weekly.repeatWeekly ? 'Repeats weekly' : `Week: ${task.weekly.day}`}
          </Badge>
        )}
        <span className="flex shrink-0 items-center gap-0.5">
          {!task.weekly && (
            <button
              className="rounded px-1.5 py-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-muted hover:text-foreground"
              title="Add to this week"
              onClick={(e) => {
                e.stopPropagation();
                fireAndForget(addToWeek(task.id));
              }}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            ref={setActivatorNodeRef}
            aria-label={`Drag ${task.title}`}
            className="shrink-0 cursor-grab touch-none text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-muted-foreground active:cursor-grabbing"
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </span>
      </div>
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
