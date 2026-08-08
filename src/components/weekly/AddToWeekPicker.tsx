import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addToWeek } from '../../db/repositories/taskMembership';
import { getCurrentWeekId } from '../../lib/week';
import { SETTING_ACTIVE_WEEK } from '../../db/repositories/settings';
import { fireAndForget } from '../../lib/fireAndForget';
import { EntityPicker } from '../shared/EntityPicker';

export function AddToWeekPicker({ onClose }: { onClose: () => void }) {
  const activeWeekSetting = useLiveQuery(() => db.settings.get(SETTING_ACTIVE_WEEK), [], undefined);
  const weekId =
    (typeof activeWeekSetting?.value === 'string' && activeWeekSetting.value) || getCurrentWeekId();

  const containers = useLiveQuery(() => db.containers.toArray(), [], []);
  const containerById = new Map((containers ?? []).map((c) => [c.id, c]));
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  const tasks = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) =>
            t.weekly?.weekId !== weekId &&
            !t.archived &&
            !containerById.get(t.containerId)?.archived,
        )
        .toArray(),
    [weekId, containers],
    [],
  );

  const entities = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    subtitle: projectById.get(t.projectId)?.name,
  }));

  return (
    <EntityPicker
      open
      onOpenChange={(open) => !open && onClose()}
      title="Add task to this week"
      placeholder="Search tasks"
      entities={entities}
      onSelect={(id) => fireAndForget(addToWeek(id, weekId).then(onClose))}
      emptyMessage="No tasks match your search."
    />
  );
}
