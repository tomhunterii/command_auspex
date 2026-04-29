import { test } from 'node:test';
import assert from 'node:assert';
import { findMeleeChoices, applyMeleeSelection } from '../app/lib/melee-selection.js';

const ranged = (name) => ({ name, kind: 'ranged', abilities: {} });
const melee  = (name, abilities = {}) => ({ name, kind: 'melee', abilities });

test('findMeleeChoices: empty pool → empty map', () => {
  assert.strictEqual(findMeleeChoices([]).size, 0);
  assert.strictEqual(findMeleeChoices(null).size, 0);
});

test('findMeleeChoices: single melee weapon → 1 entry', () => {
  const m = findMeleeChoices([ranged('bolter'), melee('chainsword')]);
  assert.strictEqual(m.size, 1);
  assert.ok(m.has('chainsword'));
});

test('findMeleeChoices: EXTRA ATTACKS melee is excluded from choices', () => {
  // Carnifex carries scything talons (chooseable) + extra scything talons
  // ([EXTRA ATTACKS] — always stacks). Only the primary is a choice.
  const m = findMeleeChoices([
    melee('Carnifex scything talons'),
    melee('Carnifex extra scything talons', { extra_attacks: true }),
  ]);
  assert.strictEqual(m.size, 1);
  assert.ok(m.has('carnifex scything talons'));
  assert.ok(!m.has('carnifex extra scything talons'));
});

test('findMeleeChoices: 2 distinct melee → 2 entries', () => {
  // Hive Tyrant default: bonesword-and-lash-whip + monstrous scything talons.
  const m = findMeleeChoices([
    melee('Monstrous bonesword and lash whip', { twin_linked: true }),
    melee('Monstrous scything talons'),
  ]);
  assert.strictEqual(m.size, 2);
});

test('applyMeleeSelection: 0 or 1 melee → pass-through', () => {
  const single = [ranged('bolter'), melee('chainsword')];
  assert.deepStrictEqual(applyMeleeSelection(single, null), single);
  assert.deepStrictEqual(applyMeleeSelection(single, 'chainsword'), single);
});

test('applyMeleeSelection: null selection → pass-through (UI not picked yet)', () => {
  const pool = [
    melee('Monstrous bonesword and lash whip'),
    melee('Monstrous scything talons'),
  ];
  assert.deepStrictEqual(applyMeleeSelection(pool, null), pool);
  assert.deepStrictEqual(applyMeleeSelection(pool, ''), pool);
});

test('applyMeleeSelection: keeps the picked melee, drops the others', () => {
  const pool = [
    ranged('bolter'),
    melee('Monstrous bonesword and lash whip'),
    melee('Monstrous scything talons'),
  ];
  const filtered = applyMeleeSelection(pool, 'monstrous scything talons');
  assert.deepStrictEqual(filtered.map(w => w.name), [
    'bolter',
    'Monstrous scything talons',
  ]);
});

test('applyMeleeSelection: EXTRA ATTACKS weapon always survives', () => {
  // Norn Emissary: monstrous scything talons (chooseable) + monstrous
  // rending claws ([EXTRA ATTACKS] — always stack). Pick talons; both
  // talons and claws should remain.
  const pool = [
    ranged('Psychic Tendril'),
    melee('Monstrous scything talons'),
    melee('Monstrous rending claws', { extra_attacks: true }),
  ];
  const filtered = applyMeleeSelection(pool, 'monstrous scything talons');
  assert.deepStrictEqual(filtered.map(w => w.name), [
    'Psychic Tendril',
    'Monstrous scything talons',
    'Monstrous rending claws',
  ]);
});

test('applyMeleeSelection: case + whitespace insensitive', () => {
  const pool = [
    melee('Monstrous bonesword and lash whip'),
    melee('Monstrous scything talons'),
  ];
  const filtered = applyMeleeSelection(pool, '  MONSTROUS Scything Talons  ');
  assert.deepStrictEqual(filtered.map(w => w.name), ['Monstrous scything talons']);
});

test('applyMeleeSelection: unknown selection drops every selectable melee', () => {
  // Edge case: selection points to a weapon not in the pool. We strip every
  // selectable melee — caller passed an invalid name, the UI will likely
  // re-render with no melee until a valid choice is made.
  const pool = [
    melee('Monstrous bonesword and lash whip'),
    melee('Monstrous scything talons'),
    melee('Monstrous rending claws', { extra_attacks: true }),
  ];
  const filtered = applyMeleeSelection(pool, 'nonexistent weapon');
  assert.deepStrictEqual(filtered.map(w => w.name), ['Monstrous rending claws']);
});
