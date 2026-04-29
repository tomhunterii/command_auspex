import { test } from 'node:test';
import assert from 'node:assert';
import { mergeLeaderGrants } from '../app/lib/leader-grants.js';

const baseWeapon = (name, abilities = {}) => ({
  name, kind: 'ranged', range_in: 24,
  attacks: '1', skill: '3+', strength: 4, ap: 0, damage: '1',
  abilities: { ...abilities },
});

const titus = {
  slug: 'captain-demetrian-titus',
  grants: {
    modifiers: { reroll_hits: 'ones' },
    weapon_abilities: { sustained_hits: 1 },
  },
};

test('mergeLeaderGrants: no leaders → attacker unchanged', () => {
  const attacker = { weapons: [baseWeapon('rifle')], modifiers: {} };
  const out = mergeLeaderGrants(attacker, []);
  assert.strictEqual(out, attacker);
});

test('mergeLeaderGrants: leader without grants is skipped', () => {
  const attacker = { weapons: [baseWeapon('rifle')], modifiers: {} };
  const captain = { slug: 'captain' }; // no grants
  const out = mergeLeaderGrants(attacker, [captain]);
  assert.strictEqual(out, attacker);
});

test('mergeLeaderGrants: applies modifier and weapon_abilities to every weapon', () => {
  const attacker = {
    weapons: [baseWeapon('Bolt rifle'), baseWeapon('Heavy bolter')],
    modifiers: {},
  };
  const out = mergeLeaderGrants(attacker, [titus]);
  assert.strictEqual(out.modifiers.reroll_hits, 'ones');
  for (const w of out.weapons) {
    assert.strictEqual(w.abilities.sustained_hits, 1);
  }
});

test('mergeLeaderGrants: first-wins — does not overwrite stronger weapon ability', () => {
  // Sternguard heavy bolter prints [SUSTAINED HITS 1] on its own profile.
  // Titus's grant should NOT downgrade or duplicate; existing value wins.
  const w = baseWeapon('Sternguard heavy bolter', { sustained_hits: 1 });
  const attacker = { weapons: [w], modifiers: {} };
  const out = mergeLeaderGrants(attacker, [titus]);
  assert.strictEqual(out.weapons[0].abilities.sustained_hits, 1);
});

test('mergeLeaderGrants: existing modifier preserved when leader grants the same key', () => {
  const attacker = {
    weapons: [baseWeapon('rifle')],
    modifiers: { reroll_hits: 'all' }, // already stronger than 'ones'
  };
  const out = mergeLeaderGrants(attacker, [titus]);
  assert.strictEqual(out.modifiers.reroll_hits, 'all');
});

test('mergeLeaderGrants: accepts wrapped { unit, equippedCounts } leaders', () => {
  const attacker = { weapons: [baseWeapon('rifle')], modifiers: {} };
  const wrapped = { unit: titus, equippedCounts: new Map() };
  const out = mergeLeaderGrants(attacker, [wrapped]);
  assert.strictEqual(out.modifiers.reroll_hits, 'ones');
  assert.strictEqual(out.weapons[0].abilities.sustained_hits, 1);
});

test('mergeLeaderGrants: stacks across multiple leaders, first-wins per key', () => {
  const leader1 = { grants: { modifiers: { reroll_hits: 'ones' } } };
  const leader2 = { grants: { modifiers: { reroll_hits: 'all', plus_one_to_wound: true } } };
  const attacker = { weapons: [], modifiers: {} };
  const out = mergeLeaderGrants(attacker, [leader1, leader2]);
  // leader1 set reroll_hits='ones' first; leader2's 'all' does not overwrite.
  assert.strictEqual(out.modifiers.reroll_hits, 'ones');
  // leader2's plus_one_to_wound is new — gets in.
  assert.strictEqual(out.modifiers.plus_one_to_wound, true);
});
