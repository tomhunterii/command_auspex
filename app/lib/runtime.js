// app/lib/runtime.js
//
// Runtime detection helpers. The CONNECT REPO handler uses isTauri() to
// branch between FSA showDirectoryPicker (browser) and the Tauri shim
// (desktop app).

import { TauriDirectoryHandle } from './tauri-fs-shim.js';
import { makeTauriDriver } from './tauri-driver.js';
import { seedIfNeeded } from './seed-appdata.js';

export function isTauri(win = (typeof window !== 'undefined' ? window : undefined)) {
  return Boolean(win && win.__TAURI_INTERNALS__);
}

// Connect a "repo handle" appropriate to the current runtime.
// In Tauri: seeds AppData if needed and returns a TauriDirectoryHandle.
// In a browser: opens the FSA directory picker.
//
// Both branches resolve to an object that conforms to the slice of
// FileSystemDirectoryHandle that app/lib/fs.js consumes.
//
// `loadTauriDeps` is an injection seam: production reads window.__TAURI__.fs
// (exposed by withGlobalTauri); tests pass a stub. Returns an object shaped
// { fsApi, BaseDirectory } where fsApi is the Tauri filesystem plugin.
export async function connectRepoHandle({
  win = (typeof window !== 'undefined' ? window : undefined),
  loadTauriDeps = () => {
    const fsApi = win.__TAURI__.fs;
    return { fsApi, BaseDirectory: fsApi.BaseDirectory };
  },
} = {}) {
  if (isTauri(win)) {
    const { fsApi, BaseDirectory } = await loadTauriDeps();
    const resourceDriver = makeTauriDriver(BaseDirectory.Resource, fsApi);
    const appdataDriver = makeTauriDriver(BaseDirectory.AppData, fsApi);
    await seedIfNeeded({
      resource: resourceDriver,
      appdata: appdataDriver,
      seedRoots: ['datasheets', 'ultramarines', '500 Worlds Campaign'],
    });
    const handle = new TauriDirectoryHandle({ driver: appdataDriver, path: '' });
    handle.name = 'command-auspex';
    return handle;
  }
  // Browser fallback: keep existing FSA flow.
  return win.showDirectoryPicker({ mode: 'readwrite' });
}
