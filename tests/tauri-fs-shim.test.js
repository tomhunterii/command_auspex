import { test } from 'node:test';
import assert from 'node:assert';
import { TauriDirectoryHandle } from '../app/lib/tauri-fs-shim.js';

// In-memory FS driver for tests.
// Files: Map<absolutePath, string>. Directories are implicit (any prefix that has children).
function makeDriver(files) {
  const fs = new Map(Object.entries(files));
  return {
    async exists(path) { return fs.has(path) || [...fs.keys()].some(k => k.startsWith(path + '/')); },
    async isFile(path) { return fs.has(path); },
    async readTextFile(path) {
      if (!fs.has(path)) {
        const err = new Error('not found');
        err.name = 'NotFoundError';
        throw err;
      }
      return fs.get(path);
    },
    async writeTextFile(path, content) { fs.set(path, content); },
    async mkdir(_path) { /* implicit; no-op for in-memory driver */ },
    async readDir(path) {
      const out = [];
      const seen = new Set();
      const prefix = path === '' ? '' : path + '/';
      for (const k of fs.keys()) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        if (rest === '') continue;
        const head = rest.split('/')[0];
        if (seen.has(head)) continue;
        seen.add(head);
        const isFile = rest === head;
        out.push({ name: head, isDirectory: !isFile, isFile });
      }
      return out;
    },
  };
}

test('TauriDirectoryHandle.getDirectoryHandle traverses one level', async () => {
  const driver = makeDriver({ 'datasheets/space-marines/units/intercessor-squad.md': 'body' });
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const ds = await root.getDirectoryHandle('datasheets');
  assert.strictEqual(ds.name, 'datasheets');
  assert.strictEqual(ds.kind, 'directory');
});

test('TauriDirectoryHandle.getDirectoryHandle throws NotFoundError on missing dir', async () => {
  const driver = makeDriver({});
  const root = new TauriDirectoryHandle({ driver, path: '' });
  await assert.rejects(
    () => root.getDirectoryHandle('nope'),
    err => err.name === 'NotFoundError'
  );
});

test('TauriDirectoryHandle.getDirectoryHandle with create:true does not throw on missing', async () => {
  const driver = makeDriver({});
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const made = await root.getDirectoryHandle('newdir', { create: true });
  assert.strictEqual(made.path, 'newdir');
});

test('TauriDirectoryHandle.getFileHandle returns a handle whose getFile().text() reads content', async () => {
  const driver = makeDriver({ 'a/b.md': 'hello' });
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const a = await root.getDirectoryHandle('a');
  const fh = await a.getFileHandle('b.md');
  const file = await fh.getFile();
  assert.strictEqual(await file.text(), 'hello');
});

test('TauriDirectoryHandle.getFileHandle throws NotFoundError on missing file', async () => {
  const driver = makeDriver({});
  const root = new TauriDirectoryHandle({ driver, path: '' });
  await assert.rejects(
    () => root.getFileHandle('missing.md'),
    err => err.name === 'NotFoundError'
  );
});

test('TauriDirectoryHandle createWritable round-trips content via close()', async () => {
  const driver = makeDriver({});
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const fh = await root.getFileHandle('out.md', { create: true });
  const w = await fh.createWritable();
  await w.write('SAVED');
  await w.close();
  const fh2 = await root.getFileHandle('out.md');
  assert.strictEqual(await (await fh2.getFile()).text(), 'SAVED');
});

test('TauriDirectoryHandle.entries() yields [name, {kind}] tuples', async () => {
  const driver = makeDriver({
    'a/x.md': '1',
    'a/y.md': '2',
    'a/sub/deep.md': '3',
  });
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const a = await root.getDirectoryHandle('a');
  const collected = [];
  for await (const [name, entry] of a.entries()) {
    collected.push([name, entry.kind]);
  }
  collected.sort();
  assert.deepStrictEqual(collected, [['sub', 'directory'], ['x.md', 'file'], ['y.md', 'file']]);
});

test('TauriDirectoryHandle is shape-compatible with fs.js readTextFile', async () => {
  const driver = makeDriver({ 'datasheets/space-marines/units/intercessor-squad.md': '# Intercessor Squad' });
  const root = new TauriDirectoryHandle({ driver, path: '' });
  const { readTextFile } = await import('../app/lib/fs.js');
  const text = await readTextFile(root, 'datasheets/space-marines/units/intercessor-squad.md');
  assert.strictEqual(text, '# Intercessor Squad');
});
