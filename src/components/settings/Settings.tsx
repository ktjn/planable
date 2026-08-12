import { useLiveQuery } from 'dexie-react-hooks';
import { Database, Keyboard, Settings as SettingsIcon } from 'lucide-react';
import { db } from '../../db/db';
import { SETTING_ACTIVE_WEEK } from '../../db/repositories/settings';
import { getCurrentWeekId, getWeekLabel } from '../../lib/week';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { ImportExport } from './ImportExport';
import { DownloadApp } from './DownloadApp';

const SHORTCUTS: { key: string; description: string }[] = [
  { key: 'W', description: 'Go to the Weekly Plan' },
  { key: 'K', description: 'Go to the Kanban board' },
  { key: 'L', description: 'Manage labels' },
  { key: 'S', description: 'Open settings' },
  { key: '/', description: 'Quick search' },
  { key: 'Ctrl+F', description: 'Search tasks' },
  { key: 'Ctrl+K', description: 'Toggle the command console' },
];

export function Settings() {
  const activeWeekSetting = useLiveQuery(() => db.settings.get(SETTING_ACTIVE_WEEK), [], undefined);
  const activeWeek =
    (typeof activeWeekSetting?.value === 'string' && activeWeekSetting.value) || getCurrentWeekId();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <SettingsIcon className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your workspace</p>
        </div>
      </div>
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
          <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-medium">Active week</h3>
            <p className="mb-3 text-sm text-muted-foreground">{getWeekLabel(activeWeek)}</p>
            <Separator className="my-3" />
            <h3 className="text-sm font-medium">Backup & restore</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Export a full JSON backup of projects, containers, tasks, labels, and weekly templates.
            </p>
            <ImportExport />
            <Separator className="my-3" />
            <h3 className="text-sm font-medium">Offline copy</h3>
            <DownloadApp />
          </div>
        </TabsContent>

        <TabsContent value="shortcuts">
          <ul className="flex max-w-md flex-col gap-1.5">
            {SHORTCUTS.map((s) => (
              <li
                key={s.key}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm"
              >
                <span className="text-sm">{s.description}</span>
                <kbd className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium">
                  {s.key}
                </kbd>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
