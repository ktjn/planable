import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { setTaskCompleted } from '../../db/repositories/tasks';
import { addToWeek, addToKanban } from '../../db/repositories/taskMembership';
import { getCurrentWeekId } from '../../lib/week';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Task } from '../../db/schema';
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
        className="flex items-center gap-2 py-1"
      >
        <input
          type="checkbox"
          checked={task.completed}
          onChange={(e) => fireAndForget(setTaskCompleted(task.id, e.target.checked))}
        />
        <button className="flex-1 text-left" onClick={() => setEditing(true)}>
          {task.title}
        </button>
        {task.kanban && (
          <span className="rounded bg-gray-100 px-1 text-xs">Kanban: {task.kanban.status}</span>
        )}
        {task.weekly && (
          <span className="rounded bg-gray-100 px-1 text-xs">Week: {task.weekly.day}</span>
        )}
        {!task.weekly && (
          <button onClick={() => fireAndForget(addToWeek(task.id, getCurrentWeekId()))}>
            Add to this week
          </button>
        )}
        {!task.kanban && (
          <button onClick={() => fireAndForget(addToKanban(task.id))}>Add to Kanban</button>
        )}
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
