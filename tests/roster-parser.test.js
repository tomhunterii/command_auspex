import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseRoster, slugify, resolveSlug } from '../app/lib/roster-parser.js';

const SAMPLE = readFileSync(
  new URL('./fixtures/sample-roster.txt', import.meta.url),
  'utf8'
);

test('parseRoster extracts list-level metadata', () => {
  const r = parseRoster(SAMPLE);
  assert.strictEqual(r.list_name, 'Purge and Burn');
  assert.strictEqual(r.list_points, 2000);
  assert.strictEqual(r.faction, 'Space Marines');
  assert.strictEqual(r.subfaction, 'Ultramarines');
  assert.strictEqual(r.detachment, 'Orbital Assault Force');
  assert.strictEqual(r.battle_size_name, 'Strike Force');
  assert.strictEqual(r.max_points, 2000);
  assert.match(r.app_version, /v1\.51\.1/);
  assert.strictEqual(r.data_version, 'v767');
});

test('parseRoster finds all 16 units', () => {
  const r = parseRoster(SAMPLE);
  assert.strictEqual(r.units.length, 16);
});

test('parseRoster captures Warlord flag on Captain Titus', () => {
  const r = parseRoster(SAMPLE);
  const titus = r.units.find(u => u.name === 'Captain Titus');
  assert.ok(titus);
  assert.strictEqual(titus.warlord, true);
  assert.strictEqual(titus.points, 90);
});

test('parseRoster captures Enhancement on Apothecary Biologis (plural form "Enhancements:")', () => {
  const r = parseRoster(SAMPLE);
  const bio = r.units.find(u => u.name === 'Apothecary Biologis');
  assert.ok(bio);
  assert.strictEqual(bio.enhancement, 'Laurels of Thunder');
});

test('parseRoster models multi-model squads (Aggressor) with sergeant + body', () => {
  const r = parseRoster(SAMPLE);
  const agg = r.units.find(u => u.name === 'Aggressor Squad');
  assert.strictEqual(agg.total_models, 6);
  assert.strictEqual(agg.models.length, 2);
  assert.strictEqual(agg.models[0].submodel, 'Aggressor Sergeant');
  assert.strictEqual(agg.models[0].count, 1);
  assert.strictEqual(agg.models[1].submodel, 'Aggressor');
  assert.strictEqual(agg.models[1].count, 5);
});

test('parseRoster handles mixed loadouts (Sternguard with 7x bolt rifle + 2x heavy bolter)', () => {
  const r = parseRoster(SAMPLE);
  const stern = r.units.find(u => u.name === 'Sternguard Veteran Squad');
  const vetBody = stern.models.find(m => m.submodel === 'Sternguard Veteran');
  assert.strictEqual(vetBody.count, 9);
  const hasBoltRifle = vetBody.wargear.some(w => w.item === 'Sternguard bolt rifle' && w.count === 7);
  const hasHeavyBolter = vetBody.wargear.some(w => w.item === 'Sternguard heavy bolter' && w.count === 2);
  assert.ok(hasBoltRifle);
  assert.ok(hasHeavyBolter);
});

test('parseRoster handles named-model squads (Wardens: 6 distinct models)', () => {
  const r = parseRoster(SAMPLE);
  const wardens = r.units.find(u => u.name === 'Wardens of Ultramar');
  assert.strictEqual(wardens.total_models, 6);
  assert.strictEqual(wardens.models.length, 6);
  const names = wardens.models.map(m => m.submodel);
  assert.ok(names.includes('Ancient Gadriel'));
  assert.ok(names.includes('Veteran Sergeant Metaurus'));
  assert.ok(names.includes('Lucia Vestha'));
});

test('parseRoster sums unit points equal to list_points', () => {
  const r = parseRoster(SAMPLE);
  const sum = r.units.reduce((a, u) => a + u.points, 0);
  assert.strictEqual(sum, r.list_points);
});

test('parseRoster flags section per unit', () => {
  const r = parseRoster(SAMPLE);
  assert.strictEqual(r.units.find(u => u.name === 'Captain Titus').section, 'CHARACTERS');
  assert.strictEqual(r.units.find(u => u.name === 'Impulsor').section, 'DEDICATED TRANSPORTS');
  assert.strictEqual(r.units.find(u => u.name === 'Aggressor Squad').section, 'OTHER DATASHEETS');
});

// ── slugify ───────────────────────────────────────────────────────────────────

test('slugify: basic multi-word name', () => {
  assert.strictEqual(slugify('Aggressor Squad'), 'aggressor-squad');
});

test('slugify: apostrophes and punctuation', () => {
  assert.strictEqual(slugify("Bjorn the Fell-Handed"), 'bjorn-the-fell-handed');
});

test('slugify: all caps', () => {
  assert.strictEqual(slugify('CAPTAIN TITUS'), 'captain-titus');
});

test('slugify: collapses multiple non-word chars into single dash', () => {
  assert.strictEqual(slugify("Ol'  Knife--Master"), 'ol-knife-master');
});

test('slugify: trims leading and trailing dashes', () => {
  assert.strictEqual(slugify('  hello world  '), 'hello-world');
});

// ── resolveSlug ───────────────────────────────────────────────────────────────

test('resolveSlug: exact match', () => {
  const candidates = [
    { faction: 'space-marines', slug: 'aggressor-squad' },
    { faction: 'tyranids', slug: 'hormagaunt-brood' },
  ];
  assert.strictEqual(resolveSlug('Aggressor Squad', candidates), 'space-marines/aggressor-squad');
});

test('resolveSlug: -squad suffix stripping fallback', () => {
  // Hypothetical file named "aggressor.md" (slug "aggressor") with no "-squad" suffix
  const candidates = [
    { faction: 'space-marines', slug: 'aggressor' },
  ];
  assert.strictEqual(resolveSlug('Aggressor Squad', candidates), 'space-marines/aggressor');
});

test('resolveSlug: no match returns null', () => {
  const candidates = [
    { faction: 'space-marines', slug: 'intercessor-squad' },
  ];
  assert.strictEqual(resolveSlug('Lychguard', candidates), null);
});

test('resolveSlug: first-match-wins across factions', () => {
  const candidates = [
    { faction: 'space-marines', slug: 'terminator-squad' },
    { faction: 'chaos-space-marines', slug: 'terminator-squad' },
  ];
  assert.strictEqual(resolveSlug('Terminator Squad', candidates), 'space-marines/terminator-squad');
});

test('resolveSlug: exact match takes priority over stripped fallback', () => {
  // If both exact "aggressor-squad" and stripped "aggressor" exist, exact wins
  const candidates = [
    { faction: 'space-marines', slug: 'aggressor-squad' },
    { faction: 'space-marines', slug: 'aggressor' },
  ];
  assert.strictEqual(resolveSlug('Aggressor Squad', candidates), 'space-marines/aggressor-squad');
});

// ── GW Companion App "v2" continuation-line format (Beast Slayer roster) ────
// In this variant only the FIRST item in each wargear group keeps the bullet
// glyph; siblings appear at indent +2 of the bullet's content column with no
// glyph. A sergeant + body squad with multiple wargear types per submodel
// would previously: (a) silently drop the continuation lines, AND (b) cause
// the block-collection loop to terminate early on the first 6-space line,
// losing the rest of the unit. Both must now parse correctly.

const BEAST_SLAYER = readFileSync(
  new URL('./fixtures/beast-slayer-roster.txt', import.meta.url),
  'utf8'
);

test('beast-slayer: header parses (New Recruit format)', () => {
  const r = parseRoster(BEAST_SLAYER);
  assert.strictEqual(r.list_points, 2000);
  assert.strictEqual(r.faction, 'Space Marines');
  assert.strictEqual(r.subfaction, 'Space Wolves');
  assert.strictEqual(r.detachment, 'Saga of the Beastslayer');
});

test('beast-slayer: all 15 units found', () => {
  const r = parseRoster(BEAST_SLAYER);
  assert.strictEqual(r.units.length, 15);
});

test('beast-slayer: single-model unit (Bjorn) gets all 3 wargear items, not just the first', () => {
  const r = parseRoster(BEAST_SLAYER);
  const bjorn = r.units.find(u => u.name === 'Bjorn the Fell-Handed');
  assert.ok(bjorn, 'Bjorn unit not found');
  assert.strictEqual(bjorn.total_models, 1);
  const items = bjorn.models[0].wargear.map(w => w.item);
  assert.deepStrictEqual(
    items.sort(),
    ['Heavy flamer', 'Helfrost cannon', 'Trueclaw'].sort()
  );
});

test('beast-slayer: multi-model squad (Wolf Guard Terminators) parses both submodels with full wargear', () => {
  const r = parseRoster(BEAST_SLAYER);
  const wgt = r.units.find(u => u.name === 'Wolf Guard Terminators');
  assert.ok(wgt, 'Wolf Guard Terminators unit not found');
  // 1 sergeant + 9 body = 10 total models. Previously parser stopped at 1.
  assert.strictEqual(wgt.total_models, 10);
  assert.strictEqual(wgt.models.length, 2);

  const sergeant = wgt.models.find(m => m.submodel === 'Wolf Guard Terminator Pack Leader');
  assert.ok(sergeant);
  assert.strictEqual(sergeant.count, 1);

  const body = wgt.models.find(m => m.submodel === 'Wolf Guard Terminator');
  assert.ok(body);
  assert.strictEqual(body.count, 9);
  // Body submodel had 4 wargear types (assault cannon, MC power weapon,
  // power fist, storm shield) — previously only the first survived.
  const bodyItems = body.wargear.map(w => w.item).sort();
  assert.deepStrictEqual(
    bodyItems,
    ['Assault cannon', 'Master-crafted power weapon', 'Power fist', 'Storm Shield'].sort()
  );
});

test('beast-slayer: 10-model squad with mixed wargear (Infernus) survives intact', () => {
  const r = parseRoster(BEAST_SLAYER);
  const inf = r.units.find(u => u.name === 'Infernus Squad');
  assert.ok(inf);
  assert.strictEqual(inf.total_models, 10);
  const body = inf.models.find(m => m.submodel === 'Infernus Marine');
  assert.strictEqual(body.count, 9);
  assert.strictEqual(body.wargear.length, 3);
});

test('beast-slayer: enhancement on Wolf Guard Battle Leader captured', () => {
  const r = parseRoster(BEAST_SLAYER);
  const wgbl = r.units.find(u => u.name === 'Wolf Guard Battle Leader');
  assert.ok(wgbl);
  assert.strictEqual(wgbl.enhancement, "Elder's Guidance");
});

test('beast-slayer: warlord flag captured on Logan Grimnar', () => {
  const r = parseRoster(BEAST_SLAYER);
  const logan = r.units.find(u => u.name === 'Logan Grimnar');
  assert.ok(logan);
  assert.strictEqual(logan.warlord, true);
});

// ── Integration: parseRoster + resolveSlug against real datasheets/ ───────────

test('integration: at least 10 of 16 Norallus units resolve against real datasheets/space-marines/units/', () => {
  const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../..');
  const unitsDir = path.join(repoRoot, 'datasheets', 'space-marines', 'units');
  const files = readdirSync(unitsDir).filter(f => f.endsWith('.md'));
  const candidates = files.map(f => ({ faction: 'space-marines', slug: f.replace(/\.md$/, '') }));

  const r = parseRoster(SAMPLE);
  const resolved = r.units.filter(u => resolveSlug(u.name, candidates) !== null);
  assert.ok(resolved.length >= 10, `Only ${resolved.length}/16 units resolved; expected >= 10`);
});
