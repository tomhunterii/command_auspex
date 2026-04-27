import { test } from 'node:test';
import assert from 'node:assert';
import { isTauri, connectRepoHandle } from '../app/lib/runtime.js';

test('isTauri returns true when window has __TAURI_INTERNALS__', () => {
  assert.strictEqual(isTauri({ __TAURI_INTERNALS__: {} }), true);
});

test('isTauri returns false in plain browser', () => {
  assert.strictEqual(isTauri({}), false);
});

test('isTauri tolerates missing window argument', () => {
  assert.strictEqual(isTauri(undefined), false);
});

test('connectRepoHandle (browser branch): delegates to showDirectoryPicker', async () => {
  let pickerCalled = false;
  const fakeWindow = {
    showDirectoryPicker: async (opts) => { pickerCalled = true; return { name: 'browser-handle', __opts: opts }; },
  };
  const handle = await connectRepoHandle({ win: fakeWindow });
  assert.strictEqual(pickerCalled, true);
  assert.strictEqual(handle.name, 'browser-handle');
  assert.deepStrictEqual(handle.__opts, { mode: 'readwrite' });
});

test('connectRepoHandle (Tauri branch): throws migration-pending error', async () => {
  const fakeWindow = { __TAURI_INTERNALS__: {} };
  await assert.rejects(
    connectRepoHandle({ win: fakeWindow }),
    /migrating from filesystem to SQLite catalogue/
  );
});
