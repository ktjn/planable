import { useState } from 'react';
import { exportData, importData, type PlanableExport } from '../../lib/importExport';

export function ImportExport() {
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planable-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Importing will replace all existing data. Continue?')) {
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text) as PlanableExport;
      await importData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div>
      <button onClick={handleExport}>Export</button>
      <label>
        Import
        <input type="file" accept="application/json" onChange={handleImport} />
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
