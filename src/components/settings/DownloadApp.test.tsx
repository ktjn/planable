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
    const originalCreate = document.createElement.bind(document);
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        if (tag === 'a') {
          return { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement;
        }
        return originalCreate(tag);
      });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    render(<DownloadApp />);
    await userEvent.click(screen.getByRole('button', { name: /download app/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      window.location.href,
      expect.objectContaining({ cache: 'no-store' }),
    );
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
