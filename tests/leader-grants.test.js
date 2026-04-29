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

// --- per-kind weapon ability filtering ---

const titusRangedOnly = {
  slug: 'captain-demetrian-titus',
  grants: {
    weapon_abilities_ranged: { sustained_hits: 1 },
  },
};

test('mergeLeaderGrants: weapon_abilities_ranged lands on ranged weapons only', () => {
  const ranged = baseWeapon('Bolt rifle');
  const melee  = { ...baseWeapon('Combat knife'), kind: 'melee' };
  const attacker = { weapons: [ranged, melee], modifiers: {} };
  const out = mergeLeaderGrants(attacker, [titusRangedOnly]);
  assert.strictEqual(out.weapons[0].abilities.sustained_hits, 1, 'ranged got SH 1');
  assert.strictEqual(out.weapons[1].abilities.sustained_hits, undefined, 'melee did NOT');
});

test('mergeLeaderGrants: weapon_abilities_melee lands on melee weapons only', () => {
  const meleeBuff = { grants: { weapon_abilities_melee: { lethal_hits: true } } };
  const ranged = baseWeapon('Bolt rifle');
  const melee  = { ...baseWeapon('Power weapon'), kind: 'melee' };
  const attacker = { weapons: [ranged, melee], modifiers: {} };
  const out = mergeLeaderGrants(attacker, [meleeBuff]);
  assert.strictEqual(out.weapons[0].abilities.lethal_hits, undefined, 'ranged did NOT');
  assert.strictEqual(out.weapons[1].abilities.lethal_hits, true, 'melee got LH');
});

test('mergeLeaderGrants: weapon_abilities (all-kinds) still applies to both', () => {
  // Back-compat: the original schema key carries grants for any kind.
  // Used by Lieutenant Tactical Precision and Apothecary Biologis Surgical
  // Precision, both of which print "[LETHAL HITS]" with no kind filter.
  const liutPrecision = { grants: { weapon_abilities: { lethal_hits: true } } };
  const ranged = baseWeapon('Bolt rifle');
  const melee  = { ...baseWeapon('Power weapon'), kind: 'melee' };
  const attacker = { weapons: [ranged, melee], modifiers: {} };
  const out = mergeLeaderGrants(attacker, [liutPrecision]);
  assert.strictEqual(out.weapons[0].abilities.lethal_hits, true, 'ranged got LH');
  assert.strictEqual(out.weapons[1].abilities.lethal_hits, true, 'melee also got LH');
});

test('mergeLeaderGrants: ranged + melee + all-kinds blocks all stack on the same leader', () => {
  // Hypothetical leader that grants three different abilities, one per
  // scope. Each weapon picks up only the abilities applicable to its
  // kind, plus the all-kinds block.
  const triple = {
    grants: {
      weapon_abilities:        { devastating_wounds: true }, // all kinds
      weapon_abilities_ranged: { sustained_hits: 1 },
      weapon_abilities_melee:  { lethal_hits: true },
    },
  };
  const ranged = baseWeapon('Bolt rifle');
  const melee  = { ...baseWeapon('Power weapon'), kind: 'melee' };
  const out = mergeLeaderGrants({ weapons: [ranged, melee], modifiers: {} }, [triple]);
  // Ranged gets all-kinds + ranged-only.
  assert.strictEqual(out.weapons[0].abilities.devastating_wounds, true);
  assert.strictEqual(out.weapons[0].abilities.sustained_hits, 1);
  assert.strictEqual(out.weapons[0].abilities.lethal_hits, undefined);
  // Melee gets all-kinds + melee-only.
  assert.strictEqual(out.weapons[1].abilities.devastating_wounds, true);
  assert.strictEqual(out.weapons[1].abilities.lethal_hits, true);
  assert.strictEqual(out.weapons[1].abilities.sustained_hits, undefined);
});
