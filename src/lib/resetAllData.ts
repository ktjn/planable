import { importData } from './importExport';

/** Clears every project, container, task, label, week template, and setting. */
export async function resetAllData(): Promise<void> {
  await importData({
    version: 2,
    projects: [],
    containers: [],
    tasks: [],
    labels: [],
    weekTemplates: [],
    settings: [],
  });
}
