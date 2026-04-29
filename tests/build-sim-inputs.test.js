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
