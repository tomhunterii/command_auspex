import { test } from 'node:test';
import assert from 'node:assert';
import { isTauri, connectRepoHandle } from '../app/lib/runtime.js';

test('isTauri returns true when window has __TAURI_INTERNALS__', () => {
  const fakeWindow = { __TAURI_INTERNALS__: {} };
  assert.strictEqual(isTauri(fakeWindow), true);
});

test('isTauri returns false in plain browser', () => {
  const fakeWindow = {};
  assert.strictEqual(isTauri(fakeWindow), false);
});

test('isTauri tolerates missing window argument', () => {
  // Node has no window — function must not throw and must return false
  assert.strictEqual(isTauri(undefined), false);
});

// Construct a stub Tauri fs plugin: in-memory store keyed by baseDir + path.
// Mirrors the real @tauri-apps/plugin-fs surface that tauri-driver consumes.
function makeFakeFsApi(initial = {}) {
  const stores = { RESOURCE: new Map(), APPDATA: new Map() };
  for (const [baseDir, files] of Object.entries(initial)) {
    for (const [path, content] of Object.entries(files)) {
      stores[baseDir].set(path, content);
    }
  }
  return {
    stores,
    async exists(path, { baseDir }) {
      const m = stores[baseDir];
      return m.has(path) || [...m.keys()].some(k => k.startsWith(path + '/'));
    },
    async readTextFile(path, { baseDir }) {
      const m = stores[baseDir];
      if (!m.has(path)) throw Object.assign(new Error('not found'), { name: 'NotFoundError' });
      return m.get(path);
    },
    async writeTextFile(path, content, { baseDir }) {
      stores[baseDir].set(path, content);
    },
    async mkdir(_path, _opts) {},
    async readDir(path, { baseDir }) {
      const m = stores[baseDir];
      const prefix = path === '' || path === '.' ? '' : path + '/';
      const out = [];
      const seen = new Set();
      for (const k of m.keys()) {
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

const FAKE_BASE = { Resource: 'RESOURCE', AppData: 'APPDATA' };

test('connectRepoHandle (Tauri branch): copies seed roots from Resource to AppData on first launch', async () => {
  const fakeFsApi = makeFakeFsApi({
    RESOURCE: {
      'datasheets/space-marines/units/intercessor-squad.md': 'INT',
      'ultramarines/rosters/2000pt.md': 'ROS',
      '500 Worlds Campaign/missions/purge-and-burn.md': 'PNB',
    },
    APPDATA: {},
  });

  const handle = await connectRepoHandle({
    win: { __TAURI_INTERNALS__: {} },
    loadTauriDeps: () => ({ fsApi: fakeFsApi, BaseDirectory: FAKE_BASE }),
  });

  assert.strictEqual(handle.name, 'command-auspex');
  assert.strictEqual(handle.kind, 'directory');
  // Seed copy should have populated AppData from Resource.
  assert.strictEqual(fakeFsApi.stores.APPDATA.get('datasheets/space-marines/units/intercessor-squad.md'), 'INT');
  assert.strictEqual(fakeFsApi.stores.APPDATA.get('ultramarines/rosters/2000pt.md'), 'ROS');
  assert.strictEqual(fakeFsApi.stores.APPDATA.get('500 Worlds Campaign/missions/purge-and-burn.md'), 'PNB');
  assert.ok(fakeFsApi.stores.APPDATA.has('.seeded'), 'marker must be written after first seed');
  // Returned handle reads through the AppData driver.
  const fh = await handle.getFileHandle('datasheets/space-marines/units/intercessor-squad.md');
  assert.strictEqual(await (await fh.getFile()).text(), 'INT');
});

test('connectRepoHandle (Tauri branch): is a no-op seed when AppData is already seeded', async () => {
  const fakeFsApi = makeFakeFsApi({
    RESOURCE: { 'datasheets/foo.md': 'NEW' },
    APPDATA: { '.seeded': '2026-04-25T00:00:00Z', 'datasheets/foo.md': 'OLD' },
  });

  await connectRepoHandle({
    win: { __TAURI_INTERNALS__: {} },
    loadTauriDeps: () => ({ fsApi: fakeFsApi, BaseDirectory: FAKE_BASE }),
  });

  // OLD must survive (not overwritten by NEW)
  assert.strictEqual(fakeFsApi.stores.APPDATA.get('datasheets/foo.md'), 'OLD');
});

test('connectRepoHandle (browser branch): delegates to showDirectoryPicker without touching loadTauriDeps', async () => {
  let pickerCalled = false;
  const fakeWindow = {
    showDirectoryPicker: async (opts) => { pickerCalled = true; return { name: 'browser-handle', __opts: opts }; },
  };
  let tauriDepsLoaded = false;
  const handle = await connectRepoHandle({
    win: fakeWindow,
    loadTauriDeps: () => { tauriDepsLoaded = true; throw new Error('should not be called in browser branch'); },
  });

  assert.strictEqual(pickerCalled, true);
  assert.strictEqual(tauriDepsLoaded, false, 'loadTauriDeps must NOT execute in the browser branch');
  assert.strictEqual(handle.name, 'browser-handle');
  assert.deepStrictEqual(handle.__opts, { mode: 'readwrite' });
});
