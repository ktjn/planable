import { describe, it, expect } from 'vitest';
import { looksLikeSql, parseSqlStatement } from './sqlLanguage';

describe('looksLikeSql', () => {
  it('recognizes the six supported keywords, case-insensitively, and ignores everything else', () => {
    for (const kw of ['select', 'SELECT', 'Update', 'delete', 'BEGIN', 'Commit', 'rollback']) {
      expect(looksLikeSql(`${kw} whatever`)).toBe(true);
    }
    expect(looksLikeSql('task label:bug')).toBe(false);
    expect(looksLikeSql('> reset')).toBe(false);
    expect(looksLikeSql('')).toBe(false);
  });
});

describe('parseSqlStatement', () => {
  it('returns null for non-SQL input so the caller can fall through', () => {
    expect(parseSqlStatement('task label:bug')).toBeNull();
    expect(parseSqlStatement('> reset')).toBeNull();
  });

  it('parses SELECT * FROM <table>', () => {
    expect(parseSqlStatement('SELECT * FROM tasks')).toEqual({ type: 'select', table: 'task', where: null });
    expect(parseSqlStatement('select * from task')).toEqual({ type: 'select', table: 'task', where: null });
  });

  it('parses SELECT with a WHERE clause, lowercasing the field', () => {
    const parsed = parseSqlStatement("SELECT * FROM tasks WHERE label = 'bug'");
    expect(parsed).toEqual({
      type: 'select',
      table: 'task',
      where: { conditions: [{ field: 'label', op: '=', value: 'bug' }] },
    });
  });

  it('parses AND-combined conditions', () => {
    const parsed = parseSqlStatement("SELECT * FROM tasks WHERE label = 'bug' AND day = mon");
    expect(parsed).toEqual({
      type: 'select',
      table: 'task',
      where: {
        conditions: [
          { field: 'label', op: '=', value: 'bug' },
          { field: 'day', op: '=', value: 'mon' },
        ],
      },
    });
  });

  it('parses != and LIKE operators', () => {
    expect(parseSqlStatement("SELECT * FROM tasks WHERE archived != true")).toEqual({
      type: 'select',
      table: 'task',
      where: { conditions: [{ field: 'archived', op: '!=', value: 'true' }] },
    });
    expect(parseSqlStatement("SELECT * FROM tasks WHERE title LIKE '%nav%'")).toEqual({
      type: 'select',
      table: 'task',
      where: { conditions: [{ field: 'title', op: 'LIKE', value: '%nav%' }] },
    });
  });

  it('rejects an unknown table', () => {
    expect(parseSqlStatement('SELECT * FROM widgets')).toEqual({
      error: expect.stringContaining('Unknown table'),
    });
  });

  it('requires * after SELECT and FROM after the table list', () => {
    expect(parseSqlStatement('SELECT title FROM tasks')).toEqual({ error: expect.stringContaining('*') });
    expect(parseSqlStatement('SELECT *')).toEqual({ error: expect.stringContaining('FROM') });
  });

  it('parses UPDATE with a single assignment', () => {
    const parsed = parseSqlStatement("UPDATE tasks SET completed = true WHERE label = 'bug'");
    expect(parsed).toEqual({
      type: 'update',
      table: 'task',
      assignments: [{ field: 'completed', op: '=', value: 'true' }],
      where: { conditions: [{ field: 'label', op: '=', value: 'bug' }] },
    });
  });

  it('parses UPDATE with multiple comma-separated assignments', () => {
    const parsed = parseSqlStatement("UPDATE containers SET status = doing, archived = false WHERE project = 'Web'");
    expect(parsed).toEqual({
      type: 'update',
      table: 'container',
      assignments: [
        { field: 'status', op: '=', value: 'doing' },
        { field: 'archived', op: '=', value: 'false' },
      ],
      where: { conditions: [{ field: 'project', op: '=', value: 'Web' }] },
    });
  });

  it('parses label += and label -= assignments', () => {
    expect(parseSqlStatement("UPDATE tasks SET label += urgent WHERE label = bug")).toEqual({
      type: 'update',
      table: 'task',
      assignments: [{ field: 'label', op: '+=', value: 'urgent' }],
      where: { conditions: [{ field: 'label', op: '=', value: 'bug' }] },
    });
    expect(parseSqlStatement("UPDATE tasks SET label -= urgent WHERE label = bug")).toMatchObject({
      assignments: [{ field: 'label', op: '-=', value: 'urgent' }],
    });
  });

  it('rejects label assignment without += or -=', () => {
    expect(parseSqlStatement('UPDATE tasks SET label = urgent WHERE archived = false')).toEqual({
      error: expect.stringContaining('+='),
    });
  });

  it('rejects an unsupported SET field', () => {
    expect(parseSqlStatement("UPDATE tasks SET title = 'Renamed' WHERE archived = false")).toEqual({
      error: expect.stringContaining('Unsupported SET field'),
    });
  });

  it('requires WHERE on UPDATE', () => {
    expect(parseSqlStatement('UPDATE tasks SET completed = true')).toEqual({
      error: expect.stringContaining('WHERE clause'),
    });
  });

  it('accepts WHERE 1=1 as an explicit match-everything clause', () => {
    expect(parseSqlStatement('UPDATE tasks SET completed = true WHERE 1=1')).toEqual({
      type: 'update',
      table: 'task',
      assignments: [{ field: 'completed', op: '=', value: 'true' }],
      where: { conditions: [{ field: '1', op: '=', value: '1' }] },
    });
  });

  it('parses DELETE FROM <table> WHERE ...', () => {
    expect(parseSqlStatement("DELETE FROM tasks WHERE archived = true")).toEqual({
      type: 'delete',
      table: 'task',
      where: { conditions: [{ field: 'archived', op: '=', value: 'true' }] },
    });
  });

  it('requires WHERE on DELETE', () => {
    expect(parseSqlStatement('DELETE FROM tasks')).toEqual({ error: expect.stringContaining('WHERE clause') });
  });

  it('parses BEGIN, BEGIN TRANSACTION, COMMIT, and ROLLBACK', () => {
    expect(parseSqlStatement('BEGIN')).toEqual({ type: 'begin' });
    expect(parseSqlStatement('begin transaction')).toEqual({ type: 'begin' });
    expect(parseSqlStatement('COMMIT')).toEqual({ type: 'commit' });
    expect(parseSqlStatement('rollback')).toEqual({ type: 'rollback' });
  });

  it('rejects trailing garbage after a complete statement', () => {
    expect(parseSqlStatement('BEGIN extra stuff')).toEqual({ error: expect.any(String) });
    expect(parseSqlStatement("SELECT * FROM tasks WHERE label = 'bug' extra")).toEqual({
      error: expect.any(String),
    });
  });
});
