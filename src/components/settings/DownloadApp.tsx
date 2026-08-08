import { useState } from 'react';
import { HardDriveDownload } from 'lucide-react';
import { Button } from '../../components/ui/button';

export function DownloadApp() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(window.location.href, { cache: 'no-store' });
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'planable.html';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download the app file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        Download a portable copy of the app that runs fully offline.
      </p>
      <Button onClick={handleDownload} disabled={busy}>
        <HardDriveDownload />
        {busy ? 'Downloading…' : 'Download app'}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
