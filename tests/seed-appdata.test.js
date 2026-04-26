import { test } from 'node:test';
import assert from 'node:assert';
import { seedIfNeeded } from '../app/lib/seed-appdata.js';

function makeDriver(initial) {
  const fs = new Map(Object.entries(initial));
  return {
    fs,
    async exists(path) {
      return fs.has(path) || [...fs.keys()].some(k => k.startsWith(path + '/'));
    },
    async isFile(path) { return fs.has(path); },
    async readTextFile(path) {
      if (!fs.has(path)) throw Object.assign(new Error('not found'), { name: 'NotFoundError' });
      return fs.get(path);
    },
    async writeTextFile(path, content) { fs.set(path, content); },
    async mkdir(_path) {},
    async readDir(path) {
      const prefix = path === '' || path === '.' ? '' : path + '/';
      const out = [];
      const seen = new Set();
      for (const k of fs.keys()) {
        if (prefix && !k.startsWith(prefix)) continue;
        const rest = prefix ? k.slice(prefix.length) : k;
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

test('seedIfNeeded copies all files from resource → appdata when marker absent', async () => {
  const resource = makeDriver({
    'datasheets/space-marines/units/intercessor-squad.md': 'INT',
    'ultramarines/rosters/2000pt-norallus-orbital-assault.md': 'ROS',
    '500 Worlds Campaign/missions/purge-and-burn.md': 'PNB',
  });
  const appdata = makeDriver({});

  const result = await seedIfNeeded({
    resource,
    appdata,
    seedRoots: ['datasheets', 'ultramarines', '500 Worlds Campaign'],
  });

  assert.strictEqual(result.copied, 3);
  assert.strictEqual(appdata.fs.get('datasheets/space-marines/units/intercessor-squad.md'), 'INT');
  assert.strictEqual(appdata.fs.get('ultramarines/rosters/2000pt-norallus-orbital-assault.md'), 'ROS');
  assert.strictEqual(appdata.fs.get('500 Worlds Campaign/missions/purge-and-burn.md'), 'PNB');
  assert.ok(appdata.fs.has('.seeded'), 'marker should be written');
});

test('seedIfNeeded is a no-op when marker already present', async () => {
  const resource = makeDriver({ 'datasheets/foo.md': 'NEW' });
  const appdata = makeDriver({ '.seeded': '2026-04-25T00:00:00Z', 'datasheets/foo.md': 'OLD' });
  const result = await seedIfNeeded({
    resource,
    appdata,
    seedRoots: ['datasheets'],
  });
  assert.strictEqual(result.copied, 0);
  assert.strictEqual(appdata.fs.get('datasheets/foo.md'), 'OLD');
});

test('seedIfNeeded handles deeply nested directories', async () => {
  const resource = makeDriver({
    'a/b/c/d/e/leaf.md': 'X',
  });
  const appdata = makeDriver({});
  const result = await seedIfNeeded({
    resource,
    appdata,
    seedRoots: ['a'],
  });
  assert.strictEqual(result.copied, 1);
  assert.strictEqual(appdata.fs.get('a/b/c/d/e/leaf.md'), 'X');
});

test('seedIfNeeded skips seedRoot that does not exist in resource (graceful)', async () => {
  const resource = makeDriver({});
  const appdata = makeDriver({});
  const result = await seedIfNeeded({
    resource,
    appdata,
    seedRoots: ['datasheets', 'absent'],
  });
  assert.strictEqual(result.copied, 0);
  assert.ok(appdata.fs.has('.seeded'));
});
