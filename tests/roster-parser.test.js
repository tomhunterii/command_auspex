import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseRoster, slugify, resolveSlug } from '../app/lib/roster-parser.js';

const SAMPLE = readFileSync(
  new URL('../ultramarines/rosters/norallus-purge-and-burn.txt', import.meta.url),
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
