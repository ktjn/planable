import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Archive,
  ArchiveRestore,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  Folder,
  Layers,
  ListChecks,
  RotateCcw,
  Sparkles,
  SquareTerminal,
  Tag,
  Tags,
  Undo2,
  X,
} from 'lucide-react';
import { db } from '../../db/db';
import { listProjects } from '../../db/repositories/projects';
import { listLabels } from '../../db/repositories/labels';
import { parseConsoleQuery } from '../../lib/consoleQuery';
import { searchItems, type ConsoleItemResult } from '../../lib/consoleSearch';
import { buildConsoleActions, searchActions, type ConsoleAction } from '../../lib/consoleActions';
import { suggestCompletion } from '../../lib/consoleAutocomplete';
import { applyBatchOperation, type BatchOperation } from '../../lib/consoleBatch';
import { addSampleData } from '../../lib/sampleData';
import { resetAllData } from '../../lib/resetAllData';
import { useTheme } from '../../lib/use-theme';
import { fireAndForget } from '../../lib/fireAndForget';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { ActiveView } from '../layout/NavTabs';
import type { KanbanStatus, Label } from '../../db/schema';

type ConsoleResult = { type: 'action'; action: ConsoleAction } | { type: 'item'; item: ConsoleItemResult };

const KIND_ICON = {
  task: ListChecks,
  container: Layers,
  project: Folder,
  label: Tags,
} as const;

/**
 * A foldable, bottom-anchored command console. Plain queries search tasks,
 * containers, projects, and labels (see docs/decisions.md for the query
 * language); queries starting with `>` run actions such as navigation, theme
 * toggling, resetting all data, or seeding sample data.
 */
export function ConsolePanel({
  onNavigate,
}: {
  onNavigate: (view: ActiveView, highlightId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorAtEnd, setCursorAtEnd] = useState(true);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const { toggle: toggleTheme } = useTheme();

  const tasks = useLiveQuery(() => db.tasks.toArray(), [], []);
  const containers = useLiveQuery(() => db.containers.toArray(), [], []);
  const projects = useLiveQuery(listProjects, [], []);
  const labels = useLiveQuery(listLabels, [], []);

  async function handleReset() {
    if (
      !window.confirm('Reset will permanently delete all projects, containers, tasks, and labels. Continue?')
    ) {
      return;
    }
    await resetAllData();
  }

  async function handleSeed() {
    await addSampleData();
  }

  const actions = useMemo(
    () =>
      buildConsoleActions({
        navigate: onNavigate,
        toggleTheme,
        resetAll: handleReset,
        addSampleData: handleSeed,
        projects: (projects ?? []).map((p) => ({ id: p.id, name: p.name })),
      }),
    // handleReset/handleSeed are stable function declarations; only these three change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, toggleTheme, onNavigate],
  );

  const parsedQuery = useMemo(() => parseConsoleQuery(query), [query]);
  const isItemsMode = parsedQuery.kind === 'items';

  const results = useMemo<ConsoleResult[]>(() => {
    if (parsedQuery.kind === 'action') {
      return searchActions(parsedQuery.text, actions).map((action) => ({ type: 'action' as const, action }));
    }
    if (!query.trim()) return [];
    return searchItems(parsedQuery, {
      tasks: tasks ?? [],
      containers: containers ?? [],
      projects: projects ?? [],
      labels: labels ?? [],
    }).map((item) => ({ type: 'item' as const, item }));
  }, [parsedQuery, query, actions, tasks, containers, projects, labels]);

  const itemResults = useMemo(
    () => results.filter((r): r is { type: 'item'; item: ConsoleItemResult } => r.type === 'item').map((r) => r.item),
    [results],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, query]);

  useEffect(() => {
    setCheckedKeys(new Set());
  }, [query]);

  const ghostSuggestion = useMemo(
    () =>
      suggestCompletion(query, {
        labels: labels ?? [],
        projects: projects ?? [],
        actions,
      }),
    [query, labels, projects, actions],
  );
  const ghostSuffix =
    cursorAtEnd && ghostSuggestion && ghostSuggestion.startsWith(query) ? ghostSuggestion.slice(query.length) : '';

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      const ctrlPressed = e.ctrlKey || e.metaKey;
      if (!ctrlPressed || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      setOpen((current) => {
        const next = !current;
        if (next) requestAnimationFrame(() => inputRef.current?.focus());
        return next;
      });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function closeAndClear() {
    setQuery('');
    setOpen(false);
    setCheckedKeys(new Set());
  }

  function toggleChecked(key: string) {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAll() {
    setCheckedKeys((prev) => {
      const allChecked = itemResults.length > 0 && itemResults.every((r) => prev.has(r.key));
      return allChecked ? new Set() : new Set(itemResults.map((r) => r.key));
    });
  }

  async function runBatch(operation: BatchOperation) {
    const selected = itemResults.filter((r) => checkedKeys.has(r.key));
    if (selected.length === 0) return;
    await applyBatchOperation(selected, operation, { tasks: tasks ?? [], containers: containers ?? [] });
    setCheckedKeys(new Set());
  }

  function updateCursorAtEnd(el: HTMLInputElement) {
    setCursorAtEnd(el.selectionStart === el.value.length && el.selectionEnd === el.value.length);
  }

  function acceptGhostSuggestion() {
    if (!ghostSuffix) return false;
    const completed = query + ghostSuffix;
    setQuery(completed);
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(completed.length, completed.length);
    });
    return true;
  }

  function handleExpand() {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function selectResult(result: ConsoleResult) {
    if (result.type === 'action') {
      fireAndForget(Promise.resolve(result.action.run()));
    } else {
      onNavigate(result.item.navigate, result.item.highlightId);
    }
    closeAndClear();
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab' && ghostSuffix) {
      e.preventDefault();
      acceptGhostSuggestion();
    } else if (e.key === 'ArrowRight' && ghostSuffix) {
      e.preventDefault();
      acceptGhostSuggestion();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = results[selectedIndex];
      if (current) selectResult(current);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeAndClear();
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 px-4 py-2 md:px-6">
        <SquareTerminal className="size-4 shrink-0 text-muted-foreground" />
        {open ? (
          <div className="relative min-w-0 flex-1">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center overflow-hidden font-mono text-sm whitespace-pre"
            >
              <span className="invisible">{query}</span>
              <span className="text-muted-foreground/60">{ghostSuffix}</span>
            </div>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                updateCursorAtEnd(e.target);
              }}
              onKeyDown={handleInputKeyDown}
              onClick={(e) => updateCursorAtEnd(e.currentTarget)}
              onKeyUp={(e) => updateCursorAtEnd(e.currentTarget)}
              onSelect={(e) => updateCursorAtEnd(e.currentTarget)}
              placeholder='Query items (e.g. task label:bug day:mon) or run "> " actions…'
              aria-label="Console query"
              className="relative h-7 w-full bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleExpand}
            className="flex-1 truncate text-left text-sm text-muted-foreground hover:text-foreground"
          >
            Console — press{' '}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">Ctrl</kbd>+
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">K</kbd> to query
            actions and items
          </button>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          {open && (
            <>
              <Button variant="outline" size="sm" onClick={() => fireAndForget(handleReset())}>
                <RotateCcw />
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={() => fireAndForget(handleSeed())}>
                <Sparkles />
                Sample data
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={open ? 'Fold console' : 'Expand console'}
            aria-expanded={open}
            onClick={() => (open ? closeAndClear() : handleExpand())}
          >
            {open ? <ChevronDown /> : <ChevronUp />}
          </Button>
        </div>
      </div>
      {open && (
        <div className="mx-auto w-full max-w-[1440px] animate-in fade-in-0 slide-in-from-bottom-2 px-4 pb-3 duration-150 md:px-6">
          <p className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <span>Filters:</span>
            {['label:', 'status:', 'day:', 'project:', 'done:', 'archived:', 'repeat:'].map((f) => (
              <code key={f} className="rounded bg-muted px-1">
                {f}
              </code>
            ))}
            <span>· negate with</span>
            <code className="rounded bg-muted px-1">-</code>
            <span>· actions start with</span>
            <code className="rounded bg-muted px-1">&gt;</code>
            <span>
              · <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">Tab</kbd> to
              autocomplete
            </span>
          </p>
          {isItemsMode && itemResults.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1.5">
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  aria-label="Select all results"
                  checked={itemResults.every((r) => checkedKeys.has(r.key))}
                  onChange={toggleSelectAll}
                  className="size-3.5"
                />
                <span className="text-muted-foreground">
                  {checkedKeys.size > 0 ? `${checkedKeys.size} selected` : `Select all ${itemResults.length}`}
                </span>
              </label>
              {checkedKeys.size > 0 && (
                <BatchActionBar
                  selectedItems={itemResults.filter((r) => checkedKeys.has(r.key))}
                  labels={labels ?? []}
                  onApply={(operation) => fireAndForget(runBatch(operation))}
                />
              )}
            </div>
          )}
          <ul
            role="listbox"
            aria-label="Console results"
            className="max-h-72 overflow-y-auto rounded-xl border border-border bg-card shadow-sm"
          >
            {results.map((result, index) => (
              <ResultRow
                key={resultKey(result)}
                result={result}
                selected={index === selectedIndex}
                checked={result.type === 'item' && checkedKeys.has(result.item.key)}
                onClick={() => selectResult(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                onToggleChecked={result.type === 'item' ? () => toggleChecked(result.item.key) : undefined}
              />
            ))}
            {results.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                {query.trim() ? 'No matches.' : 'Type to query items, or start with “>” to run an action.'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function resultKey(result: ConsoleResult): string {
  return result.type === 'action' ? `action-${result.action.id}` : result.item.key;
}

function ResultRow({
  result,
  selected,
  checked,
  onClick,
  onMouseEnter,
  onToggleChecked,
}: {
  result: ConsoleResult;
  selected: boolean;
  checked: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onToggleChecked?: () => void;
}) {
  const Icon = result.type === 'action' ? SquareTerminal : KIND_ICON[result.item.kind];
  const title = result.type === 'action' ? result.action.title : result.item.title;
  const subtitle = result.type === 'action' ? result.action.subtitle : result.item.subtitle;
  const badges = result.type === 'item' ? result.item.badges : [];

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
          selected ? 'bg-accent/60 text-accent-foreground' : 'hover:bg-accent/30'
        }`}
      >
        {onToggleChecked && (
          <input
            type="checkbox"
            aria-label={`Select ${title}`}
            checked={checked}
            onChange={onToggleChecked}
            onClick={(e) => e.stopPropagation()}
            className="size-3.5 shrink-0"
          />
        )}
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {subtitle && <span className="shrink-0 truncate text-xs text-muted-foreground">{subtitle}</span>}
        {badges.map((badge) => (
          <Badge key={badge} variant="secondary" className="hidden shrink-0 sm:inline-flex">
            {badge}
          </Badge>
        ))}
        {selected && <CornerDownLeft className="size-3 shrink-0 text-muted-foreground" />}
      </button>
    </li>
  );
}

const KANBAN_STATUSES: KanbanStatus[] = ['Todo', 'Doing', 'Blocked', 'Done'];

/** Bulk-action toolbar shown once at least one console result is checked. */
function BatchActionBar({
  selectedItems,
  labels,
  onApply,
}: {
  selectedItems: ConsoleItemResult[];
  labels: Label[];
  onApply: (operation: BatchOperation) => void;
}) {
  const [labelId, setLabelId] = useState('');
  const kinds = new Set(selectedItems.map((r) => r.kind));
  const hasTask = kinds.has('task');
  const hasContainer = kinds.has('container');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasTask && (
        <>
          <Button size="xs" variant="outline" onClick={() => onApply({ type: 'complete', value: true })}>
            <CheckCheck />
            Complete
          </Button>
          <Button size="xs" variant="outline" onClick={() => onApply({ type: 'complete', value: false })}>
            <Undo2 />
            Uncomplete
          </Button>
        </>
      )}
      {(hasTask || hasContainer) && (
        <>
          <Button size="xs" variant="outline" onClick={() => onApply({ type: 'archive', value: true })}>
            <Archive />
            Archive
          </Button>
          <Button size="xs" variant="outline" onClick={() => onApply({ type: 'archive', value: false })}>
            <ArchiveRestore />
            Unarchive
          </Button>
        </>
      )}
      {hasContainer && (
        <select
          aria-label="Set kanban status"
          defaultValue=""
          className="h-6 rounded-md border border-input bg-transparent px-1.5 text-xs"
          onChange={(e) => {
            const status = e.target.value as KanbanStatus | '';
            if (status) onApply({ type: 'kanbanStatus', status });
            e.target.value = '';
          }}
        >
          <option value="" disabled>
            Set status…
          </option>
          {KANBAN_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      )}
      {(hasTask || hasContainer) && labels.length > 0 && (
        <>
          <select
            aria-label="Label to add or remove"
            value={labelId}
            onChange={(e) => setLabelId(e.target.value)}
            className="h-6 rounded-md border border-input bg-transparent px-1.5 text-xs"
          >
            <option value="">Label…</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
          <Button
            size="xs"
            variant="outline"
            disabled={!labelId}
            onClick={() => labelId && onApply({ type: 'addLabel', labelId })}
          >
            <Tag />
            Add
          </Button>
          <Button
            size="xs"
            variant="outline"
            disabled={!labelId}
            onClick={() => labelId && onApply({ type: 'removeLabel', labelId })}
          >
            <X />
            Remove
          </Button>
        </>
      )}
    </div>
  );
}
