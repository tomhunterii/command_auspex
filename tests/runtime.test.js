import { test } from 'node:test';
import assert from 'node:assert';
import { isTauri } from '../app/lib/runtime.js';

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

import { connectRepoHandle } from '../app/lib/runtime.js';

test('connectRepoHandle (Tauri branch): seeds AppData and returns shimmed handle', async () => {
  // Track which APIs got called.
  const calls = { seedRoots: null, baseDirsRequested: [] };

  // Stub for the Tauri-side imports normally pulled by loadTauriDeps.
  class FakeHandle {
    constructor({ driver, path }) { this.driver = driver; this.path = path; this.kind = 'directory'; this.name = ''; }
  }
  const FAKE_BASE = { Resource: 'RESOURCE', AppData: 'APPDATA' };
  const fakeDriverByBase = (base) => ({ __base: base });
  const stubDeps = {
    TauriDirectoryHandle: FakeHandle,
    makeTauriDriver: (base) => { calls.baseDirsRequested.push(base); return fakeDriverByBase(base); },
    seedIfNeeded: async ({ resource, appdata, seedRoots }) => {
      calls.seedRoots = seedRoots;
      calls.resource = resource;
      calls.appdata = appdata;
      return { copied: 0, alreadySeeded: false };
    },
    BaseDirectory: FAKE_BASE,
  };

  const fakeWindow = { __TAURI_INTERNALS__: {} };
  const handle = await connectRepoHandle({
    win: fakeWindow,
    loadTauriDeps: async () => stubDeps,
  });

  assert.ok(handle instanceof FakeHandle, 'should return a TauriDirectoryHandle');
  assert.deepStrictEqual(calls.baseDirsRequested, ['RESOURCE', 'APPDATA']);
  assert.deepStrictEqual(calls.seedRoots, ['datasheets', 'ultramarines', '500 Worlds Campaign']);
  assert.strictEqual(handle.name, 'command-auspex');
  assert.strictEqual(handle.driver.__base, 'APPDATA', 'handle should be anchored on AppData driver');
});

test('connectRepoHandle (browser branch): delegates to showDirectoryPicker without touching loadTauriDeps', async () => {
  let pickerCalled = false;
  const fakeWindow = {
    showDirectoryPicker: async (opts) => { pickerCalled = true; return { name: 'browser-handle', __opts: opts }; },
  };
  let tauriDepsLoaded = false;
  const handle = await connectRepoHandle({
    win: fakeWindow,
    loadTauriDeps: async () => { tauriDepsLoaded = true; throw new Error('should not be called in browser branch'); },
  });

  assert.strictEqual(pickerCalled, true);
  assert.strictEqual(tauriDepsLoaded, false, 'loadTauriDeps must NOT execute in the browser branch');
  assert.strictEqual(handle.name, 'browser-handle');
  assert.deepStrictEqual(handle.__opts, { mode: 'readwrite' });
});
