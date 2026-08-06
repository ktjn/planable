import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listLabels, createLabel, updateLabel, deleteLabel } from '../../db/repositories/labels';

export function LabelManager() {
  const labels = useLiveQuery(listLabels, [], []);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          className="border border-gray-300 px-2 py-1"
          placeholder="Label name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button
          onClick={async () => {
            if (!name.trim()) return;
            await createLabel(name.trim(), color);
            setName('');
          }}
        >
          Add label
        </button>
      </div>
      <ul>
        {labels.map((label) => (
          <li key={label.id} className="flex items-center gap-2 py-1">
            <span style={{ backgroundColor: label.color }} className="inline-block h-3 w-3 rounded-full" />
            <span>{label.name}</span>
            <input
              defaultValue={label.name}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== label.name) {
                  void updateLabel(label.id, { name: e.target.value.trim() });
                }
              }}
            />
            <button onClick={() => void deleteLabel(label.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
