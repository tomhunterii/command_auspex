import { test } from 'node:test';
import assert from 'node:assert';
import { filterByExtension, pathJoin, fileExists } from '../app/lib/fs.js';

// --- FSA mock helpers for fileExists tests ---
function mockDir(tree) {
  return {
    getDirectoryHandle: async (name) => {
      const entry = tree[name];
      if (!entry) throw Object.assign(new Error('not found'), { name: 'NotFoundError' });
      if (!entry.getDirectoryHandle) throw Object.assign(new Error('type mismatch'), { name: 'TypeMismatchError' });
      return entry;
    },
    getFileHandle: async (name) => {
      const entry = tree[name];
      if (!entry) throw Object.assign(new Error('not found'), { name: 'NotFoundError' });
      if (entry.getDirectoryHandle) throw Object.assign(new Error('type mismatch'), { name: 'TypeMismatchError' });
      return entry;
    },
  };
}
function mockFile() { return {}; }

test('filterByExtension keeps only .md files', () => {
  const items = [
    { name: 'a.md', kind: 'file' },
    { name: 'b.txt', kind: 'file' },
    { name: 'c.md', kind: 'file' },
    { name: 'subfolder', kind: 'directory' },
  ];
  const result = filterByExtension(items, '.md');
  assert.deepStrictEqual(result.map(i => i.name), ['a.md', 'c.md']);
});

test('pathJoin joins segments with /', () => {
  assert.strictEqual(pathJoin('a', 'b', 'c'), 'a/b/c');
  assert.strictEqual(pathJoin('a/', '/b/', '/c'), 'a/b/c');
  assert.strictEqual(pathJoin('a', '', 'b'), 'a/b');
});

test('pathJoin returns empty string when given no or only empty segments', () => {
  assert.strictEqual(pathJoin(), '');
  assert.strictEqual(pathJoin('', '', ''), '');
});

test('fileExists returns true when file exists at path', async () => {
  const root = mockDir({ a: mockDir({ 'b.md': mockFile() }) });
  assert.strictEqual(await fileExists(root, 'a/b.md'), true);
});

test('fileExists returns false when parent directory is missing', async () => {
  const root = mockDir({});
  assert.strictEqual(await fileExists(root, 'a/b.md'), false);
});

test('fileExists returns false when parent dir exists but file does not', async () => {
  const root = mockDir({ a: mockDir({}) });
  assert.strictEqual(await fileExists(root, 'a/b.md'), false);
});

test('fileExists returns false when a/b.md is actually a directory not a file', async () => {
  const root = mockDir({ a: mockDir({ 'b.md': mockDir({}) }) });
  assert.strictEqual(await fileExists(root, 'a/b.md'), false);
});
