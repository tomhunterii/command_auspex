import { test } from 'node:test';
import assert from 'node:assert';
import { parseMovement } from '../app/lib/movement.js';

test('fixed integer movement', () => {
  assert.deepStrictEqual(parseMovement('6"'), { min: 6, max: 6 });
  assert.deepStrictEqual(parseMovement('10"'), { min: 10, max: 10 });
  assert.deepStrictEqual(parseMovement('5'), { min: 5, max: 5 });
});

test('D6 with positive modifier', () => {
  assert.deepStrictEqual(parseMovement('D6+2"'), { min: 3, max: 8 });
  assert.deepStrictEqual(parseMovement('D6+0"'), { min: 1, max: 6 });
});

test('bare D6', () => {
  assert.deepStrictEqual(parseMovement('D6"'), { min: 1, max: 6 });
});

test('bare D3', () => {
  assert.deepStrictEqual(parseMovement('D3+1"'), { min: 2, max: 4 });
});

test('2D6 sum', () => {
  assert.deepStrictEqual(parseMovement('2D6+1"'), { min: 3, max: 13 });
  assert.deepStrictEqual(parseMovement('2D6"'), { min: 2, max: 12 });
});

test('negative modifier clamps min at 0', () => {
  assert.deepStrictEqual(parseMovement('D6-1"'), { min: 0, max: 5 });
});

test('lowercase d still parses', () => {
  assert.deepStrictEqual(parseMovement('d6+1"'), { min: 2, max: 7 });
});

test('whitespace tolerated', () => {
  assert.deepStrictEqual(parseMovement('  D6 + 2 "  '), { min: 3, max: 8 });
});

test('returns null for *, empty, missing', () => {
  assert.strictEqual(parseMovement('*'), null);
  assert.strictEqual(parseMovement(''), null);
  assert.strictEqual(parseMovement(null), null);
  assert.strictEqual(parseMovement(undefined), null);
  assert.strictEqual(parseMovement('-'), null);
});

test('returns null for unrecognised junk', () => {
  assert.strictEqual(parseMovement('fast'), null);
  assert.strictEqual(parseMovement('xD6'), null);
});
