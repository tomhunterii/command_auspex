import { test } from 'node:test';
import assert from 'node:assert';
import { buildSimInputs } from '../app/lib/catalogue.js';

// Minimal getUnit()-shaped fixtures. Just enough for buildSimInputs to chew on.
function makeUnit({ slug = 'test-unit', weapons = [], loadouts = [{ model_count: 1, points: 0, is_default: 1 }] } = {}) {
  return {
    slug,
    name: slug,
    profile: { T: 4, Sv: '3+', InvSv: null, W: 1 },
    keywords: [],
    weapons,
    loadouts,
  };
}

const W = (name, kind, keywords = '') => ({
  name, kind, range_in: kind === 'melee' ? 0 : 24,
  attacks: '1', skill: '3+', strength: 4, ap: 0, damage: '1', keywords,
});

test('buildSimInputs: equippedCounts replicates each weapon by its count', () => {
  // Wardens-shaped fixture: 4 distinct weapons, each carried by a different
  // number of submodels. With equippedCounts the merged pool reflects the
  // actual per-submodel allocation, NOT loadouts[0].model_count.
  const wardens = makeUnit({
    slug: 'wardens-of-ultramar',
    loadouts: [{ model_count: 6, points: 90, is_default: 1 }],
    weapons: [
      W('Bolt rifle',           'ranged'),
      W('Heavy bolt pistol',    'ranged'),
      W('Archeotech laspistol', 'ranged'),
      W('Astropathic blast',    'ranged'),
    ],
  });
  const equippedCounts = new Map([
    ['bolt rifle', 1],
    ['heavy bolt pistol', 1],
    ['archeotech laspistol', 3],   // Silva, Minervas, Vestha
    ['astropathic blast', 1],
  ]);
  const { attacker } = buildSimInputs(wardens, {
    kind: 'ranged',
    attacker_model_count: 6, // intentionally provided; equippedCounts wins
    equippedCounts,
  });
  // Total 1+1+3+1 = 6 weapon entries (NOT 6 × 4 = 24 from naive replication).
  assert.strictEqual(attacker.weapons.length, 6);
  const counts = attacker.weapons.reduce((m, w) => {
    m.set(w.name, (m.get(w.name) ?? 0) + 1); return m;
  }, new Map());
  assert.strictEqual(counts.get('Bolt rifle'), 1);
  assert.strictEqual(counts.get('Heavy bolt pistol'), 1);
  assert.strictEqual(counts.get('Archeotech laspistol'), 3);
  assert.strictEqual(counts.get('Astropathic blast'), 1);
});

test('buildSimInputs: unknown weapon in equippedCounts contributes zero copies', () => {
  const u = makeUnit({ weapons: [W('Bolt rifle', 'ranged')] });
  const ec = new Map([['nonexistent', 99]]);
  const { attacker } = buildSimInputs(u, { kind: 'ranged', equippedCounts: ec });
  // The catalogue had Bolt rifle but ec says nothing about it → 0 copies.
  // Unknown 'nonexistent' is not in the catalogue weapon list → also 0.
  assert.strictEqual(attacker.weapons.length, 0);
});

test('buildSimInputs: legacy attacker_model_count path unchanged when no equippedCounts', () => {
  const u = makeUnit({ weapons: [W('Bolt rifle', 'ranged'), W('Bolt pistol', 'ranged')] });
  const { attacker } = buildSimInputs(u, { kind: 'ranged', attacker_model_count: 5 });
  // 2 weapons × 5 models = 10 entries.
  assert.strictEqual(attacker.weapons.length, 10);
});

test('buildSimInputs: per-leader equippedCounts via {unit, equippedCounts} wrapper', () => {
  const squad = makeUnit({
    weapons: [W('Bolt pistol', 'ranged')],
    loadouts: [{ model_count: 10, points: 100, is_default: 1 }],
  });
  const wardens = makeUnit({
    slug: 'wardens-of-ultramar',
    loadouts: [{ model_count: 6, points: 90, is_default: 1 }],
    weapons: [
      W('Bolt rifle', 'ranged'),
      W('Archeotech laspistol', 'ranged'),
    ],
  });
  const wardensEc = new Map([
    ['bolt rifle', 1],
    ['archeotech laspistol', 3],
  ]);
  const { attacker } = buildSimInputs(squad, {
    kind: 'ranged',
    attacker_model_count: 10,
    attachedLeaders: [{ unit: wardens, equippedCounts: wardensEc }],
  });
  // 10 squad bolt pistols + 1 bolt rifle + 3 laspistols = 14 entries.
  assert.strictEqual(attacker.weapons.length, 14);
});

test('buildSimInputs: bare-unit leader entry still works (legacy compat)', () => {
  const squad = makeUnit({
    weapons: [W('Bolt pistol', 'ranged')],
    loadouts: [{ model_count: 10, points: 100, is_default: 1 }],
  });
  const captain = makeUnit({
    slug: 'captain',
    loadouts: [{ model_count: 1, points: 80, is_default: 1 }],
    weapons: [W('Master-crafted bolter', 'ranged')],
  });
  const { attacker } = buildSimInputs(squad, {
    kind: 'ranged',
    attacker_model_count: 10,
    attachedLeaders: [captain],   // bare, not wrapped
  });
  // 10 bolt pistols + 1 master-crafted bolter = 11.
  assert.strictEqual(attacker.weapons.length, 11);
});

test('buildSimInputs: equippedCounts base-name fallback for multi-profile weapons', () => {
  // Catalogue stores Old One Eye-shaped multi-profile melee as two rows
  // ("Foo – strike", "Foo – sweep"). The roster equips the BASE weapon
  // ("Foo") once — the lookup must fall back from the profile-suffixed
  // catalogue name to the base name in equippedCounts and emit BOTH
  // profiles into the merged pool (the melee-selection filter then
  // picks one per turn).
  const u = makeUnit({
    weapons: [
      W('Massive scything talons – strike', 'melee'),
      W('Massive scything talons – sweep',  'melee'),
      W('Psychic overload – blast',         'ranged'),
      // A non-profile weapon whose name happens to contain a dash should
      // NOT match a base-name lookup and stays at 0 copies if absent.
      W('Some-Other Weapon', 'ranged'),
    ],
  });
  const ec = new Map([
    ['massive scything talons', 1],
    ['psychic overload',        1],
  ]);
  const { attacker } = buildSimInputs(u, { kind: 'all', equippedCounts: ec });
  const names = attacker.weapons.map(w => w.name).sort();
  assert.deepStrictEqual(names, [
    'Massive scything talons – strike',
    'Massive scything talons – sweep',
    'Psychic overload – blast',
  ]);
});

test('buildSimInputs: equippedCounts strips parenthetical annotation in fallback', () => {
  // Catalogue annotates with "(twin-linked)"; roster drops it.
  const u = makeUnit({
    weapons: [
      W('Monstrous bonesword and lash whip (twin-linked)', 'melee'),
      W('Monstrous scything talons', 'melee'),
    ],
  });
  const ec = new Map([
    ['monstrous bonesword and lash whip', 1],
    ['monstrous scything talons', 1],
  ]);
  const { attacker } = buildSimInputs(u, { kind: 'all', equippedCounts: ec });
  assert.strictEqual(attacker.weapons.length, 2);
});

test('buildSimInputs: equippedCounts exact match takes precedence over base-name fallback', () => {
  // If the roster happens to list the full profile-suffixed name, that
  // exact entry must win — base-name fallback only kicks in on miss.
  const u = makeUnit({
    weapons: [
      W('Massive scything talons – strike', 'melee'),
      W('Massive scything talons – sweep',  'melee'),
    ],
  });
  const ec = new Map([
    ['massive scything talons – strike', 2], // exact wins
    ['massive scything talons',          0], // would otherwise emit 0 — no override
  ]);
  const { attacker } = buildSimInputs(u, { kind: 'all', equippedCounts: ec });
  // Strike: 2 copies (exact match). Sweep: tries exact (miss), tries base
  // (matches "massive scything talons" → 0) — emits 0.
  const names = attacker.weapons.map(w => w.name);
  assert.strictEqual(names.filter(n => n.includes('strike')).length, 2);
  assert.strictEqual(names.filter(n => n.includes('sweep')).length, 0);
});

test('buildSimInputs: defenderLeader populates the defender.leader sub-object', () => {
  // Sternguard squad (T4 3+ Sv 2W) led by Captain Titus (T4 3+ Sv 4+ Inv 6W).
  // The combat engine reads defender.leader.* for PRECISION routing.
  const sternguard = {
    slug: 'sternguard-veteran-squad',
    name: 'Sternguard Veteran Squad',
    profile: { T: 4, Sv: '3+', InvSv: null, W: 2 },
    keywords: [
      { keyword: 'INFANTRY', is_faction: 0 },
      { keyword: 'ADEPTUS ASTARTES', is_faction: 1 },
    ],
    weapons: [],
    loadouts: [{ model_count: 10, points: 200, is_default: 1 }],
  };
  const titus = {
    slug: 'captain-titus',
    name: 'Captain Titus',
    profile: { T: 4, Sv: '3+', InvSv: '4+', W: 6 },
    keywords: [
      { keyword: 'INFANTRY', is_faction: 0 },
      { keyword: 'CHARACTER', is_faction: 0 },
      { keyword: 'EPIC HERO', is_faction: 0 },
    ],
    weapons: [],
    loadouts: [{ model_count: 1, points: 90, is_default: 1 }],
  };
  const { defender } = buildSimInputs(sternguard, {
    kind: 'all',
    model_count: 10,
    defenderLeader: { unit: titus },
  });
  // Bodyguard stats unchanged.
  assert.strictEqual(defender.toughness, 4);
  assert.strictEqual(defender.save, '3+');
  assert.strictEqual(defender.wounds_per_model, 2);
  assert.strictEqual(defender.model_count, 10);
  // Leader sub-object populated with leader's stats.
  assert.ok(defender.leader, 'defender.leader should be present');
  assert.strictEqual(defender.leader.invulnerable, '4+');
  assert.strictEqual(defender.leader.wounds_per_model, 6);
  // Keyword union: bodyguard's INFANTRY/AA + leader's CHARACTER/EPIC HERO.
  assert.ok(defender.keywords.includes('INFANTRY'));
  assert.ok(defender.keywords.includes('ADEPTUS ASTARTES'));
  assert.ok(defender.keywords.includes('CHARACTER'));
  assert.ok(defender.keywords.includes('EPIC HERO'));
});

test('buildSimInputs: no defenderLeader → defender.leader undefined (back-compat)', () => {
  const sternguard = {
    slug: 'sternguard-veteran-squad',
    profile: { T: 4, Sv: '3+', InvSv: null, W: 2 },
    keywords: [],
    weapons: [],
    loadouts: [{ model_count: 10, points: 200, is_default: 1 }],
  };
  const { defender } = buildSimInputs(sternguard, { kind: 'all', model_count: 10 });
  assert.strictEqual(defender.leader, undefined);
});

test('buildSimInputs: leader weapons fire alongside the squad (ranged)', () => {
  // Aggressor Squad + Apothecary Biologis: when the captain selects RANGED,
  // the squad's ranged weapons + the leader's ranged weapons (Absolvor bolt
  // pistol) all enter the merged weapon pool. Leader's melee (Close combat
  // weapon) is filtered out by the kind=ranged gate.
  const aggressors = makeUnit({
    slug: 'aggressor-squad',
    weapons: [
      W('Auto boltstorm gauntlets',     'ranged'),
      W('Fragstorm grenade launcher',   'ranged'),
      W('Twin power fists',             'melee'),
    ],
    loadouts: [{ model_count: 6, points: 190, is_default: 1 }],
  });
  const biologis = makeUnit({
    slug: 'apothecary-biologis',
    weapons: [
      W('Absolvor bolt pistol', 'ranged'),
      W('Close combat weapon',  'melee'),
    ],
    loadouts: [{ model_count: 1, points: 70, is_default: 1 }],
  });
  const aggrEc = new Map([
    ['auto boltstorm gauntlets',   6],
    ['fragstorm grenade launcher', 6],
    ['twin power fists',           6],
  ]);
  const { attacker } = buildSimInputs(aggressors, {
    kind: 'ranged',
    attacker_model_count: 6,
    equippedCounts: aggrEc,
    attachedLeaders: [{ unit: biologis, equippedCounts: null }],
  });
  const names = attacker.weapons.map(w => w.name);
  // Squad ranged weapons present at correct counts.
  assert.strictEqual(names.filter(n => n === 'Auto boltstorm gauntlets').length, 6);
  assert.strictEqual(names.filter(n => n === 'Fragstorm grenade launcher').length, 6);
  // Leader's ranged weapon ALSO present — falls back to leader.loadouts[0]
  // .model_count (=1) when no per-leader equippedCounts is supplied.
  assert.strictEqual(names.filter(n => n === 'Absolvor bolt pistol').length, 1);
  // Melee weapons (squad twin power fists, leader close combat weapon) are
  // gated out by kind=ranged.
  assert.strictEqual(names.filter(n => n === 'Twin power fists').length, 0);
  assert.strictEqual(names.filter(n => n === 'Close combat weapon').length, 0);
});

test('buildSimInputs: leader weapons fire alongside the squad (melee)', () => {
  // Same Aggressor + Biologis pair, but kind=melee — twin power fists (×6)
  // and the leader's close combat weapon both enter the pool; ranged drops.
  const aggressors = makeUnit({
    slug: 'aggressor-squad',
    weapons: [
      W('Auto boltstorm gauntlets',     'ranged'),
      W('Twin power fists',             'melee'),
    ],
    loadouts: [{ model_count: 6, points: 190, is_default: 1 }],
  });
  const biologis = makeUnit({
    slug: 'apothecary-biologis',
    weapons: [
      W('Absolvor bolt pistol', 'ranged'),
      W('Close combat weapon',  'melee'),
    ],
    loadouts: [{ model_count: 1, points: 70, is_default: 1 }],
  });
  const aggrEc = new Map([
    ['auto boltstorm gauntlets', 6],
    ['twin power fists',         6],
  ]);
  const { attacker } = buildSimInputs(aggressors, {
    kind: 'melee',
    attacker_model_count: 6,
    equippedCounts: aggrEc,
    attachedLeaders: [{ unit: biologis, equippedCounts: null }],
  });
  const names = attacker.weapons.map(w => w.name);
  assert.strictEqual(names.filter(n => n === 'Twin power fists').length, 6);
  assert.strictEqual(names.filter(n => n === 'Close combat weapon').length, 1);
  assert.strictEqual(names.filter(n => n === 'Auto boltstorm gauntlets').length, 0);
  assert.strictEqual(names.filter(n => n === 'Absolvor bolt pistol').length, 0);
});

test('buildSimInputs: defender invulnerable save flows through', () => {
  const tyrant = {
    slug: 'hive-tyrant', name: 'Hive Tyrant',
    profile: { T: 10, Sv: '2+', InvSv: '4+', W: 10 },
    keywords: [],
    weapons: [],
    loadouts: [{ model_count: 1, points: 195, is_default: 1 }],
  };
  const { defender } = buildSimInputs(tyrant, { kind: 'all', model_count: 1 });
  assert.strictEqual(defender.toughness, 10);
  assert.strictEqual(defender.save, '2+');
  assert.strictEqual(defender.invulnerable, '4+');
  assert.strictEqual(defender.wounds_per_model, 10);
});
