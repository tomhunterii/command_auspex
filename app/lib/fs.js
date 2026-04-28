// app/lib/fs.js
// File System Access API helpers + pure-function utilities.

export function pathJoin(...segments) {
  return segments
    .filter(s => s !== '')
    .map((s, i) => (i === 0 ? s.replace(/\/+$/, '') : s.replace(/^\/+|\/+$/g, '')))
    .filter(s => s !== '')
    .join('/');
}

export function filterByExtension(items, ext) {
  return items.filter(i => i.kind === 'file' && i.name.endsWith(ext));
}

/**
 * Resolve a path relative to a root directory handle.
 * @param {FileSystemDirectoryHandle} root
 * @param {string} path  e.g., 'scenarios/purge-and-burn.md'
 * @returns {Promise<FileSystemFileHandle>}
 */
export async function resolveFile(root, path) {
  const parts = path.split('/').filter(Boolean);
  let handle = root;
  for (let i = 0; i < parts.length - 1; i++) {
    handle = await handle.getDirectoryHandle(parts[i]);
  }
  return handle.getFileHandle(parts[parts.length - 1]);
}

/**
 * List entries in a subdirectory of root.
 * @param {FileSystemDirectoryHandle} root
 * @param {string} path
 * @returns {Promise<Array<{name: string, kind: 'file' | 'directory'}>>}
 */
export async function listDir(root, path) {
  const parts = path.split('/').filter(Boolean);
  let handle = root;
  for (const p of parts) {
    handle = await handle.getDirectoryHandle(p);
  }
  const out = [];
  for await (const [name, entry] of handle.entries()) {
    out.push({ name, kind: entry.kind });
  }
  return out;
}

/**
 * Read a text file at the given repo-relative path.
 * @param {FileSystemDirectoryHandle} root
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function readTextFile(root, path) {
  const fh = await resolveFile(root, path);
  const file = await fh.getFile();
  return file.text();
}

/**
 * Check whether a file exists at the given repo-relative path.
 * Returns true only when the final segment is a file (not a directory).
 * Returns false for any missing segment or type mismatch — never throws.
 * @param {FileSystemDirectoryHandle} root
 * @param {string} path
 * @returns {Promise<boolean>}
 */
export async function fileExists(root, path) {
  try {
    const parts = path.split('/').filter(Boolean);
    let handle = root;
    for (let i = 0; i < parts.length - 1; i++) {
      handle = await handle.getDirectoryHandle(parts[i]);
    }
    await handle.getFileHandle(parts[parts.length - 1]);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Write a text file at the given repo-relative path.
 * Auto-creates any missing parent directories. Truncates any existing file
 * at `path` (FSA `createWritable()` defaults to `keepExistingData: false`).
 * @param {FileSystemDirectoryHandle} root
 * @param {string} path
 * @param {string} content
 * @returns {Promise<void>}
 */
export async function writeTextFile(root, path, content) {
  const parts = path.split('/').filter(Boolean);
  let handle = root;
  for (let i = 0; i < parts.length - 1; i++) {
    handle = await handle.getDirectoryHandle(parts[i], { create: true });
  }
  const fh = await handle.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await fh.createWritable();
  await writable.write(content);
  await writable.close();
}
