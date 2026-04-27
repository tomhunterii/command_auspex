import { test } from 'node:test';
import assert from 'node:assert';
import { parseDice, rollDice } from '../app/lib/sim/dice.js';

function makeRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('parseDice "3" returns a roll function that always returns 3', () => {
  const fn = parseDice('3');
  assert.strictEqual(fn(makeRng([0.5])), 3);
});

test('parseDice "D6" returns a roll function that returns 1-6 depending on RNG', () => {
  const fn = parseDice('D6');
  // makeRng with 0 → floor(0*6)+1 = 1
  assert.strictEqual(fn(() => 0), 1);
  // 0.99 → floor(0.99*6)+1 = 6
  assert.strictEqual(fn(() => 0.999), 6);
  // 0.5 → floor(0.5*6)+1 = 4
  assert.strictEqual(fn(() => 0.5), 4);
});

test('parseDice "D3" returns 1-3', () => {
  const fn = parseDice('D3');
  assert.strictEqual(fn(() => 0), 1);
  assert.strictEqual(fn(() => 0.999), 3);
});

test('parseDice "2D6" returns sum of two d6', () => {
  const fn = parseDice('2D6');
  // RNG sequence [0.999, 0] → first roll = 6, second roll = 1, sum = 7
  const rng = makeRng([0.999, 0]);
  assert.strictEqual(fn(rng), 7);
});

test('parseDice "D6+2" adds the modifier', () => {
  const fn = parseDice('D6+2');
  assert.strictEqual(fn(() => 0), 1 + 2);     // 1 + 2 = 3
  assert.strictEqual(fn(() => 0.999), 6 + 2); // 6 + 2 = 8
});

test('parseDice handles whitespace and lowercase', () => {
  const fn = parseDice(' d3 ');
  assert.strictEqual(fn(() => 0), 1);
  assert.strictEqual(fn(() => 0.999), 3);
});

test('parseDice on empty/invalid returns roll fn that returns 0', () => {
  const fn = parseDice('');
  assert.strictEqual(fn(() => 0.5), 0);
  const fn2 = parseDice('—');
  assert.strictEqual(fn2(() => 0.5), 0);
});

test('rollDice with default RNG returns expected averages over many trials', () => {
  // 1000 D6 rolls — mean should be ~3.5
  let sum = 0;
  for (let i = 0; i < 1000; i++) sum += rollDice('D6');
  const mean = sum / 1000;
  assert.ok(Math.abs(mean - 3.5) < 0.4, `mean ${mean} should be near 3.5`);
});
