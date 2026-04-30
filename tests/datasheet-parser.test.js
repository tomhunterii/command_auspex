import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { parseDatasheet } from '../app/lib/datasheet-parser.js';

function load(slug) {
  return readFileSync(
    new URL(`../datasheets/space-marines/units/${slug}.md`, import.meta.url),
    'utf8'
  );
}

test('parseDatasheet extracts base info from intercessor-squad', () => {
  const ds = parseDatasheet(load('intercessor-squad'));
  assert.deepStrictEqual(ds.base, { shape: 'round', diameter_mm: 32, flight_stem: false });
});

test('parseDatasheet extracts base info from ballistus-dreadnought', () => {
  const ds = parseDatasheet(load('ballistus-dreadnought'));
  assert.deepStrictEqual(ds.base, { shape: 'round', diameter_mm: 90, flight_stem: false });
});

test('parseDatasheet extracts oval base dimensions', () => {
  const text = readFileSync(
    new URL('../datasheets/tyranids/units/carnifexes.md', import.meta.url),
    'utf8'
  );
  const ds = parseDatasheet(text);
  assert.strictEqual(ds.base.shape, 'oval');
  assert.strictEqual(ds.base.length_mm, 105);
  assert.strictEqual(ds.base.width_mm, 70);
});

test('parseDatasheet extracts flight stem for inceptor-squad', () => {
  const ds = parseDatasheet(load('inceptor-squad'));
  assert.strictEqual(ds.base.flight_stem, true);
});

test('parseDatasheet extracts profile M T Sv W Ld OC', () => {
  const ds = parseDatasheet(load('intercessor-squad'));
  assert.strictEqual(ds.profile.M, '6"');
  assert.strictEqual(ds.profile.T, 4);
  assert.strictEqual(ds.profile.Sv, '3+');
  assert.strictEqual(ds.profile.W, 2);
  assert.strictEqual(ds.profile.OC, 2);
});

test('parseDatasheet extracts max weapon range', () => {
  const ds = parseDatasheet(load('ballistus-dreadnought'));
  assert.strictEqual(ds.max_range_in, 48);
});

test('parseDatasheet extracts ranges_in as sorted unique array', () => {
  const ds = parseDatasheet(load('ballistus-dreadnought'));
  assert.ok(Array.isArray(ds.ranges_in));
  // Sorted ascending, deduped
  for (let i = 1; i < ds.ranges_in.length; i++) {
    assert.ok(ds.ranges_in[i] > ds.ranges_in[i - 1], 'ranges must be strictly ascending');
  }
  assert.strictEqual(ds.ranges_in.at(-1), ds.max_range_in);
});

test('parseDatasheet ranges_in for aggressor-squad includes 12" and 18"', () => {
  const ds = parseDatasheet(load('aggressor-squad'));
  assert.ok(ds.ranges_in.includes(12), '12" flamestorm');
  assert.ok(ds.ranges_in.includes(18), '18" auto-boltstorm');
  assert.strictEqual(ds.max_range_in, 18);
});

test('parseDatasheet extracts unit name from title', () => {
  const ds = parseDatasheet(load('intercessor-squad'));
  assert.strictEqual(ds.name, 'Intercessor Squad');
});

test('parseDatasheet ignores YAML # comments in frontmatter when reading title', () => {
  // The Wardens datasheet has YAML comments in the frontmatter that begin
  // with `#` and would, without frontmatter stripping, be matched by the
  // markdown H1 regex and appear as the unit name.
  const ds = parseDatasheet(load('wardens-of-ultramar'));
  assert.strictEqual(ds.name, 'Wardens of Ultramar');
});

test('parseDatasheet extracts Invulnerable Save from below profile table', () => {
  // Captain Titus prints "**Invulnerable Save:** 4+" below the M/T/Sv/W
  // table; the parser must surface it as profile.InvSv. Without this,
  // the catalogue silently drops every unit's invulnerable save.
  const ds = parseDatasheet(load('captain-titus'));
  assert.strictEqual(ds.profile.InvSv, '4+');
});

test('parseDatasheet leaves InvSv undefined for units without an invulnerable save', () => {
  // Intercessor Squad has no invulnerable save. Confirm we do not pick
  // up unrelated tokens (e.g. armour saves, weapon saves).
  const ds = parseDatasheet(load('intercessor-squad'));
  assert.strictEqual(ds.profile.InvSv, undefined);
});

test('parseDatasheet extracts per-model bases from Wardens of Ultramar', () => {
  const ds = parseDatasheet(load('wardens-of-ultramar'));
  assert.ok(Array.isArray(ds.base.per_model), 'per_model should be an array');
  assert.strictEqual(ds.base.per_model.length, 6);

  const gadriel = ds.base.per_model.find(m => m.submodel === 'Ancient Gadriel');
  assert.deepStrictEqual(gadriel, { submodel: 'Ancient Gadriel', shape: 'round', diameter_mm: 40 });

  const metaurus = ds.base.per_model.find(m => m.submodel === 'Veteran Sergeant Metaurus');
  assert.strictEqual(metaurus.diameter_mm, 40);

  const silva = ds.base.per_model.find(m => m.submodel === 'Gaius Silva');
  assert.strictEqual(silva.diameter_mm, 28.5);

  const vestha = ds.base.per_model.find(m => m.submodel === 'Lucia Vestha');
  assert.strictEqual(vestha.diameter_mm, 28.5);
});

test('parseDatasheet leaves per_model undefined for normal single-base units', () => {
  const ds = parseDatasheet(load('intercessor-squad'));
  assert.strictEqual(ds.base.per_model, undefined);
});

test('parseDatasheet does not false-positive when no Per-model bases marker is present', () => {
  // Synthetic trap: a nested bullet that LOOKS like a per-model entry but
  // lives under an unrelated top-level bullet. Without the marker scope,
  // the old regex would have captured "Note" as a submodel.
  const text = [
    '# Trap Unit',
    '## Base',
    '- **Shape:** round',
    '- **Diameter:** 32mm',
    '- **Flight stem:** no',
    '  - Note: errata pending, 40mm ruling deferred',
    '',
    '## Profile',
    '| M | T | Sv | W | Ld | OC |',
    '|---|---|---|---|---|---|',
    '| 6" | 4 | 3+ | 2 | 6+ | 2 |',
    '',
  ].join('\n');
  const ds = parseDatasheet(text);
  assert.strictEqual(ds.base.per_model, undefined);
  assert.strictEqual(ds.base.diameter_mm, 32);
});
