import { db } from '../db';
import type { Label } from '../schema';

export async function listLabels(): Promise<Label[]> {
  return db.labels.orderBy('name').toArray();
}

export async function createLabel(name: string, color: string): Promise<Label> {
  const label: Label = { id: crypto.randomUUID(), name, color };
  await db.labels.add(label);
  return label;
}

export async function updateLabel(
  id: string,
  changes: Partial<Pick<Label, 'name' | 'color'>>,
): Promise<void> {
  await db.labels.update(id, changes);
}

export async function deleteLabel(id: string): Promise<void> {
  await db.transaction('rw', db.labels, db.tasks, async () => {
    await db.labels.delete(id);
    const affected = await db.tasks.filter((t) => t.labels.includes(id)).toArray();
    await Promise.all(
      affected.map((t) =>
        db.tasks.update(t.id, { labels: t.labels.filter((l) => l !== id) }),
      ),
    );
  });
}
