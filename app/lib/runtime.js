// app/lib/runtime.js
//
// Runtime detection. Browser dev keeps the FileSystemAccess flow; the Tauri
// branch is stubbed pending migration from filesystem-walking-the-bundled-
// markdown-tree to the SQLite catalogue (see milestone 0.2 in
// docs/superpowers/specs/2026-04-26-command-auspex-rebuild-design.md).

export function isTauri(win = (typeof window !== 'undefined' ? window : undefined)) {
  return Boolean(win && win.__TAURI_INTERNALS__);
}

export async function connectRepoHandle({
  win = (typeof window !== 'undefined' ? window : undefined),
} = {}) {
  if (isTauri(win)) {
    throw new Error(
      'CONNECT REPO is migrating from filesystem to SQLite catalogue. ' +
      'Use the SQLite catalogue path once milestone 0.2 wiring lands.'
    );
  }
  return win.showDirectoryPicker({ mode: 'readwrite' });
}
