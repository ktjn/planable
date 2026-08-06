import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { getCurrentWeekId } from '../../lib/week';
import type { WeekDay } from '../../db/schema';

const COLUMNS: WeekDay[] = ['Unplanned', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function WeeklyPlanView() {
  const weekId = getCurrentWeekId();
  const tasks = useLiveQuery(
    () => db.tasks.filter((t) => t.weekly?.weekId === weekId).toArray(),
    [weekId],
    [],
  );

  return (
    <div className="flex gap-4">
      {COLUMNS.map((day) => (
        <section key={day} className="w-48 shrink-0 rounded border border-gray-200 p-2">
          <h3 className="mb-2 font-medium">{day}</h3>
          <ul>
            {tasks
              .filter((t) => t.weekly?.day === day)
              .map((t) => (
                <li key={t.id} className="py-1">
                  {t.title}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
