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
