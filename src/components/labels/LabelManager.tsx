import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Tags, Trash2 } from 'lucide-react';
import { listLabels, createLabel, updateLabel, deleteLabel } from '../../db/repositories/labels';
import { fireAndForget } from '../../lib/fireAndForget';
import { useScrollHighlight, type HighlightRequest } from '../../lib/useScrollHighlight';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';

export function LabelManager({ highlight }: { highlight?: HighlightRequest | null }) {
  const labels = useLiveQuery(listLabels, [], []);
  const highlighted = useScrollHighlight(highlight);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');

  return (
    <div className="max-w-xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Tags className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Labels</h2>
          <p className="text-sm text-muted-foreground">Color-coded tags applied to tasks</p>
        </div>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <Input
          className="w-44 flex-1"
          placeholder="Label name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              void createLabel(name.trim(), color).then(() => setName(''));
            }
          }}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Label color"
          className="h-8 w-10 cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
        />
        <Button
          onClick={async () => {
            if (!name.trim()) return;
            await createLabel(name.trim(), color);
            setName('');
          }}
        >
          <Plus />
          Add label
        </Button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {labels.map((label) => (
          <li key={label.id} id={`label-${label.id}`} className="flex items-center gap-1">
            <Badge
              variant="secondary"
              className={`gap-1 ${
                highlighted === `label-${label.id}` ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
              }`}
            >
              <span
                style={{ backgroundColor: label.color }}
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              />
              <input
                defaultValue={label.name}
                className="w-24 bg-transparent text-xs outline-none"
                aria-label={`Rename ${label.name}`}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== label.name) {
                    fireAndForget(updateLabel(label.id, { name: e.target.value.trim() }));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
            </Badge>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Delete ${label.name}`}
              onClick={() => fireAndForget(deleteLabel(label.id))}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
