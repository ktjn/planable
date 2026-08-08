# Download app button (offline single-file copy) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Download app" button in Settings → Data that downloads the currently-loaded single-file page HTML as `planable.html` for offline use.

**Architecture:** New `src/components/settings/DownloadApp.tsx` that fetches `window.location.href` (`cache: 'no-store'`), wraps the response in a `text/html` Blob, and triggers a download. Wired into `Settings.tsx`'s Data tab beside `ImportExport`. Mirrors the existing `ImportExport` file-download pattern.

**Tech Stack:** React 19, TypeScript, lucide-react, shadcn/ui Button.

## Global Constraints

- Keep components small and reusable; follow existing Settings patterns.
- No runtime/storage schema changes.
- Write a colocated Vitest test.
- Record decisions in `docs/decisions.md` (already updated for this work).

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/settings/DownloadApp.tsx` | Fetch current page HTML and download it as `planable.html`. |
| `src/components/settings/DownloadApp.test.tsx` | Verifies the click downloads a blob named `planable.html`. |
| `src/components/settings/Settings.tsx` | Render `DownloadApp` in the Data tab. |

---

### Task 1: Create `DownloadApp` component

**Files:**
- Create: `src/components/settings/DownloadApp.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/settings/DownloadApp.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DownloadApp } from './DownloadApp';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-downloadapp-${Math.random()}`) };
});

describe('DownloadApp', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads the current page HTML as planable.html', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<!doctype html><html><body>app</body></html>', { status: 200 }),
    );
    const clickSpy = vi.fn();
    const createSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      click: clickSpy,
      href: '',
      download: '',
    } as unknown as HTMLAnchorElement);

    render(<DownloadApp />);
    await userEvent.click(screen.getByRole('button', { name: /download app/i }));

    expect(fetchMock).toHaveBeenCalledWith(window.location.href, expect.objectContaining({ cache: 'no-store' }));
    expect(createSpy).toHaveBeenCalledWith('a');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    render(<DownloadApp />);
    await userEvent.click(screen.getByRole('button', { name: /download app/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to download/i);
  });
});
```

Run: `npx vitest run src/components/settings/DownloadApp.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 2: Implement the component**

Create `src/components/settings/DownloadApp.tsx`:

```tsx
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
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/components/settings/DownloadApp.test.tsx`
Expected: PASS.

---

### Task 2: Wire into Settings

**Files:**
- Modify: `src/components/settings/Settings.tsx`

- [ ] **Step 1: Render `DownloadApp` in the Data tab**

Add the import and render below `ImportExport`:

```tsx
import { DownloadApp } from './DownloadApp';
```

```tsx
<ImportExport />
<Separator className="my-3" />
<h3 className="text-sm font-medium">Offline copy</h3>
<DownloadApp />
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: all tests PASS.

---

### Task 3: Final verification

- [ ] **Step 1: Build**

Run: `npm run build:single`
Expected: succeeds.

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/DownloadApp.tsx src/components/settings/DownloadApp.test.tsx src/components/settings/Settings.tsx docs/decisions.md docs/superpowers/specs/2026-08-08-download-app-design.md
git commit -m "feat(settings): add download-app button for offline single-file copy"
```

---

## Self-review

**Spec coverage:** Fetch current page HTML (`cache: 'no-store'`) → Task 1; save as `planable.html` → Task 1; place in Settings → Data → Task 2; no data bundling → component only downloads HTML.

**Placeholder scan:** no TBD/TODO.

**Type consistency:** uses lucide icon + `Button` consistent with `ImportExport`/`Settings`.
