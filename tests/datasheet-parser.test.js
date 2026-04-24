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

test('parseDatasheet extracts unit name from title', () => {
  const ds = parseDatasheet(load('intercessor-squad'));
  assert.strictEqual(ds.name, 'Intercessor Squad');
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
