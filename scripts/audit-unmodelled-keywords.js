#!/usr/bin/env node
// audit-unmodelled-keywords.js
//
// Walk every weapon row in the catalogue, run its keywords string through
// parseKeywords, and tally everything that lands in the `unmodelled`
// bucket. Prints a sorted-by-frequency list of unmodelled keywords plus
// the (unit, weapon) holders carrying each one.
//
// Run: node scripts/audit-unmodelled-keywords.js

import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKeywords } from '../app/lib/sim/keywords.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const DB_PATH = join(REPO, 'src-tauri/resources/catalogue.db');

const db = new DatabaseSync(DB_PATH, { readOnly: true });

const rows = db.prepare(`
  SELECT u.slug AS unit, w.name AS weapon, w.keywords AS kw
  FROM weapons w JOIN units u ON u.id = w.unit_id
  WHERE w.keywords IS NOT NULL AND length(w.keywords) > 0
`).all();

const tally = new Map(); // keyword → [{ unit, weapon }]
for (const r of rows) {
  const ab = parseKeywords(r.kw);
  for (const kw of ab.unmodelled ?? []) {
    const arr = tally.get(kw) ?? [];
    arr.push({ unit: r.unit, weapon: r.weapon });
    tally.set(kw, arr);
  }
}

const sorted = [...tally.entries()].sort((a, b) => b[1].length - a[1].length);

console.log('UNMODELLED KEYWORDS ACROSS THE CATALOGUE');
console.log('='.repeat(58));

if (sorted.length === 0) {
  console.log('(none — every weapon keyword in the catalogue is modeled)');
  process.exit(0);
}

for (const [kw, holders] of sorted) {
  console.log(`\n[${kw}]  ×${holders.length}`);
  for (const h of holders) {
    console.log(`  - ${h.unit.padEnd(36)} ${h.weapon}`);
  }
}

console.log('\n' + '='.repeat(58));
console.log(`Distinct unmodelled keyword classes: ${sorted.length}`);
console.log(`Total weapon-row instances:          ${sorted.reduce((s, [, h]) => s + h.length, 0)}`);
console.log(`Catalogue weapon rows scanned:       ${rows.length}`);
