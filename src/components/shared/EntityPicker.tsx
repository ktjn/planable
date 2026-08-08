import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';

export interface EntityPickerEntity {
  id: string;
  title: string;
  subtitle?: string;
}

export function EntityPicker({
  open,
  onOpenChange,
  title,
  placeholder,
  entities,
  onSelect,
  emptyMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  entities: EntityPickerEntity[];
  onSelect: (id: string) => void;
  emptyMessage: string;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q.length === 0
        ? entities
        : entities.filter(
            (e) =>
              e.title.toLowerCase().includes(q) ||
              e.subtitle?.toLowerCase().includes(q),
          ),
    [entities, q],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {filtered.map((entity) => (
            <li key={entity.id}>
              <button
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/40"
                onClick={() => onSelect(entity.id)}
              >
                <span className="truncate">{entity.title}</span>
                {entity.subtitle && (
                  <span className="shrink-0 text-xs text-muted-foreground">{entity.subtitle}</span>
                )}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {q.length === 0 ? 'Nothing to select.' : emptyMessage}
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
