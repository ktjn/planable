import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { setTaskCompleted } from '../../db/repositories/tasks';
import { addToWeek, addToKanban } from '../../db/repositories/taskMembership';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Task } from '../../db/schema';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
import { CalendarPlus, KanbanSquare } from 'lucide-react';
import { TaskDialog } from './TaskDialog';

export function TaskCard({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id: task.id });

  return (
    <>
      <div
        ref={setNodeRef}
        data-dnd-draggable
        {...listeners}
        {...attributes}
        style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined }}
        className="group flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 shadow-sm transition-all hover:border-input hover:bg-background hover:shadow-md active:cursor-grabbing"
      >
        <Checkbox
          checked={task.completed}
          aria-label={`Toggle completed for ${task.title}`}
          onCheckedChange={(checked) => fireAndForget(setTaskCompleted(task.id, checked))}
        />
        <button
          className={`min-w-0 flex-1 truncate text-left text-sm ${
            task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}
          onClick={() => setEditing(true)}
        >
          {task.title}
        </button>
        {task.kanban && (
          <Badge variant="secondary" className="shrink-0">
            Kanban: {task.kanban.status}
          </Badge>
        )}
        {task.weekly && (
          <Badge variant="secondary" className="shrink-0">
            {task.weekly.repeatWeekly ? 'Repeats weekly' : `Week: ${task.weekly.day}`}
          </Badge>
        )}
        <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-muted/50 px-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {!task.weekly && (
            <button
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground underline-offset-2 hover:bg-muted hover:text-foreground"
              onClick={() => fireAndForget(addToWeek(task.id))}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Add to this week
            </button>
          )}
          {!task.kanban && (
            <button
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground underline-offset-2 hover:bg-muted hover:text-foreground"
              onClick={() => fireAndForget(addToKanban(task.id))}
            >
              <KanbanSquare className="h-3.5 w-3.5" />
              Add to Kanban
            </button>
          )}
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
