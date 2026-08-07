import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical, CalendarPlus, Check } from 'lucide-react';
import { listTasksByContainer } from '../../db/repositories/tasks';
import { addContainerToWeek, removeContainerFromWeek } from '../../db/repositories/containers';
import { fireAndForget } from '../../lib/fireAndForget';
import { getCurrentWeekId } from '../../lib/week';
import { SETTING_ACTIVE_WEEK } from '../../db/repositories/settings';
import { db } from '../../db/db';
import type { Container, Label } from '../../db/schema';
import { TaskCard } from './TaskCard';
import { ContainerDialog } from './ContainerDialog';
import { QuickAddRow } from '../shared/QuickAddRow';
import { EntityLabels } from '../shared/EntityLabels';
import { createTask } from '../../db/repositories/tasks';

function ContainerWeekAction({ container }: { container: Container }) {
  const liveContainer = useLiveQuery(() => db.containers.get(container.id), [container.id], container);
  const activeWeekSetting = useLiveQuery(() => db.settings.get(SETTING_ACTIVE_WEEK), [], undefined);
  const weekId =
    (typeof activeWeekSetting?.value === 'string' && activeWeekSetting.value) || getCurrentWeekId();
  const weekly = liveContainer?.weekly ?? null;
  const scheduledThisWeek = weekly?.weekId === weekId;

  return (
    <div className="border-b border-border/40 px-2 py-1.5">
      {scheduledThisWeek ? (
        <div className="flex items-center justify-between gap-1 rounded-md bg-primary/10 px-2 py-1">
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <Check className="size-3.5" />
            Scheduled: {weekly.day}
          </span>
          <button
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            title={`Remove ${container.name} from this week`}
            onClick={() => fireAndForget(removeContainerFromWeek(container.id))}
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:bg-muted hover:text-foreground"
          title={`Schedule ${container.name} on this week`}
          onClick={() => fireAndForget(addContainerToWeek(container.id, weekId))}
        >
          <CalendarPlus className="size-3.5" />
          Add to this week
        </button>
      )}
    </div>
  );
}

export function ContainerColumn({
  container,
  labelsById,
}: {
  container: Container;
  labelsById: Map<string, Label>;
}) {
  const tasks = useLiveQuery(() => listTasksByContainer(container.id), [container.id], []);
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = useSortable({
    id: container.id,
  });
  const [editing, setEditing] = useState(false);

  return (
    <div
      ref={setNodeRef}
      data-dnd-droppable
      data-dnd-draggable
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      className={`flex w-64 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm ${
        isDragging ? 'opacity-50' : 'hover:shadow-md'
      }`}
    >
      <div
        onDoubleClick={() => setEditing(true)}
        className="flex items-center justify-between gap-1 border-b border-border/60 px-2 py-2"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${container.name}`}
            className="shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground"
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">{container.name}</h3>
            <EntityLabels labelIds={container.labels} labelsById={labelsById} className="mt-0.5" />
          </div>
        </div>
        <span className="ml-1 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
      </div>
      <ContainerWeekAction container={container} />
      <ul className="flex flex-col gap-1 p-1.5">
        {tasks.map((task) => (
          <li key={task.id}>
            <TaskCard task={task} labelsById={labelsById} />
          </li>
        ))}
      </ul>
      <div className="p-1.5 pt-0">
        <QuickAddRow
          onAdd={async (title) => {
            await createTask({ title, projectId: container.projectId, containerId: container.id });
          }}
        />
      </div>
      {editing && <ContainerDialog container={container} onClose={() => setEditing(false)} />}
    </div>
  );
}
