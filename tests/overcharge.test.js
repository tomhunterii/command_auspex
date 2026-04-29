import { test } from 'node:test';
import assert from 'node:assert';
import {
  OVERCHARGE_RE, isOverchargeProfile, baseWeaponName,
  findOverchargePairs, applyOverchargeFilter,
} from '../app/lib/overcharge.js';

test('isOverchargeProfile detects en-dash, em-dash, hyphen + supercharge/overcharge', () => {
  assert.strictEqual(isOverchargeProfile('Plasma incinerator – supercharge'), true);
  assert.strictEqual(isOverchargeProfile('Plasma incinerator — supercharge'), true);
  assert.strictEqual(isOverchargeProfile('Plasma pistol - overcharge'), true);
  assert.strictEqual(isOverchargeProfile('Plasma pistol – Supercharge'), true);
  assert.strictEqual(isOverchargeProfile('Plasma incinerator'), false);
  assert.strictEqual(isOverchargeProfile('Bolter'), false);
  assert.strictEqual(isOverchargeProfile(''), false);
  assert.strictEqual(isOverchargeProfile(null), false);
});

test('baseWeaponName strips the overcharge suffix and trims', () => {
  assert.strictEqual(baseWeaponName('Plasma incinerator – supercharge'), 'Plasma incinerator');
  assert.strictEqual(baseWeaponName('Plasma pistol — overcharge'), 'Plasma pistol');
  assert.strictEqual(baseWeaponName('Plasma pistol'), 'Plasma pistol');
  assert.strictEqual(baseWeaponName('  Plasma pistol – supercharge  '), 'Plasma pistol');
});

test('findOverchargePairs returns only base names with BOTH profiles', () => {
  const weapons = [
    { name: 'Plasma incinerator', kind: 'ranged' },
    { name: 'Plasma incinerator – supercharge', kind: 'ranged' },
    { name: 'Bolter', kind: 'ranged' },
    { name: 'Plasma pistol – supercharge', kind: 'ranged' }, // missing standard
  ];
  const pairs = findOverchargePairs(weapons);
  assert.strictEqual(pairs.size, 1);
  assert.ok(pairs.has('plasma incinerator'));
  assert.ok(!pairs.has('bolter'));
  assert.ok(!pairs.has('plasma pistol')); // unpaired
});

test('findOverchargePairs handles empty/null', () => {
  assert.strictEqual(findOverchargePairs([]).size, 0);
  assert.strictEqual(findOverchargePairs(null).size, 0);
  assert.strictEqual(findOverchargePairs(undefined).size, 0);
});

test('applyOverchargeFilter default standard: keeps standard, drops overcharge', () => {
  const weapons = [
    { name: 'Plasma incinerator', kind: 'ranged' },
    { name: 'Plasma incinerator – supercharge', kind: 'ranged' },
    { name: 'Bolter', kind: 'ranged' },
  ];
  const filtered = applyOverchargeFilter(weapons, () => 'standard');
  assert.strictEqual(filtered.length, 2);
  assert.ok(filtered.some(w => w.name === 'Plasma incinerator'));
  assert.ok(filtered.some(w => w.name === 'Bolter'));
  assert.ok(!filtered.some(w => isOverchargeProfile(w.name)));
});

test('applyOverchargeFilter overcharge choice: keeps overcharge, drops standard', () => {
  const weapons = [
    { name: 'Plasma incinerator', kind: 'ranged' },
    { name: 'Plasma incinerator – supercharge', kind: 'ranged' },
    { name: 'Bolter', kind: 'ranged' },
  ];
  const filtered = applyOverchargeFilter(weapons, () => 'overcharge');
  assert.strictEqual(filtered.length, 2);
  assert.ok(filtered.some(w => w.name === 'Plasma incinerator – supercharge'));
  assert.ok(filtered.some(w => w.name === 'Bolter'));
});

test('applyOverchargeFilter per-weapon choices', () => {
  const weapons = [
    { name: 'Plasma incinerator', kind: 'ranged' },
    { name: 'Plasma incinerator – supercharge', kind: 'ranged' },
    { name: 'Plasma pistol', kind: 'ranged' },
    { name: 'Plasma pistol – supercharge', kind: 'ranged' },
  ];
  const choiceFor = (base) => base === 'plasma incinerator' ? 'overcharge' : 'standard';
  const filtered = applyOverchargeFilter(weapons, choiceFor);
  assert.strictEqual(filtered.length, 2);
  assert.ok(filtered.some(w => w.name === 'Plasma incinerator – supercharge'));
  assert.ok(filtered.some(w => w.name === 'Plasma pistol'));
});

test('applyOverchargeFilter passes solo profiles through unchanged', () => {
  const weapons = [
    { name: 'Plasma pistol – supercharge', kind: 'ranged' }, // unpaired
    { name: 'Bolter', kind: 'ranged' },
  ];
  const filtered = applyOverchargeFilter(weapons, () => 'standard');
  assert.strictEqual(filtered.length, 2); // both kept — unpaired weapons are not filtered
});

test('OVERCHARGE_RE is case-insensitive and tolerant of separators', () => {
  assert.match('X – SUPERCHARGE', OVERCHARGE_RE);
  assert.match('X-supercharge', OVERCHARGE_RE);
  assert.match('X — Overcharge', OVERCHARGE_RE);
  assert.doesNotMatch('Supercharge X', OVERCHARGE_RE); // suffix only
});
