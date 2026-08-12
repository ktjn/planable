declare const __APP_VERSION__: string;

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** True when `fetched` is a real, different version string — guards against 404s, offline, and malformed responses. */
export function isNewerVersion(current: string, fetched: unknown): boolean {
  return typeof fetched === 'string' && fetched.length > 0 && fetched !== current;
}

async function fetchDeployedVersion(): Promise<unknown> {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return data && typeof data === 'object' ? (data as { version?: unknown }).version : null;
  } catch {
    // Offline, no version.json (e.g. `vite dev`), or a malformed response — just skip this check.
    return null;
  }
}

/**
 * Polls the deployed build's `version.json` in the background and reloads
 * the tab the moment a newer build is detected. A pending sandbox's
 * beforeunload guard (see ConsolePanel) still protects any uncommitted
 * staged changes — `location.reload()` is a real navigation, so the
 * browser's "leave site?" confirm fires exactly as it would for a manual
 * close or refresh.
 */
export function startVersionCheck(): () => void {
  let stopped = false;
  async function tick() {
    if (stopped) return;
    const fetched = await fetchDeployedVersion();
    if (!stopped && isNewerVersion(__APP_VERSION__, fetched)) {
      window.location.reload();
    }
  }
  const intervalId = window.setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
  function onVisibilityChange() {
    if (document.visibilityState === 'visible') void tick();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
