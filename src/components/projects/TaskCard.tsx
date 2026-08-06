import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { setTaskCompleted } from '../../db/repositories/tasks';
import type { Task } from '../../db/schema';
import { TaskDialog } from './TaskDialog';

export function TaskCard({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id: task.id });

  return (
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
        onChange={(e) => void setTaskCompleted(task.id, e.target.checked)}
      />
      <button className="flex-1 text-left" onClick={() => setEditing(true)}>
        {task.title}
      </button>
      {editing && (
        <TaskDialog
          mode="edit"
          projectId={task.projectId}
          containerId={task.containerId}
          task={task}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
