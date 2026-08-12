import type { ActiveView } from '../components/layout/NavTabs';

export interface ConsoleAction {
  id: string;
  title: string;
  subtitle?: string;
  keywords: string[];
  run: () => void | Promise<void>;
}

export interface ConsoleActionContext {
  navigate: (view: ActiveView) => void;
  toggleTheme: () => void;
  resetAll: () => Promise<void>;
  addSampleData: () => Promise<void>;
  projects: { id: string; name: string }[];
}

function gotoAction(view: ActiveView, id: string, title: string, keywords: string[], navigate: (view: ActiveView) => void): ConsoleAction {
  return {
    id,
    title,
    subtitle: 'Go to view',
    keywords: ['goto', 'go', 'open', ...keywords],
    run: () => navigate(view),
  };
}

/** Builds the full list of `>` commands: fixed navigation/data actions plus one per project. */
export function buildConsoleActions(ctx: ConsoleActionContext): ConsoleAction[] {
  const actions: ConsoleAction[] = [
    gotoAction({ kind: 'weekly' }, 'goto-weekly', 'Go to Weekly Plan', ['weekly', 'plan', 'week'], ctx.navigate),
    gotoAction({ kind: 'kanban' }, 'goto-kanban', 'Go to Kanban', ['kanban', 'board'], ctx.navigate),
    gotoAction({ kind: 'all-tasks' }, 'goto-all-tasks', 'Go to All Tasks', ['tasks'], ctx.navigate),
    gotoAction({ kind: 'all-containers' }, 'goto-all-containers', 'Go to All Containers', ['containers'], ctx.navigate),
    gotoAction({ kind: 'labels' }, 'goto-labels', 'Go to Labels', ['labels', 'tags'], ctx.navigate),
    gotoAction({ kind: 'search' }, 'goto-search', 'Go to Search', ['search', 'find'], ctx.navigate),
    gotoAction({ kind: 'settings' }, 'goto-settings', 'Go to Settings', ['settings', 'preferences'], ctx.navigate),
    {
      id: 'toggle-theme',
      title: 'Toggle light / dark theme',
      subtitle: 'Appearance',
      keywords: ['theme', 'dark', 'light', 'mode'],
      run: ctx.toggleTheme,
    },
    {
      id: 'reset-all',
      title: 'Reset all data',
      subtitle: 'Clear every project, container, task, and label',
      keywords: ['reset', 'clear', 'delete', 'wipe', 'erase'],
      run: ctx.resetAll,
    },
    {
      id: 'add-sample-data',
      title: 'Add sample data',
      subtitle: 'Insert a demo set of projects, containers, tasks, and labels',
      keywords: ['sample', 'seed', 'demo', 'example'],
      run: ctx.addSampleData,
    },
  ];

  for (const project of ctx.projects) {
    actions.push({
      id: `open-project-${project.id}`,
      title: `Open project: ${project.name}`,
      subtitle: 'Project',
      keywords: ['project', 'open', project.name.toLowerCase()],
      run: () => ctx.navigate({ kind: 'project', projectId: project.id }),
    });
  }

  return actions;
}

/**
 * Filters actions by matching every word of the query against title,
 * subtitle, and keywords (so "goto kanban" matches "Go to Kanban" even
 * though that exact phrase never appears in the haystack).
 */
export function searchActions(query: string, actions: ConsoleAction[]): ConsoleAction[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return actions;
  return actions.filter((action) => {
    const haystack = [action.title, action.subtitle ?? '', ...action.keywords].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
