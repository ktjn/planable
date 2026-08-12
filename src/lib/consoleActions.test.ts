import { describe, it, expect, vi } from 'vitest';
import { buildConsoleActions, searchActions } from './consoleActions';

function makeCtx() {
  return {
    navigate: vi.fn(),
    toggleTheme: vi.fn(),
    resetAll: vi.fn(async () => {}),
    addSampleData: vi.fn(async () => {}),
    projects: [{ id: 'p1', name: 'Website Redesign' }],
  };
}

describe('buildConsoleActions', () => {
  it('includes fixed navigation, theme, reset, and sample data actions', () => {
    const actions = buildConsoleActions(makeCtx());
    const ids = actions.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'goto-weekly',
        'goto-kanban',
        'goto-all-tasks',
        'goto-all-containers',
        'goto-labels',
        'goto-search',
        'goto-settings',
        'toggle-theme',
        'reset-all',
        'add-sample-data',
      ]),
    );
  });

  it('adds one open-project action per project', () => {
    const actions = buildConsoleActions(makeCtx());
    const projectAction = actions.find((a) => a.id === 'open-project-p1');
    expect(projectAction?.title).toBe('Open project: Website Redesign');
    expect(projectAction?.invoke).toBe('open project website redesign');
  });

  it('gives every action a lowercase invoke phrase for Tab-completion', () => {
    const actions = buildConsoleActions(makeCtx());
    for (const action of actions) {
      expect(action.invoke).toBe(action.invoke.toLowerCase());
      expect(action.invoke.length).toBeGreaterThan(0);
    }
    expect(actions.find((a) => a.id === 'goto-kanban')?.invoke).toBe('goto kanban');
    expect(actions.find((a) => a.id === 'reset-all')?.invoke).toBe('reset');
  });

  it('running the reset-all action calls resetAll', async () => {
    const ctx = makeCtx();
    const actions = buildConsoleActions(ctx);
    await actions.find((a) => a.id === 'reset-all')!.run();
    expect(ctx.resetAll).toHaveBeenCalledTimes(1);
  });

  it('running a goto action calls navigate with the right view', () => {
    const ctx = makeCtx();
    const actions = buildConsoleActions(ctx);
    actions.find((a) => a.id === 'goto-kanban')!.run();
    expect(ctx.navigate).toHaveBeenCalledWith({ kind: 'kanban' });
  });

  it('running an open-project action navigates to that project', () => {
    const ctx = makeCtx();
    const actions = buildConsoleActions(ctx);
    actions.find((a) => a.id === 'open-project-p1')!.run();
    expect(ctx.navigate).toHaveBeenCalledWith({ kind: 'project', projectId: 'p1' });
  });
});

describe('searchActions', () => {
  it('returns every action for a blank query', () => {
    const actions = buildConsoleActions(makeCtx());
    expect(searchActions('', actions)).toHaveLength(actions.length);
    expect(searchActions('   ', actions)).toHaveLength(actions.length);
  });

  it('matches by title', () => {
    const actions = buildConsoleActions(makeCtx());
    const results = searchActions('kanban', actions);
    expect(results.map((a) => a.id)).toEqual(['goto-kanban']);
  });

  it('matches by keyword even when not in the title', () => {
    const actions = buildConsoleActions(makeCtx());
    const results = searchActions('wipe', actions);
    expect(results.map((a) => a.id)).toEqual(['reset-all']);
  });

  it('matches project actions by project name', () => {
    const actions = buildConsoleActions(makeCtx());
    const results = searchActions('website', actions);
    expect(results.map((a) => a.id)).toEqual(['open-project-p1']);
  });

  it('matches a multi-word query by requiring every word, not the exact phrase', () => {
    const actions = buildConsoleActions(makeCtx());
    const results = searchActions('goto kanban', actions);
    expect(results.map((a) => a.id)).toEqual(['goto-kanban']);
  });
});
