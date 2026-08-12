import type { Label } from '../../db/schema';

export interface EntityLabelsProps<L extends Label> {
  labelIds: string[];
  labelsById: Map<string, L>;
  className?: string;
}

/**
 * Shared, compact presentation for Task and Container labels. Takes a
 * pre-built lookup map so views never issue one Dexie query per entity.
 * Unknown/deleted label IDs are ignored safely.
 */
export function EntityLabels<L extends Label>({
  labelIds,
  labelsById,
  className,
}: EntityLabelsProps<L>) {
  const labels = (labelIds ?? [])
    .map((id) => labelsById.get(id))
    .filter((l): l is L => l !== undefined);
  if (labels.length === 0) return null;

  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-1 ${className ?? ''}`}>
      {labels.map((label) => (
        <span
          key={label.id}
          className="inline-flex max-w-32 shrink-0 items-center gap-1 overflow-hidden rounded-full border px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground"
          style={{ borderColor: `color-mix(in oklab, ${label.color} 45%, transparent)` }}
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: label.color }}
          />
          <span className="truncate">{label.name}</span>
        </span>
      ))}
    </span>
  );
}
