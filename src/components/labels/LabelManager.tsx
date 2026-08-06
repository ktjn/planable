import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2 } from 'lucide-react';
import { listLabels, createLabel, updateLabel, deleteLabel } from '../../db/repositories/labels';
import { fireAndForget } from '../../lib/fireAndForget';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';

export function LabelManager() {
  const labels = useLiveQuery(listLabels, [], []);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');

  return (
    <div className="max-w-xl">
      <h2 className="mb-4 text-lg font-medium">Labels</h2>
      <div className="mb-4 flex items-center gap-2">
        <Input
          className="w-48"
          placeholder="Label name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              void createLabel(name.trim(), color).then(() => setName(''));
            }
          }}
        />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
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
          <li key={label.id} className="flex items-center gap-1">
            <Badge variant="secondary" className="gap-1">
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
