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
 * @param {string} path  e.g., '500 Worlds Campaign/missions/purge-and-burn.md'
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
 * List entries in a subdirectory of root. Returns [{name, kind}].
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

export async function readTextFile(root, path) {
  const fh = await resolveFile(root, path);
  const file = await fh.getFile();
  return file.text();
}

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
