// app/lib/runtime.js
//
// Runtime detection helpers. The CONNECT REPO handler uses isTauri() to
// branch between FSA showDirectoryPicker (browser) and the Tauri shim
// (desktop app).

export function isTauri(win = (typeof window !== 'undefined' ? window : undefined)) {
  return Boolean(win && win.__TAURI_INTERNALS__);
}

// Connect a "repo handle" appropriate to the current runtime.
// In Tauri: seeds AppData if needed and returns a TauriDirectoryHandle.
// In a browser: opens the FSA directory picker.
//
// Both branches resolve to an object that conforms to the slice of
// FileSystemDirectoryHandle that app/lib/fs.js consumes.
export async function connectRepoHandle({
  win = (typeof window !== 'undefined' ? window : undefined),
  // Tauri-side wiring (lazy-imported only inside the Tauri branch
  // so a plain browser never tries to load @tauri-apps modules).
  loadTauriDeps = async () => {
    const [{ TauriDirectoryHandle }, { makeTauriDriver }, { seedIfNeeded }, fs] = await Promise.all([
      import('./tauri-fs-shim.js'),
      import('./tauri-driver.js'),
      import('./seed-appdata.js'),
      import('@tauri-apps/plugin-fs'),
    ]);
    return { TauriDirectoryHandle, makeTauriDriver, seedIfNeeded, BaseDirectory: fs.BaseDirectory };
  },
} = {}) {
  if (isTauri(win)) {
    const { TauriDirectoryHandle, makeTauriDriver, seedIfNeeded, BaseDirectory } = await loadTauriDeps();
    const resourceDriver = makeTauriDriver(BaseDirectory.Resource);
    const appdataDriver = makeTauriDriver(BaseDirectory.AppData);
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
