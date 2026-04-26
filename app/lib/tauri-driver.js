// app/lib/tauri-driver.js
//
// Production filesystem driver for TauriDirectoryHandle.
// Anchored on a single BaseDirectory (e.g. BaseDirectory.AppData) and
// parameterized over the Tauri fs API. The caller passes window.__TAURI__.fs
// (exposed when tauri.conf.json has withGlobalTauri: true). This avoids
// bare-specifier ES module imports, which a no-bundler frontend cannot
// resolve.

export function makeTauriDriver(baseDir, fsApi) {
  return {
    async exists(path) {
      try {
        return await fsApi.exists(path, { baseDir });
      } catch {
        return false;
      }
    },
    async readTextFile(path) {
      return fsApi.readTextFile(path, { baseDir });
    },
    async writeTextFile(path, content) {
      return fsApi.writeTextFile(path, content, { baseDir });
    },
    async mkdir(path) {
      return fsApi.mkdir(path, { baseDir, recursive: true });
    },
    async readDir(path) {
      const items = await fsApi.readDir(path === '' ? '.' : path, { baseDir });
      return items.map(item => ({
        name: item.name,
        isDirectory: item.isDirectory ?? false,
        isFile: item.isFile ?? !item.isDirectory,
      }));
    },
  };
}
