import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { setTaskCompleted } from '../../db/repositories/tasks';
import { addToWeek, addToKanban } from '../../db/repositories/taskMembership';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Task } from '../../db/schema';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
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
        className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
      >
        <Checkbox
          checked={task.completed}
          aria-label={`Toggle completed for ${task.title}`}
          onCheckedChange={(checked) => fireAndForget(setTaskCompleted(task.id, checked))}
        />
        <button className={`flex-1 text-left ${task.completed ? 'text-muted-foreground line-through' : ''}`} onClick={() => setEditing(true)}>
          {task.title}
        </button>
        {task.kanban && (
          <Badge variant="secondary">Kanban: {task.kanban.status}</Badge>
        )}
        {task.weekly && (
          <Badge variant="secondary">
            {task.weekly.repeatWeekly ? 'Repeats weekly' : `Week: ${task.weekly.day}`}
          </Badge>
        )}
        <span className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!task.weekly && (
            <button className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => fireAndForget(addToWeek(task.id))}>
              Add to this week
            </button>
          )}
          {!task.kanban && (
            <button className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => fireAndForget(addToKanban(task.id))}>
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
