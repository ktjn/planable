import type { ReactNode } from 'react';
import { PreviewCard } from '../ui/preview-card';
import type { Task, Container, Project, Label } from '../../db/schema';
import { Badge } from '../ui/badge';
import { EntityLabels } from './EntityLabels';

export function EntityHoverCard({
  children,
  content,
  align = 'start',
}: {
  children: ReactNode;
  content: ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        render={<div className="contents" />}
        delay={300}
        closeDelay={150}
      >
        {children}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner align={align} side="top" sideOffset={8}>
          <PreviewCard.Popup>
            <PreviewCard.Arrow />
            {content}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}

function plainTextExcerpt(markdown: string, maxLen = 200): string {
  const text = markdown.replace(/[#*_`[\]()]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

export function TaskHoverCardContent({
  task,
  containerById,
  projectById,
  labelsById,
}: {
  task: Task;
  containerById: Map<string, Container>;
  projectById: Map<string, Project>;
  labelsById: Map<string, Label>;
}) {
  const container = containerById.get(task.containerId);
  const project = projectById.get(task.projectId);
  const path = [project?.name, container?.name].filter(Boolean).join(' › ');
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium text-foreground">{task.title}</div>
      {path && <div className="text-xs text-muted-foreground">{path}</div>}
      <EntityLabels labelIds={task.labels} labelsById={labelsById} />
      {task.weekly && (
        <Badge variant="secondary" className="w-fit">
          {task.weekly.repeatWeekly ? 'Repeats weekly' : `Week: ${task.weekly.day}`}
        </Badge>
      )}
      {container?.kanban && (
        <Badge variant="outline" className="w-fit">Kanban: {container.kanban.status}</Badge>
      )}
      {task.description && (
        <p className="text-xs text-muted-foreground">{plainTextExcerpt(task.description)}</p>
      )}
      {task.completed && <div className="text-xs text-muted-foreground">Completed</div>}
    </div>
  );
}

export function ContainerHoverCardContent({
  container,
  projectById,
  labelsById,
  taskCount,
}: {
  container: Container;
  projectById: Map<string, Project>;
  labelsById: Map<string, Label>;
  taskCount: number;
}) {
  const project = projectById.get(container.projectId);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium text-foreground">{container.name}</div>
      {project && <div className="text-xs text-muted-foreground">{project.name}</div>}
      <EntityLabels labelIds={container.labels} labelsById={labelsById} />
      {container.kanban && <Badge variant="secondary" className="w-fit">Kanban: {container.kanban.status}</Badge>}
      <div className="text-xs text-muted-foreground">
        {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
      </div>
    </div>
  );
}

export function ProjectHoverCardContent({
  project,
  labelsById,
  containerCount,
  taskCount,
}: {
  project: Project;
  labelsById: Map<string, Label>;
  containerCount: number;
  taskCount: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium text-foreground">{project.name}</div>
      <div className="text-xs text-muted-foreground">
        {containerCount} {containerCount === 1 ? 'container' : 'containers'} · {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
      </div>
    </div>
  );
}
