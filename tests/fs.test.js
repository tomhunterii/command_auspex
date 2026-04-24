import { test } from 'node:test';
import assert from 'node:assert';
import { filterByExtension, pathJoin } from '../app/lib/fs.js';

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
