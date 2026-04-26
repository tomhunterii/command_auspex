// app/lib/tauri-driver.js
//
// Production filesystem driver for TauriDirectoryHandle.
// Backs the shim with @tauri-apps/plugin-fs. Anchored on a single
// BaseDirectory (BaseDirectory.AppData for milestone 0.1).

import {
  readTextFile,
  writeTextFile,
  readDir,
  exists,
  mkdir,
} from '@tauri-apps/plugin-fs';

export function makeTauriDriver(baseDir) {
  return {
    async exists(path) {
      try {
        return await exists(path, { baseDir });
      } catch {
        return false;
      }
    },
    async readTextFile(path) {
      return readTextFile(path, { baseDir });
    },
    async writeTextFile(path, content) {
      return writeTextFile(path, content, { baseDir });
    },
    async mkdir(path) {
      return mkdir(path, { baseDir, recursive: true });
    },
    async readDir(path) {
      const items = await readDir(path === '' ? '.' : path, { baseDir });
      return items.map(item => ({
        name: item.name,
        isDirectory: item.isDirectory ?? false,
        isFile: item.isFile ?? !item.isDirectory,
      }));
    },
  };
}
