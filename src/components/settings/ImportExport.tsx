import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { exportData, importData, type PlanableExport } from '../../lib/importExport';
import { Button } from '../../components/ui/button';

export function ImportExport() {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-2">
        <Button onClick={handleExport}>
          <Download />
          Export
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload />
          Import
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          aria-label="Import"
          onChange={handleImport}
          className="hidden"
        />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
