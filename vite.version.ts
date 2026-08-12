import type { Plugin } from 'vite';

/** A per-build identifier the running app compares against `version.json` to detect a new deploy. */
export function buildAppVersion(): string {
  return process.env.SOURCE_VERSION || String(Date.now());
}

/** Emits `version.json` into the build output so a running tab can poll for a newer deployed build. */
export function versionJsonPlugin(version: string): Plugin {
  return {
    name: 'planable-version-json',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
    },
  };
}
