import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { updateContainer, deleteContainer, setContainerArchived } from '../../db/repositories/containers';
import { listLabels } from '../../db/repositories/labels';
import { INBOX_CONTAINER_ID } from '../../db/inbox';
import type { Container } from '../../db/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export function ContainerDialog({
  container,
  onClose,
}: {
  container: Container;
  onClose: () => void;
}) {
  const [name, setName] = useState(container.name);
  const [labels, setLabels] = useState<string[]>(container.labels ?? []);
  const allLabels = useLiveQuery(listLabels, [], []);

  async function save() {
    if (!name.trim()) return;
    await updateContainer(container.id, { name: name.trim(), labels });
    onClose();
  }

  const isInbox = container.id === INBOX_CONTAINER_ID;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit container</DialogTitle>
          <DialogDescription>Update the container's details.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="container-name">Name</Label>
            <Input
              id="container-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Container name"
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Labels</legend>
            <div className="flex flex-wrap gap-2">
              {allLabels.map((label) => (
                <label key={label.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="size-4 rounded border"
                    checked={labels.includes(label.id)}
                    onChange={(e) =>
                      setLabels((prev) =>
                        e.target.checked ? [...prev, label.id] : prev.filter((l) => l !== label.id),
                      )
                    }
                  />
                  {label.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <DialogFooter>
          <div className="mr-auto flex items-center gap-2">
            {!isInbox && container.archived && (
              <Button
                variant="outline"
                className="text-muted-foreground"
                onClick={async () => {
                  await setContainerArchived(container.id, false);
                  onClose();
                }}
              >
                Unarchive
              </Button>
            )}
            {!isInbox && !container.archived && (
              <Button
                variant="outline"
                className="text-muted-foreground"
                onClick={async () => {
                  await setContainerArchived(container.id, true);
                  onClose();
                }}
              >
                Archive
              </Button>
            )}
            {!isInbox && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  await deleteContainer(container.id);
                  onClose();
                }}
              >
                Delete
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
