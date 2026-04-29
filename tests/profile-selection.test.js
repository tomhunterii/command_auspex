import { test } from 'node:test';
import assert from 'node:assert';
import {
  canonicalBase, profileSuffix, isOverchargeProfile,
  findWeaponProfiles, defaultProfile, applyProfileSelection,
} from '../app/lib/profile-selection.js';

const W = (name, kind = 'ranged', abilities = {}) => ({ name, kind, abilities });

// --- canonicalBase / profileSuffix ---

test('canonicalBase: bare name → lowercased trimmed self', () => {
  assert.strictEqual(canonicalBase('Bolt rifle'), 'bolt rifle');
});

test('canonicalBase: strips profile suffix', () => {
  assert.strictEqual(canonicalBase('Plasma incinerator – supercharge'), 'plasma incinerator');
  assert.strictEqual(canonicalBase("Old One Eye's claws and talons – strike"), "old one eye's claws and talons");
  assert.strictEqual(canonicalBase('Warp Blast – witchfire'), 'warp blast');
});

test('canonicalBase: strips parenthetical annotation', () => {
  assert.strictEqual(canonicalBase('Monstrous bonesword and lash whip (twin-linked)'), 'monstrous bonesword and lash whip');
});

test('canonicalBase: strips both parens AND profile suffix', () => {
  assert.strictEqual(canonicalBase('Foo (twin-linked) – strike'), 'foo');
});

test('profileSuffix: returns null for unsuffixed weapon', () => {
  assert.strictEqual(profileSuffix('Bolt rifle'), null);
  assert.strictEqual(profileSuffix('Plasma incinerator'), null);
});

test('profileSuffix: returns the suffix word for suffixed weapon', () => {
  assert.strictEqual(profileSuffix('Plasma incinerator – supercharge'), 'supercharge');
  assert.strictEqual(profileSuffix('Warp Blast – witchfire'), 'witchfire');
  assert.strictEqual(profileSuffix("Old One Eye's claws and talons – sweep"), 'sweep');
});

test('isOverchargeProfile: matches supercharge / overcharge variants', () => {
  assert.strictEqual(isOverchargeProfile('Plasma incinerator – supercharge'), true);
  assert.strictEqual(isOverchargeProfile('Plasma pistol – overcharge'), true);
  assert.strictEqual(isOverchargeProfile('Plasma incinerator'), false);
  assert.strictEqual(isOverchargeProfile('Warp Blast – focused'), false);
});

// --- findWeaponProfiles ---

test('findWeaponProfiles: empty / single-profile pools return empty map', () => {
  assert.strictEqual(findWeaponProfiles([]).size, 0);
  assert.strictEqual(findWeaponProfiles([W('Bolt rifle')]).size, 0);
});

test('findWeaponProfiles: groups plasma standard + supercharge as one', () => {
  const groups = findWeaponProfiles([
    W('Plasma incinerator', 'ranged'),
    W('Plasma incinerator – supercharge', 'ranged'),
  ]);
  assert.strictEqual(groups.size, 1);
  assert.ok(groups.has('plasma incinerator'));
  assert.strictEqual(groups.get('plasma incinerator').length, 2);
});

test('findWeaponProfiles: groups multi-profile melee (strike vs sweep)', () => {
  const groups = findWeaponProfiles([
    W("Old One Eye's claws and talons – strike", 'melee'),
    W("Old One Eye's claws and talons – sweep", 'melee'),
  ]);
  assert.strictEqual(groups.size, 1);
  assert.ok(groups.has("old one eye's claws and talons"));
});

test('findWeaponProfiles: groups multi-profile ranged (witchfire vs focused)', () => {
  const groups = findWeaponProfiles([
    W('Warp Blast – witchfire', 'ranged'),
    W('Warp Blast – focused', 'ranged'),
  ]);
  assert.strictEqual(groups.size, 1);
  assert.ok(groups.has('warp blast'));
});

test('findWeaponProfiles: groups 3-profile weapon (Norn Emissary Tendril)', () => {
  const groups = findWeaponProfiles([
    W('Psychic Tendril – neuroparasite', 'ranged'),
    W('Psychic Tendril – neuroblast', 'ranged'),
    W('Psychic Tendril – neurolance', 'ranged'),
  ]);
  assert.strictEqual(groups.size, 1);
  assert.strictEqual(groups.get('psychic tendril').length, 3);
});

test('findWeaponProfiles: EXTRA ATTACKS weapons are NEVER profile candidates', () => {
  // Carnifex extra scything talons stacks on top of whichever primary
  // fires — must not appear as a pick option.
  const groups = findWeaponProfiles([
    W('Carnifex scything talons', 'melee'),
    W('Carnifex extra scything talons', 'melee', { extra_attacks: true }),
  ]);
  // Different base names → no group has >1 entry → empty map.
  assert.strictEqual(groups.size, 0);
});

test('findWeaponProfiles: single weapon with same base does not produce a group', () => {
  // Without a sibling profile, a suffixed weapon stays a singleton.
  const groups = findWeaponProfiles([
    W('Heavy venom cannon – blast', 'ranged'),
    W('Stranglethorn cannon – blast', 'ranged'),
  ]);
  // Two different bases ("heavy venom cannon" + "stranglethorn cannon"),
  // each a singleton — neither qualifies as a profile pick.
  assert.strictEqual(groups.size, 0);
});

// --- defaultProfile ---

test('defaultProfile: unsuffixed wins over suffixed (plasma standard wins)', () => {
  const std = { weapon: {}, name: 'Plasma incinerator',                suffix: null };
  const oc  = { weapon: {}, name: 'Plasma incinerator – supercharge',  suffix: 'supercharge' };
  assert.strictEqual(defaultProfile([std, oc]), std);
  assert.strictEqual(defaultProfile([oc, std]), std);   // order-independent
});

test('defaultProfile: all-suffixed group falls back to insertion order', () => {
  const strike = { weapon: {}, name: 'Foo – strike', suffix: 'strike' };
  const sweep  = { weapon: {}, name: 'Foo – sweep',  suffix: 'sweep' };
  assert.strictEqual(defaultProfile([strike, sweep]), strike);
  assert.strictEqual(defaultProfile([sweep, strike]), sweep);
});

// --- applyProfileSelection ---

test('applyProfileSelection: pass-through for single-profile pools', () => {
  const pool = [W('Bolt rifle'), W('Heavy bolter')];
  assert.deepStrictEqual(applyProfileSelection(pool, () => null), pool);
});

test('applyProfileSelection: null choose → falls back to default (unsuffixed wins)', () => {
  const pool = [
    W('Plasma incinerator'),
    W('Plasma incinerator – supercharge'),
    W('Bolt pistol'),
  ];
  const filtered = applyProfileSelection(pool, () => null);
  assert.deepStrictEqual(filtered.map(w => w.name), ['Plasma incinerator', 'Bolt pistol']);
});

test('applyProfileSelection: choose by suffixed name → keeps that profile', () => {
  const pool = [
    W('Plasma incinerator'),
    W('Plasma incinerator – supercharge'),
  ];
  const filtered = applyProfileSelection(pool, () => 'Plasma incinerator – supercharge');
  assert.deepStrictEqual(filtered.map(w => w.name), ['Plasma incinerator – supercharge']);
});

test('applyProfileSelection: chooses by canonical base lookup', () => {
  // The chooseFor callback receives the canonical base (lowercased + stripped).
  const pool = [
    W('Warp Blast – witchfire'),
    W('Warp Blast – focused'),
  ];
  let calledWith = null;
  const filtered = applyProfileSelection(pool, base => {
    calledWith = base;
    return 'Warp Blast – focused';
  });
  assert.strictEqual(calledWith, 'warp blast');
  assert.deepStrictEqual(filtered.map(w => w.name), ['Warp Blast – focused']);
});

test('applyProfileSelection: EXTRA ATTACKS melee always stays', () => {
  // Even when a profile pick on a sibling weapon is active, the
  // [EXTRA ATTACKS] weapon survives unconditionally.
  const pool = [
    W('Carnifex scything talons', 'melee'),
    W('Carnifex extra scything talons', 'melee', { extra_attacks: true }),
    W('Plasma pistol'),
    W('Plasma pistol – supercharge'),
  ];
  const filtered = applyProfileSelection(pool, base =>
    base === 'plasma pistol' ? 'Plasma pistol – supercharge' : null
  );
  assert.deepStrictEqual(filtered.map(w => w.name), [
    'Carnifex scything talons',
    'Carnifex extra scything talons',
    'Plasma pistol – supercharge',
  ]);
});

test('applyProfileSelection: unknown choice falls through to default', () => {
  // The user passed a name that does not match any profile in the group —
  // we silently fall back to the default rather than dropping every profile.
  const pool = [
    W("Old One Eye's claws and talons – strike", 'melee'),
    W("Old One Eye's claws and talons – sweep", 'melee'),
  ];
  const filtered = applyProfileSelection(pool, () => 'something else entirely');
  assert.deepStrictEqual(filtered.map(w => w.name), [
    "Old One Eye's claws and talons – strike",
  ]);
});

test('applyProfileSelection: case + whitespace insensitive match', () => {
  const pool = [
    W('Warp Blast – witchfire'),
    W('Warp Blast – focused'),
  ];
  const filtered = applyProfileSelection(pool, () => '  WARP BLAST – FOCUSED  ');
  assert.deepStrictEqual(filtered.map(w => w.name), ['Warp Blast – focused']);
});

test('applyProfileSelection: multiple groups in the same pool, independent picks', () => {
  const pool = [
    W('Plasma incinerator'),
    W('Plasma incinerator – supercharge'),
    W('Warp Blast – witchfire'),
    W('Warp Blast – focused'),
    W('Bolt rifle'),
  ];
  const filtered = applyProfileSelection(pool, base => {
    if (base === 'plasma incinerator') return 'Plasma incinerator – supercharge';
    if (base === 'warp blast') return 'Warp Blast – focused';
    return null;
  });
  assert.deepStrictEqual(filtered.map(w => w.name), [
    'Plasma incinerator – supercharge',
    'Warp Blast – focused',
    'Bolt rifle',
  ]);
});
