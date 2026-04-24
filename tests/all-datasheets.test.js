import { test } from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { parseDatasheet } from '../app/lib/datasheet-parser.js';

const SM_DIR = new URL('../datasheets/space-marines/units/', import.meta.url);
const TY_DIR = new URL('../datasheets/tyranids/units/', import.meta.url);

function run(dir) {
  const files = readdirSync(dir).filter(f => f.endsWith('.md'));
  for (const f of files) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    const ds = parseDatasheet(text);
    test(`datasheet: ${f} — parses with name`, () => {
      assert.ok(ds.name, `no name in ${f}`);
    });
    test(`datasheet: ${f} — has a base`, () => {
      assert.ok(ds.base, `no base in ${f}`);
      assert.ok(ds.base.shape, `no shape in ${f}`);
    });
    test(`datasheet: ${f} — has a profile`, () => {
      assert.ok(ds.profile, `no profile in ${f}`);
    });
  }
}

run(SM_DIR);
run(TY_DIR);
