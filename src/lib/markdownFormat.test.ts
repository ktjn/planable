import { describe, it, expect } from 'vitest';
import formatDoc from '../../docs/markdown-format.md?raw';
import { parseMarkdown, serializeMarkdown, splitList, DEFAULT_LABEL_COLOR } from './markdownFormat';
import type { Container, Label, Project, Task } from '../db/schema';

function task(overrides: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    description: '',
    labels: [],
    projectId: 'p1',
    containerId: 'c1',
    order: 0,
    globalOrder: 0,
    completed: false,
    completedDate: null,
    archived: false,
    weekly: null,
    ...overrides,
  };
}

function container(overrides: Partial<Container> & Pick<Container, 'id' | 'name'>): Container {
  return {
    projectId: 'p1',
    order: 0,
    labels: [],
    archived: false,
    kanban: null,
    ...overrides,
  };
}

const project = (id: string, name: string, order: number): Project => ({ id, name, order });
const label = (id: string, name: string, color: string): Label => ({ id, name, color });

describe('splitList', () => {
  it('splits on commas, trims, and drops empties', () => {
    expect(splitList(' a , b,, c ')).toEqual(['a', 'b', 'c']);
  });

  it('honors \\, and \\\\ escapes', () => {
    expect(splitList('Needs\\, review, back\\\\slash')).toEqual(['Needs, review', 'back\\slash']);
  });
});

describe('documented example', () => {
  const match = /````markdown planable-example\n([\s\S]*?)\n````/.exec(formatDoc);

  it('is present in docs/markdown-format.md', () => {
    expect(match).not.toBeNull();
  });

  it('parses without warnings into the documented structure', () => {
    const doc = parseMarkdown(match![1]);
    expect(doc.warnings).toEqual([]);
    expect(doc.labels.map((l) => l.name)).toEqual(['Bug', 'Feature', 'Needs review']);
    expect(doc.projects.map((p) => p.name)).toEqual(['Inbox', 'Website Redesign']);

    const [inbox, website] = doc.projects;
    expect(inbox.containers.map((c) => [c.name, c.tasks.length])).toEqual([['Inbox', 1]]);
    expect(website.containers.map((c) => c.name)).toEqual(['Frontend', 'Legacy Marketing Site']);

    const [frontend, legacy] = website.containers;
    expect(frontend).toMatchObject({ labels: ['Bug', 'Feature'], kanban: 'Doing', archived: false });
    expect(legacy).toMatchObject({ archived: true, kanban: null });

    const [nav, ci, sync] = frontend.tasks;
    expect(nav).toMatchObject({
      title: 'Fix nav overlap on mobile',
      labels: ['Bug', 'Needs review'],
      week: { weekId: '2026-W43', day: 'Tue' },
      completed: false,
    });
    expect(nav.description).toBe(
      ['Reported by QA on iOS Safari.', '', 'Repro:', '', '```sh', 'open https://example.com/nav', '```'].join('\n'),
    );
    expect(ci).toMatchObject({
      title: 'Set up CI pipeline',
      completed: true,
      completedDate: Date.parse('2026-10-20T09:30:00.000Z'),
    });
    expect(sync).toMatchObject({ week: { weekId: '2026-W43', day: 'Fri' }, repeat: true });
    expect(legacy.tasks[0]).toMatchObject({ title: 'Retire old contact form', archived: true });
  });
});

describe('parseMarkdown structure', () => {
  it('puts a bare checklist in the Inbox project and container', () => {
    const doc = parseMarkdown('- [ ] One\n- [x] Two\n');
    expect(doc.warnings).toEqual([]);
    expect(doc.projects).toHaveLength(1);
    expect(doc.projects[0].name).toBe('Inbox');
    expect(doc.projects[0].containers[0].name).toBe('Inbox');
    expect(doc.projects[0].containers[0].tasks.map((t) => [t.title, t.completed])).toEqual([
      ['One', false],
      ['Two', true],
    ]);
  });

  it('puts tasks directly under a project heading into a General container', () => {
    const doc = parseMarkdown('# Alpha\n- [ ] One\n');
    expect(doc.projects[0].containers.map((c) => c.name)).toEqual(['General']);
  });

  it('puts a container heading without a project into the Inbox project', () => {
    const doc = parseMarkdown('## Backlog\n- [ ] One\n');
    expect(doc.projects[0].name).toBe('Inbox');
    expect(doc.projects[0].containers[0].name).toBe('Backlog');
  });

  it('treats checkbox-less bullets of any marker as open tasks', () => {
    const doc = parseMarkdown('- Dash\n* Star\n+ Plus\n');
    expect(doc.projects[0].containers[0].tasks.map((t) => [t.title, t.completed])).toEqual([
      ['Dash', false],
      ['Star', false],
      ['Plus', false],
    ]);
  });

  it('only reads container metadata before the first task', () => {
    const doc = parseMarkdown('# P\n## C\n- kanban: Done\n- [ ] A\n- kanban: Todo\n');
    const c = doc.projects[0].containers[0];
    expect(c.kanban).toBe('Done');
    expect(c.tasks.map((t) => t.title)).toEqual(['A', 'kanban: Todo']);
  });

  it('keeps a task whose title looks like a checkbox', () => {
    const doc = parseMarkdown('- [ ] [x] literal\n');
    expect(doc.projects[0].containers[0].tasks[0]).toMatchObject({ title: '[x] literal', completed: false });
  });

  it('strips closing hashes from headings but keeps inner ones', () => {
    const doc = parseMarkdown('# C# Tips ##\n## Plan #1 #\n');
    expect(doc.projects[0].name).toBe('C# Tips');
    expect(doc.projects[0].containers[0].name).toBe('Plan #1');
  });

  it('handles CRLF line endings and a BOM', () => {
    const doc = parseMarkdown('﻿# P\r\n## C\r\n- [ ] A\r\n  - labels: x\r\n\r\n  Desc\r\n');
    const t = doc.projects[0].containers[0].tasks[0];
    expect(doc.projects[0].name).toBe('P');
    expect(t).toMatchObject({ title: 'A', labels: ['x'], description: 'Desc' });
  });

  it('ignores top-level fenced code, comments, and rules without warnings', () => {
    const doc = parseMarkdown(
      '# P\n\n```\n# not a project\n- [ ] not a task\n```\n\n<!-- note -->\n\n---\n\n## C\n- [ ] Real\n',
    );
    expect(doc.warnings).toEqual([]);
    expect(doc.projects.map((p) => p.name)).toEqual(['P']);
    expect(doc.projects[0].containers[0].tasks.map((t) => t.title)).toEqual(['Real']);
  });

  it('returns an empty document for empty input', () => {
    expect(parseMarkdown('')).toEqual({ labels: [], projects: [], warnings: [] });
  });
});

describe('parseMarkdown task blocks', () => {
  it('reads an indented description directly under the title', () => {
    const doc = parseMarkdown('- [ ] A\n  First\n  Second\n- [ ] B\n');
    const [a, b] = doc.projects[0].containers[0].tasks;
    expect(a.description).toBe('First\nSecond');
    expect(b.description).toBe('');
  });

  it('keeps blank lines, headings, and fences inside a description', () => {
    const md = ['- [ ] A', '  - labels: x', '', '  ## Heading', '', '  ```', '  # code', '', '  more', '  ```', '- [ ] B'].join('\n');
    const [a, b] = parseMarkdown(md).projects[0].containers[0].tasks;
    expect(a.description).toBe(['## Heading', '', '```', '# code', '', 'more', '```'].join('\n'));
    expect(b.title).toBe('B');
  });

  it('treats metadata-looking lines after a blank line as description', () => {
    const md = '- [ ] A\n\n  - labels: not-metadata\n';
    const a = parseMarkdown(md).projects[0].containers[0].tasks[0];
    expect(a.labels).toEqual([]);
    expect(a.description).toBe('- labels: not-metadata');
  });

  it('treats unrecognized nested bullets as description', () => {
    const a = parseMarkdown('- [ ] A\n  - sub item\n').projects[0].containers[0].tasks[0];
    expect(a.description).toBe('- sub item');
  });

  it('accepts tab indentation', () => {
    const a = parseMarkdown('- [ ] A\n\t- labels: x\n\n\tDesc\n').projects[0].containers[0].tasks[0];
    expect(a).toMatchObject({ labels: ['x'], description: 'Desc' });
  });

  it('merges duplicate label entries case-insensitively', () => {
    const a = parseMarkdown('- [ ] A\n  - labels: Bug, bug\n  - labels: BUG, Urgent\n').projects[0]
      .containers[0].tasks[0];
    expect(a.labels).toEqual(['Bug', 'Urgent']);
  });

  it('parses week days case-insensitively, including long names', () => {
    const md = '- [ ] A\n  - week: 2026-W43 tuesday\n- [ ] B\n  - week: 2026-W44\n';
    const [a, b] = parseMarkdown(md).projects[0].containers[0].tasks;
    expect(a.week).toEqual({ weekId: '2026-W43', day: 'Tue' });
    expect(b.week).toEqual({ weekId: '2026-W44', day: 'Unplanned' });
  });

  it('parses repeat and archived flags', () => {
    const md = '- [ ] A\n  - repeat: weekly\n  - archived: yes\n- [ ] B\n  - repeat: false\n';
    const [a, b] = parseMarkdown(md).projects[0].containers[0].tasks;
    expect(a).toMatchObject({ repeat: true, archived: true });
    expect(b.repeat).toBe(false);
  });
});

describe('parseMarkdown warnings', () => {
  const warn = (md: string) => parseMarkdown(md).warnings;

  it('reports an invalid week and drops it', () => {
    const doc = parseMarkdown('- [ ] A\n  - week: soon\n');
    expect(doc.projects[0].containers[0].tasks[0].week).toBeNull();
    expect(doc.warnings).toEqual(['Line 2: invalid week "soon" ignored (expected e.g. 2026-W43 Tue).']);
  });

  it('rejects out-of-range week numbers', () => {
    expect(warn('- [ ] A\n  - week: 2026-W54 Mon\n')).toHaveLength(1);
    expect(warn('- [ ] A\n  - week: 2026-W00 Mon\n')).toHaveLength(1);
  });

  it('falls back to Unplanned for weekend days', () => {
    const doc = parseMarkdown('- [ ] A\n  - week: 2026-W43 Sat\n');
    expect(doc.projects[0].containers[0].tasks[0].week).toEqual({ weekId: '2026-W43', day: 'Unplanned' });
    expect(doc.warnings).toEqual(['Line 2: unknown day "Sat"; scheduled as Unplanned.']);
  });

  it('reports invalid repeat, completed, archived, and kanban values', () => {
    expect(warn('- [ ] A\n  - repeat: monthly\n')).toHaveLength(1);
    expect(warn('- [x] A\n  - completed: yesterday\n')).toHaveLength(1);
    expect(warn('- [ ] A\n  - archived: maybe\n')).toHaveLength(1);
    expect(warn('# P\n## C\n- kanban: Later\n')).toHaveLength(1);
    expect(warn('# P\n## C\n- archived: maybe\n')).toHaveLength(1);
  });

  it('reports ignored heading levels, empty headings, and empty tasks', () => {
    expect(warn('### Deep\n')).toEqual(['Line 1: heading level 3 is not used and was ignored.']);
    expect(warn('# \n')).toEqual(['Line 1: empty heading ignored.']);
    expect(warn('- [ ]\n')).toEqual(['Line 1: task without a title ignored.']);
  });

  it('summarizes free text outside tasks', () => {
    expect(warn('# P\nSome prose\nMore prose\n- [ ] A\n')).toEqual([
      '2 line(s) of text outside tasks were ignored (first at line 2).',
    ]);
  });

  it('warns about a newer format version', () => {
    const doc = parseMarkdown('---\nplanable: 9\n---\n- [ ] A\n');
    expect(doc.warnings[0]).toContain('newer than supported version 1');
    expect(doc.projects[0].containers[0].tasks).toHaveLength(1);
  });
});

describe('parseMarkdown front matter', () => {
  it('reads label definitions and validates colors', () => {
    const md = [
      '---',
      'planable: 1',
      'labels:',
      '  - {"name": "Bug", "color": "#ef4444"}',
      '  - {"name": "Odd", "color": "red; background: url(x)"}',
      '  - {"name": "NoColor"}',
      '  - {"color": "#000000"}',
      '  - not json',
      '---',
      '- [ ] A',
    ].join('\n');
    const doc = parseMarkdown(md);
    expect(doc.labels).toEqual([
      { name: 'Bug', color: '#ef4444' },
      { name: 'Odd', color: DEFAULT_LABEL_COLOR },
      { name: 'NoColor', color: DEFAULT_LABEL_COLOR },
    ]);
    expect(doc.warnings).toEqual([
      'Line 7: invalid label entry ignored.',
      'Line 8: unrecognized label entry ignored.',
    ]);
  });

  it('ignores a lone leading rule that has no closing delimiter', () => {
    const doc = parseMarkdown('---\n- [ ] A\n');
    expect(doc.projects[0].containers[0].tasks.map((t) => t.title)).toEqual(['A']);
  });
});

describe('serializeMarkdown', () => {
  const labels = [label('l1', 'Bug', '#ef4444'), label('l2', 'Needs, review', '#a855f7')];
  const data = {
    projects: [project('p1', 'Alpha', 0), project('inbox', 'Inbox', -1)],
    containers: [
      container({ id: 'c1', name: 'Backlog', labels: ['l1'], kanban: { status: 'Doing' } }),
    ],
    tasks: [
      task({
        id: 't1',
        title: 'Write docs',
        description: 'Line one\n\nLine two',
        labels: ['l1', 'l2'],
        order: 0,
        weekly: { weekId: '2026-W43', day: 'Tue', repeatWeekly: true, order: 0 },
      }),
      task({
        id: 't2',
        title: 'Ship it',
        order: 1,
        completed: true,
        completedDate: Date.UTC(2026, 9, 20, 9, 30),
      }),
    ],
    labels,
  };

  it('writes the documented layout', () => {
    expect(serializeMarkdown(data)).toBe(
      [
        '---',
        'planable: 1',
        'labels:',
        '  - {"name":"Bug","color":"#ef4444"}',
        '  - {"name":"Needs, review","color":"#a855f7"}',
        '---',
        '',
        '# Inbox',
        '',
        '# Alpha',
        '',
        '## Backlog',
        '- labels: Bug',
        '- kanban: Doing',
        '',
        '- [ ] Write docs',
        '  - labels: Bug, Needs\\, review',
        '  - week: 2026-W43 Tue',
        '  - repeat: weekly',
        '',
        '  Line one',
        '',
        '  Line two',
        '- [x] Ship it',
        '  - completed: 2026-10-20T09:30:00.000Z',
        '',
      ].join('\n'),
    );
  });

  it('omits the labels block when there are no labels', () => {
    expect(serializeMarkdown({ projects: [], containers: [], tasks: [], labels: [] })).toBe(
      '---\nplanable: 1\n---\n',
    );
  });

  it('sorts by order rather than input order', () => {
    const md = serializeMarkdown({
      projects: [project('p2', 'Second', 1), project('p1', 'First', 0)],
      containers: [
        container({ id: 'c2', projectId: 'p1', name: 'B', order: 1 }),
        container({ id: 'c1', projectId: 'p1', name: 'A', order: 0 }),
      ],
      tasks: [
        task({ id: 't2', title: 'two', containerId: 'c1', order: 1 }),
        task({ id: 't1', title: 'one', containerId: 'c1', order: 0 }),
      ],
      labels: [],
    });
    expect(md.indexOf('# First')).toBeLessThan(md.indexOf('# Second'));
    expect(md.indexOf('## A')).toBeLessThan(md.indexOf('## B'));
    expect(md.indexOf('one')).toBeLessThan(md.indexOf('two'));
  });

  it('puts orphaned containers and tasks under Inbox so nothing is dropped', () => {
    const md = serializeMarkdown({
      projects: [],
      containers: [container({ id: 'c9', projectId: 'gone', name: 'Lost' })],
      tasks: [
        task({ id: 't1', title: 'In lost', containerId: 'c9' }),
        task({ id: 't2', title: 'Nowhere', containerId: 'missing' }),
      ],
      labels: [],
    });
    const doc = parseMarkdown(md);
    expect(doc.projects.map((p) => p.name)).toEqual(['Inbox']);
    expect(doc.projects[0].containers.map((c) => [c.name, c.tasks.map((t) => t.title)])).toEqual([
      ['Lost', ['In lost']],
      ['Unfiled', ['Nowhere']],
    ]);
  });

  it('skips labels whose ids no longer exist', () => {
    const md = serializeMarkdown({
      projects: [project('p1', 'A', 0)],
      containers: [container({ id: 'c1', name: 'C' })],
      tasks: [task({ id: 't1', title: 'T', labels: ['gone'] })],
      labels: [],
    });
    expect(md).not.toContain('labels:');
  });
});

describe('serialize → parse round trip', () => {
  it('preserves content for awkward names, titles, and descriptions', () => {
    const labels = [
      label('l1', 'Needs, review', '#a855f7'),
      label('l2', 'back\\slash', '#111111'),
    ];
    const description = ['  indented start', '', '## looks like a heading', '- labels: looks like meta', '```', '# code', '```'].join('\n');
    const md = serializeMarkdown({
      projects: [project('p1', 'Tips #', 0)],
      containers: [container({ id: 'c1', name: 'Plan #1 ##', labels: ['l1', 'l2'] })],
      tasks: [
        task({ id: 't1', title: 'Line one\nline two', description, labels: ['l1'] }),
        task({ id: 't2', title: 'Second', description: 'labels: plain text', order: 1 }),
      ],
      labels,
    });

    const doc = parseMarkdown(md);
    expect(doc.warnings).toEqual([]);
    expect(doc.labels).toEqual([
      { name: 'Needs, review', color: '#a855f7' },
      { name: 'back\\slash', color: '#111111' },
    ]);
    expect(doc.projects[0].name).toBe('Tips #');
    const c = doc.projects[0].containers[0];
    expect(c.name).toBe('Plan #1 ##');
    expect(c.labels).toEqual(['Needs, review', 'back\\slash']);
    expect(c.tasks[0]).toMatchObject({ title: 'Line one line two', labels: ['Needs, review'] });
    expect(c.tasks[0].description).toBe(description);
    expect(c.tasks[1].description).toBe('labels: plain text');
    expect(c.tasks[1].labels).toEqual([]);
  });

  it('preserves flags, schedule, and completion', () => {
    const completedDate = Date.UTC(2026, 9, 21, 8, 15, 30, 123);
    const md = serializeMarkdown({
      projects: [project('p1', 'P', 0)],
      containers: [
        container({ id: 'c1', name: 'Done col', kanban: { status: 'Done' } }),
        container({ id: 'c2', name: 'Old', order: 1, archived: true }),
      ],
      tasks: [
        task({
          id: 't1',
          title: 'Finished',
          completed: true,
          completedDate,
          weekly: { weekId: '2026-W52', day: 'Fri', repeatWeekly: false, order: 3 },
        }),
        task({ id: 't2', title: 'Shelved', containerId: 'c2', archived: true }),
      ],
      labels: [],
    });
    const [done, old] = parseMarkdown(md).projects[0].containers;
    expect(done.kanban).toBe('Done');
    expect(done.tasks[0]).toMatchObject({
      completed: true,
      completedDate,
      week: { weekId: '2026-W52', day: 'Fri' },
      repeat: false,
    });
    expect(old).toMatchObject({ archived: true, kanban: null });
    expect(old.tasks[0].archived).toBe(true);
  });
});
