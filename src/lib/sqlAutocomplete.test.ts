import { describe, it, expect } from 'vitest';
import { suggestSqlCompletion } from './sqlAutocomplete';
import type { Label, Project } from '../db/schema';

const labels: Label[] = [
  { id: 'l1', name: 'Bug', color: '#ef4444' },
  { id: 'l2', name: 'Feature', color: '#3b82f6' },
];
const projects: Project[] = [
  { id: 'p1', name: 'Website Redesign', order: 0 },
  { id: 'p2', name: 'Mobile App', order: 1 },
];
const data = { labels, projects };

describe('suggestSqlCompletion', () => {
  it('suggests nothing until a token boundary (space) is reached', () => {
    // No trailing space yet, so there's no "next token" slot to complete into.
    expect(suggestSqlCompletion('SELECT', data)).toBeNull();
    // '*' is already an exact, complete token — nothing left to complete.
    expect(suggestSqlCompletion('SELECT *', data)).toBeNull();
  });

  it('completes FROM after SELECT *', () => {
    expect(suggestSqlCompletion('SELECT * F', data)).toBe('SELECT * FROM ');
  });

  it('completes a table name after FROM, preferring the plural form', () => {
    expect(suggestSqlCompletion('SELECT * FROM t', data)).toBe('SELECT * FROM tasks ');
    expect(suggestSqlCompletion('SELECT * FROM con', data)).toBe('SELECT * FROM containers ');
  });

  it('completes WHERE after a table name', () => {
    expect(suggestSqlCompletion('SELECT * FROM tasks W', data)).toBe('SELECT * FROM tasks WHERE ');
  });

  it('completes a WHERE field name scoped to the table', () => {
    expect(suggestSqlCompletion('SELECT * FROM tasks WHERE l', data)).toBe('SELECT * FROM tasks WHERE label ');
    expect(suggestSqlCompletion('SELECT * FROM containers WHERE s', data)).toBe(
      'SELECT * FROM containers WHERE status ',
    );
  });

  it('does not suggest a field the table does not support', () => {
    // "status" is container-only; tasks have no field starting with "stat".
    expect(suggestSqlCompletion('SELECT * FROM tasks WHERE stat', data)).toBeNull();
  });

  it('completes an operator after a field name', () => {
    expect(suggestSqlCompletion('SELECT * FROM tasks WHERE label L', data)).toBe(
      'SELECT * FROM tasks WHERE label LIKE ',
    );
  });

  it('completes a label value from live data, even before typing anything', () => {
    expect(suggestSqlCompletion('SELECT * FROM tasks WHERE label = ', data)).toBe(
      'SELECT * FROM tasks WHERE label = bug ',
    );
    expect(suggestSqlCompletion('SELECT * FROM tasks WHERE label = f', data)).toBe(
      'SELECT * FROM tasks WHERE label = feature ',
    );
  });

  it('completes a status value', () => {
    expect(suggestSqlCompletion('SELECT * FROM containers WHERE status = do', data)).toBe(
      'SELECT * FROM containers WHERE status = doing ',
    );
  });

  it('completes a day value', () => {
    expect(suggestSqlCompletion('SELECT * FROM tasks WHERE day = t', data)).toBe(
      'SELECT * FROM tasks WHERE day = tue ',
    );
  });

  it('completes a boolean value', () => {
    expect(suggestSqlCompletion('SELECT * FROM tasks WHERE archived = t', data)).toBe(
      'SELECT * FROM tasks WHERE archived = true ',
    );
  });

  it('completes AND after a complete condition', () => {
    expect(suggestSqlCompletion("SELECT * FROM tasks WHERE label = bug A", data)).toBe(
      "SELECT * FROM tasks WHERE label = bug AND ",
    );
  });

  it('completes a second field after AND', () => {
    expect(suggestSqlCompletion("SELECT * FROM tasks WHERE label = bug AND d", data)).toBe(
      "SELECT * FROM tasks WHERE label = bug AND day ",
    );
  });

  it('offers OR as well as AND after a complete condition', () => {
    expect(suggestSqlCompletion("SELECT * FROM tasks WHERE label = bug O", data)).toBe(
      "SELECT * FROM tasks WHERE label = bug OR ",
    );
  });

  it('completes a second field after OR', () => {
    expect(suggestSqlCompletion("SELECT * FROM tasks WHERE label = bug OR d", data)).toBe(
      "SELECT * FROM tasks WHERE label = bug OR day ",
    );
  });

  it('stops suggesting once a WHERE clause contains parens (parser still accepts them typed out)', () => {
    expect(suggestSqlCompletion("SELECT * FROM tasks WHERE (label = bug OR label = urgent) AND d", data)).toBeNull();
  });

  it('completes a project value with a multi-word name', () => {
    expect(suggestSqlCompletion('SELECT * FROM tasks WHERE project = web', data)).toBe(
      'SELECT * FROM tasks WHERE project = website redesign ',
    );
  });

  it('completes a table name and SET keyword for UPDATE', () => {
    expect(suggestSqlCompletion('UPDATE t', data)).toBe('UPDATE tasks ');
    expect(suggestSqlCompletion('UPDATE tasks S', data)).toBe('UPDATE tasks SET ');
  });

  it('completes SET field names', () => {
    expect(suggestSqlCompletion('UPDATE tasks SET c', data)).toBe('UPDATE tasks SET completed ');
    expect(suggestSqlCompletion('UPDATE tasks SET l', data)).toBe('UPDATE tasks SET label ');
  });

  it('completes label assignment operators (+=/-=), not plain =', () => {
    expect(suggestSqlCompletion('UPDATE tasks SET label +', data)).toBe('UPDATE tasks SET label += ');
  });

  it('suggests nothing for a plain SET field with no space yet (still mid-word) or a bare = (already complete, single char)', () => {
    // "completed" could still be extending toward something else; no boundary reached yet.
    expect(suggestSqlCompletion('UPDATE tasks SET completed', data)).toBeNull();
    // Once a space is typed, the operator slot is reached but nothing is typed into
    // it yet — and "=" has no shorter non-empty prefix to complete from anyway.
    expect(suggestSqlCompletion('UPDATE tasks SET completed ', data)).toBeNull();
  });

  it('completes a SET value', () => {
    expect(suggestSqlCompletion('UPDATE tasks SET completed = t', data)).toBe(
      'UPDATE tasks SET completed = true ',
    );
    expect(suggestSqlCompletion('UPDATE tasks SET label += b', data)).toBe(
      'UPDATE tasks SET label += bug ',
    );
  });

  it('completes WHERE after a complete SET assignment', () => {
    expect(suggestSqlCompletion('UPDATE tasks SET completed = true W', data)).toBe(
      'UPDATE tasks SET completed = true WHERE ',
    );
  });

  it('completes a WHERE field after SET, scoped to the table', () => {
    expect(suggestSqlCompletion('UPDATE tasks SET completed = true WHERE l', data)).toBe(
      'UPDATE tasks SET completed = true WHERE label ',
    );
  });

  it('completes FROM and table name for DELETE, then WHERE', () => {
    expect(suggestSqlCompletion('DELETE F', data)).toBe('DELETE FROM ');
    expect(suggestSqlCompletion('DELETE FROM l', data)).toBe('DELETE FROM labels ');
    expect(suggestSqlCompletion('DELETE FROM tasks W', data)).toBe('DELETE FROM tasks WHERE ');
  });

  it('completes a WHERE field for DELETE, scoped to the table', () => {
    expect(suggestSqlCompletion('DELETE FROM labels WHERE c', data)).toBe('DELETE FROM labels WHERE color ');
  });

  it('completes TRANSACTION after BEGIN', () => {
    expect(suggestSqlCompletion('BEGIN T', data)).toBe('BEGIN TRANSACTION ');
  });

  it('suggests nothing for COMMIT or ROLLBACK (no further tokens)', () => {
    expect(suggestSqlCompletion('COMMIT', data)).toBeNull();
    expect(suggestSqlCompletion('ROLLBACK', data)).toBeNull();
  });

  it('returns null for an empty query', () => {
    expect(suggestSqlCompletion('', data)).toBeNull();
  });

  describe('inside a quoted multi-word value', () => {
    it('completes a multi-word project name and closes the quote', () => {
      expect(suggestSqlCompletion("SELECT * FROM tasks WHERE project = 'web", data)).toBe(
        "SELECT * FROM tasks WHERE project = 'website redesign' ",
      );
    });

    it('works with double quotes too', () => {
      expect(suggestSqlCompletion('SELECT * FROM tasks WHERE project = "web', data)).toBe(
        'SELECT * FROM tasks WHERE project = "website redesign" ',
      );
    });

    it('preserves the case the user already typed inside the quote', () => {
      expect(suggestSqlCompletion("SELECT * FROM tasks WHERE project = 'Web", data)).toBe(
        "SELECT * FROM tasks WHERE project = 'Website redesign' ",
      );
    });

    it('completes a quoted label value in a SET clause', () => {
      expect(suggestSqlCompletion("UPDATE tasks SET label += 'b", data)).toBe(
        "UPDATE tasks SET label += 'bug' ",
      );
    });

    it('suggests the first candidate with nothing typed inside the quote yet', () => {
      expect(suggestSqlCompletion("SELECT * FROM tasks WHERE project = '", data)).toBe(
        "SELECT * FROM tasks WHERE project = 'website redesign' ",
      );
    });

    it('returns null when nothing inside the quote matches', () => {
      expect(suggestSqlCompletion("SELECT * FROM tasks WHERE project = 'zzz", data)).toBeNull();
    });

    it('returns null once the quote is closed (back to plain token completion)', () => {
      expect(suggestSqlCompletion("SELECT * FROM tasks WHERE project = 'Website Redesign'", data)).toBeNull();
    });
  });
});
