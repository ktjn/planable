import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search } from 'lucide-react';
import { db } from '../../db/db';
import type { Task, Project } from '../../db/schema';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';

interface SearchContext {
  task: Task;
  project?: Project;
  openTask: (task: Task) => void;
}

export function SearchView({ onOpenTask }: { onOpenTask?: (task: Task) => void }) {
  const [query, setQuery] = useState('');
  const tasks = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) =>
            query.trim().length > 0 &&
            (t.title.toLowerCase().includes(query.toLowerCase()) ||
              t.description.toLowerCase().includes(query.toLowerCase())),
        )
        .toArray()
        .then((arr) => arr.sort((a, b) => a.title.localeCompare(b.title))),
    [query],
    [],
  );
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);

  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  const context = (task: Task): SearchContext => ({
    task,
    project: projectById.get(task.projectId),
    openTask: (t) => {
      onOpenTask?.(t);
      setQuery('');
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-4 text-lg font-medium">Search</h2>
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search tasks and descriptions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>
      <ul className="mt-4 flex flex-col gap-1">
        {(tasks ?? []).map((task) => (
          <TaskResult key={task.id} {...context(task)} />
        ))}
        {query.trim() && (tasks ?? []).length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">No tasks match “{query}”.</li>
        )}
      </ul>
    </div>
  );
}

function TaskResult({ task, project, openTask }: SearchContext) {
  return (
    <li className="flex items-center gap-2 rounded-md border px-3 py-2">
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => openTask(task)}
      >
        <span className="truncate">{task.title}</span>
        {project && <span className="shrink-0 text-xs text-muted-foreground">{project.name}</span>}
        {task.kanban && <Badge variant="secondary">Kanban: {task.kanban.status}</Badge>}
        {task.weekly && <Badge variant="secondary">{task.weekly.repeatWeekly ? 'Repeats weekly' : `Week: ${task.weekly.day}`}</Badge>}
      </button>
      {task.completed && <Badge variant="outline">Done</Badge>}
    </li>
  );
}
