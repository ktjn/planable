import { useRef, useState } from 'react';
import { Download, FileText, Upload } from 'lucide-react';
import {
  exportData,
  exportMarkdown,
  importData,
  importMarkdown,
  type MarkdownImportResult,
  type PlanableExport,
} from '../../lib/importExport';
import { Button } from '../../components/ui/button';

const MAX_SHOWN_WARNINGS = 5;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function describeImport(result: MarkdownImportResult): string {
  const parts = [
    [result.projects, 'project'],
    [result.containers, 'container'],
    [result.tasks, 'task'],
    [result.labels, 'label'],
  ]
    .filter(([count]) => (count as number) > 0)
    .map(([count, noun]) => `${count} ${noun}${count === 1 ? '' : 's'}`);
  return parts.length > 0 ? `Imported ${parts.join(', ')}.` : 'Nothing new to import.';
}

export function ImportExport() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markdownInputRef = useRef<HTMLInputElement>(null);

  function resetFeedback() {
    setError(null);
    setNotice(null);
    setWarnings([]);
  }

  async function handleExport() {
    const data = await exportData();
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      'planable-export.json',
    );
  }

  async function handleExportMarkdown() {
    const text = await exportMarkdown();
    downloadBlob(new Blob([text], { type: 'text/markdown' }), 'planable-export.md');
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Importing will replace all existing data. Continue?')) {
      e.target.value = '';
      return;
    }

    resetFeedback();
    try {
      const text = await file.text();
      const data = JSON.parse(text) as PlanableExport;
      await importData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file.');
    } finally {
      e.target.value = '';
    }
  }

  async function handleImportMarkdown(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !window.confirm(
        'Markdown import adds projects, containers, tasks, and labels to your existing data. Continue?',
      )
    ) {
      e.target.value = '';
      return;
    }

    resetFeedback();
    try {
      const result = await importMarkdown(await file.text());
      setNotice(describeImport(result));
      setWarnings(result.warnings);
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
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={handleExportMarkdown}>
          <FileText />
          Export Markdown
        </Button>
        <Button variant="outline" onClick={() => markdownInputRef.current?.click()}>
          <Upload />
          Import Markdown
        </Button>
        <input
          ref={markdownInputRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          aria-label="Import Markdown"
          onChange={handleImportMarkdown}
          className="hidden"
        />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {warnings.length > 0 && (
        <ul aria-label="Import warnings" className="list-disc pl-5 text-sm text-muted-foreground">
          {warnings.slice(0, MAX_SHOWN_WARNINGS).map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
          {warnings.length > MAX_SHOWN_WARNINGS && (
            <li>and {warnings.length - MAX_SHOWN_WARNINGS} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
