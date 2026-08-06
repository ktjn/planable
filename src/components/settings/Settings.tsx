import { useLiveQuery } from 'dexie-react-hooks';
import { Database, Keyboard } from 'lucide-react';
import { db } from '../../db/db';
import { SETTING_ACTIVE_WEEK } from '../../db/repositories/settings';
import { getCurrentWeekId, getWeekLabel } from '../../lib/week';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { ImportExport } from './ImportExport';

const SHORTCUTS: { key: string; description: string }[] = [
  { key: 'W', description: 'Go to the Weekly Plan' },
  { key: 'K', description: 'Go to the Kanban board' },
  { key: 'L', description: 'Manage labels' },
  { key: 'S', description: 'Open settings' },
  { key: '/', description: 'Quick search' },
  { key: 'Ctrl+F', description: 'Search tasks' },
];

export function Settings() {
  const activeWeekSetting = useLiveQuery(() => db.settings.get(SETTING_ACTIVE_WEEK), [], undefined);
  const activeWeek =
    (typeof activeWeekSetting?.value === 'string' && activeWeekSetting.value) || getCurrentWeekId();

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-4 text-lg font-medium">Settings</h2>
      <Tabs defaultValue="data">
        <TabsList className="mb-4">
          <TabsTrigger value="data">
            <Database />
            Data
          </TabsTrigger>
          <TabsTrigger value="shortcuts">
            <Keyboard />
            Shortcuts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Active week</h3>
            <p className="mb-3 text-sm text-muted-foreground">{getWeekLabel(activeWeek)}</p>
            <Separator className="my-3" />
            <h3 className="text-sm font-medium">Backup & restore</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Export a full JSON backup of projects, containers, tasks, labels, and weekly templates.
            </p>
            <ImportExport />
          </div>
        </TabsContent>

        <TabsContent value="shortcuts">
          <ul className="flex max-w-md flex-col gap-1">
            {SHORTCUTS.map((s) => (
              <li key={s.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">{s.description}</span>
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{s.key}</kbd>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
