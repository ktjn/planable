import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isNewerVersion, startVersionCheck } from './versionCheck';

describe('isNewerVersion', () => {
  it('is true for a different, non-empty version string', () => {
    expect(isNewerVersion('test', 'abc123')).toBe(true);
  });

  it('is false for the same version', () => {
    expect(isNewerVersion('test', 'test')).toBe(false);
  });

  it('is false for a missing, non-string, or empty version', () => {
    expect(isNewerVersion('test', undefined)).toBe(false);
    expect(isNewerVersion('test', null)).toBe(false);
    expect(isNewerVersion('test', 42)).toBe(false);
    expect(isNewerVersion('test', '')).toBe(false);
  });
});

describe('startVersionCheck', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let reloadSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // jsdom's window.location.reload isn't configurable enough for vi.spyOn directly.
    reloadSpy = vi.fn();
    originalLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { reload: reloadSpy } });
  });

  afterEach(() => {
    stop?.();
    fetchSpy.mockRestore();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    vi.useRealTimers();
  });

  it('reloads once a fetched version differs from the running build', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ version: 'new-build' }) } as Response);
    stop = startVersionCheck();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the fetched version matches (test build)', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ version: 'test' }) } as Response);
    stop = startVersionCheck();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('does not reload on a fetch failure (offline, or no version.json in dev)', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'));
    stop = startVersionCheck();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('does not reload on a non-ok response', async () => {
    fetchSpy.mockResolvedValue({ ok: false, json: async () => ({ version: 'new-build' }) } as Response);
    stop = startVersionCheck();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('checks again when the tab becomes visible', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ version: 'new-build' }) } as Response);
    stop = startVersionCheck();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
  });

  it('stops checking once stopped', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ version: 'new-build' }) } as Response);
    stop = startVersionCheck();
    stop();

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
