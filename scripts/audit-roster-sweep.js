#!/usr/bin/env node
// audit-roster-sweep.js
//
// For every unit in every roster under rosters/, build sim attackers two
// ways and report the merged-weapon-pool delta:
//
//   LEGACY: buildSimInputs with attacker_model_count = total submodel count
//           (replicates each catalogue weapon row × N models — over-counts
//           any unit whose models do not all carry the same wargear).
//   NEW:    buildSimInputs with equippedCounts = aggregated roster wargear
//           (replicates each weapon row by the actual count of models
//           carrying it — faithful to the printed datasheet).
//
// A unit where LEGACY > NEW indicates the legacy path was inflating the
// pool. Uniform squads (every model carries the same gear) come back equal.
// A unit where NEW > LEGACY would be unexpected and warrants investigation.
//
// Run: node scripts/audit-roster-sweep.js

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../app/lib/yaml-frontmatter.js';
import { buildSimInputs } from '../app/lib/catalogue.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const DB_PATH = join(REPO, 'src-tauri/resources/catalogue.db');
const ROSTER_DIR = join(REPO, 'rosters');

function readUnit(db, slug) {
  const row = db.prepare(
    `SELECT u.*, f.slug AS faction_slug
     FROM units u JOIN factions f ON f.id = u.faction_id
     WHERE u.slug = ? LIMIT 1`,
  ).get(slug);
  if (!row) return null;
  const loadouts = db.prepare(
    'SELECT model_count, points, is_default FROM unit_loadouts WHERE unit_id = ? ORDER BY model_count'
  ).all(row.id);
  const keywords = db.prepare(
    'SELECT keyword, is_faction FROM unit_keywords WHERE unit_id = ?'
  ).all(row.id);
  const weapons = db.prepare(
    'SELECT kind, name, range_in, attacks, skill, strength, ap, damage, keywords FROM weapons WHERE unit_id = ?'
  ).all(row.id);
  return {
    slug: row.slug,
    name: row.name,
    profile: {
      M: row.movement, T: row.toughness, Sv: row.save, InvSv: row.invulnerable_save,
      W: row.wounds, Ld: row.leadership, OC: row.oc,
    },
    loadouts,
    keywords,
    weapons,
  };
}

function rosterEquippedCounts(rosterUnit) {
  const counts = new Map();
  for (const m of rosterUnit.models ?? []) {
    for (const w of m.wargear ?? []) {
      if (!w.item) continue;
      const key = String(w.item).toLowerCase().trim();
      counts.set(key, (counts.get(key) ?? 0) + (w.count ?? 1));
    }
  }
  return counts;
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });

const rosterFiles = readdirSync(ROSTER_DIR)
  .filter(f => f.endsWith('.md'))
  .sort();

let unitsProcessed = 0;
let unitsResolved = 0;
let unitsUnresolved = 0;
let inflations = 0;        // delta > 0 — legacy was over-counting
let identicals = 0;        // delta == 0 — uniform squad
let underflows = 0;        // delta < 0 — should not happen
const inflationSamples = []; // top inflation cases for report

for (const file of rosterFiles) {
  console.log(`\n=== ${file} ===`);
  const text = readFileSync(join(ROSTER_DIR, file), 'utf8');
  let fm;
  try {
    fm = await parseFrontmatter(text);
  } catch (err) {
    console.log(`  ⚠ parse error: ${err.message}`);
    continue;
  }
  if (!fm?.units) {
    console.log('  (no units block)');
    continue;
  }

  console.log('  ' +
    'UNIT'.padEnd(36) +
    'MODELS'.padStart(7) +
    'LEGACY'.padStart(8) +
    'NEW'.padStart(6) +
    '  ΔPOOL'
  );
  console.log('  ' + '-'.repeat(36 + 7 + 8 + 6 + 8));

  for (const u of fm.units) {
    unitsProcessed++;
    const slug = u.datasheet
      ? String(u.datasheet).split('/').pop().toLowerCase()
      : null;
    if (!slug) {
      console.log(`  ${u.name.padEnd(36)} (no datasheet pointer)`);
      unitsUnresolved++;
      continue;
    }
    const unit = readUnit(db, slug);
    if (!unit) {
      console.log(`  ${u.name.padEnd(36)} (slug not in catalogue: ${slug})`);
      unitsUnresolved++;
      continue;
    }
    unitsResolved++;

    const totalModels = (u.models ?? []).reduce((s, m) => s + (m.count ?? 0), 0) || 1;
    const ec = rosterEquippedCounts(u);

    const legacy = buildSimInputs(unit, { kind: 'all', attacker_model_count: totalModels });
    const fresh  = buildSimInputs(unit, { kind: 'all', equippedCounts: ec });

    const legacyPool = legacy.attacker.weapons.length;
    const newPool    = fresh.attacker.weapons.length;
    const delta      = legacyPool - newPool;

    let mark = '   ';
    if (delta > 0) {
      inflations++;
      mark = ' ⚠︎ ';   // warning sign for inflated legacy
      if (inflationSamples.length < 100) {
        inflationSamples.push({ roster: file, unit: u.name, legacyPool, newPool, delta });
      }
    } else if (delta === 0) {
      identicals++;
    } else {
      underflows++;
      mark = ' !!';
    }

    console.log(
      `  ${u.name.padEnd(36)}${String(totalModels).padStart(7)}${String(legacyPool).padStart(8)}${String(newPool).padStart(6)}${mark}${delta >= 0 ? '+' : ''}${delta}`
    );
  }
}

console.log('\n' + '='.repeat(74));
console.log('SUMMARY');
console.log('='.repeat(74));
console.log(`Rosters scanned:           ${rosterFiles.length}`);
console.log(`Units processed:           ${unitsProcessed}`);
console.log(`  resolved to catalogue:   ${unitsResolved}`);
console.log(`  unresolved (skipped):    ${unitsUnresolved}`);
console.log(`Pool deltas:`);
console.log(`  Identical (legacy = new, uniform squads): ${identicals}`);
console.log(`  Inflated (legacy > new — bug fix lands):  ${inflations}`);
console.log(`  Underflow (legacy < new — investigate):   ${underflows}`);

if (inflations > 0) {
  console.log('\nTop inflation cases (legacy was over-counting; new path is correct):');
  inflationSamples
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 10)
    .forEach(s => {
      console.log(`  ${s.unit.padEnd(36)} ${String(s.legacyPool).padStart(4)} → ${String(s.newPool).padStart(3)}  (-${s.delta})  [${s.roster}]`);
    });
}

if (underflows > 0) {
  console.log('\n⚠︎ UNDERFLOWS — these should not exist. Investigate:');
  inflationSamples.filter(s => s.delta < 0).forEach(s => {
    console.log(`  ${s.unit} in ${s.roster}: legacy=${s.legacyPool} new=${s.newPool}`);
  });
}

process.exit(0);
