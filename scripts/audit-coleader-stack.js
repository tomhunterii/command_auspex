#!/usr/bin/env node
// audit-coleader-stack.js
//
// Wiring verification for the Wardens of Ultramar + Captain Titus co-leader
// attachment on a Sternguard squad. Drives the SAME code path the UI uses
// (catalogue.js → buildSimInputs → simulate) and reports what it finds.
//
// What this script verifies:
//   1. Catalogue carries the right co-leader metadata
//      (wardens.can_join, wardens.enables_co_leader, defender invulnerable
//      save populated).
//   2. buildSimInputs accepts attachedLeaders=[wardens, titus] and produces
//      a non-empty merged weapon pool.
//   3. simulate() runs end-to-end against the merged stack.
//
// What this script does NOT verify (yet):
//   • That the merged weapon counts match the printed datasheet for fixed-
//     loadout multi-model leaders. buildSimInputs currently replicates each
//     leader weapon row × loadouts[0].model_count, which over-counts for
//     hero squads where every submodel carries DIFFERENT gear (e.g.
//     Wardens — only Gadriel has the bolt rifle, but the path emits 6).
//     This is a real limitation; tracked separately.
//
// Run: node scripts/audit-coleader-stack.js [--trials=20000] [--seed=42]

import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulate } from '../app/lib/sim/combat.js';
import { buildSimInputs } from '../app/lib/catalogue.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const DB_PATH = join(REPO, 'src-tauri/resources/catalogue.db');

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const TRIALS = parseInt(args.trials ?? '20000', 10);
const SEED = args.seed != null ? parseInt(args.seed, 10) : null;

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = SEED != null ? mulberry32(SEED) : Math.random;

// Mirror of getUnit() in catalogue.js — same SELECTs, same return shape, but
// using node:sqlite synchronously instead of Tauri IPC. We then call the
// production buildSimInputs, so any bugs there will surface here too.
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
  const ledBy = db.prepare(
    'SELECT leader_slug FROM unit_led_by WHERE unit_id = ?'
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
    led_by: ledBy.map(r => r.leader_slug),
    grants: row.grants_json ? JSON.parse(row.grants_json) : null,
    can_join: row.can_join_json ? JSON.parse(row.can_join_json) : [],
    enables_co_leader: row.enables_co_leader ?? null,
  };
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });

const sternguard = readUnit(db, 'sternguard-veteran-squad');
const wardens    = readUnit(db, 'wardens-of-ultramar');
const titus      = readUnit(db, 'captain-demetrian-titus');
const tyrantUnit = readUnit(db, 'hive-tyrant');

if (!sternguard || !wardens || !titus || !tyrantUnit) {
  console.error('FATAL: one or more required units missing from catalogue. Run `npm run build:catalogue`.');
  process.exit(1);
}

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  const mark = ok ? '✔' : '✘';
  console.log(`  ${mark} ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++; else fail++;
};

console.log('CO-LEADER STACK — CATALOGUE WIRING\n');
check(
  'Wardens.can_join includes sternguard-veteran-squad',
  wardens.can_join.includes('sternguard-veteran-squad'),
  `[${wardens.can_join.join(', ')}]`,
);
check(
  'Wardens.enables_co_leader === captain-demetrian-titus',
  wardens.enables_co_leader === 'captain-demetrian-titus',
  String(wardens.enables_co_leader),
);
check(
  'Hive Tyrant invulnerable save populated',
  tyrantUnit.profile.InvSv === '4+',
  `InvSv=${tyrantUnit.profile.InvSv ?? '(null)'}`,
);
check(
  'Captain Titus invulnerable save populated',
  titus.profile.InvSv === '4+',
  `InvSv=${titus.profile.InvSv ?? '(null)'}`,
);

console.log('\nCO-LEADER STACK — buildSimInputs\n');
// Mirror what the UI does: call buildSimInputs twice (once per side) and
// stitch attacker + defender from their respective calls.
const { attacker } = buildSimInputs(sternguard, {
  kind: 'all',
  attacker_model_count: 10,
  attachedLeaders: [wardens, titus],
});
const { defender } = buildSimInputs(tyrantUnit, { kind: 'all', model_count: 1 });
const ranged = attacker.weapons.filter(w => w.kind === 'ranged').length;
const melee  = attacker.weapons.filter(w => w.kind === 'melee').length;
check('Merged weapon pool is non-empty', attacker.weapons.length > 0, `${attacker.weapons.length} entries (${ranged} ranged, ${melee} melee)`);
check(
  'Defender shape carries Hive Tyrant invuln',
  defender.invulnerable === '4+',
  `T${defender.toughness} ${defender.save} ${defender.invulnerable ?? '(none)'} W${defender.wounds_per_model}`,
);

// Probe each leader contributed at least one weapon to the merged pool.
const wardenNames  = new Set(wardens.weapons.map(w => w.name));
const titusNames   = new Set(titus.weapons.map(w => w.name));
const mergedNames  = new Set(attacker.weapons.map(w => w.name));
check(
  'Wardens weapons appear in merged pool',
  [...wardenNames].some(n => mergedNames.has(n)),
  `e.g. ${[...wardenNames].find(n => mergedNames.has(n))}`,
);
check(
  'Titus weapons appear in merged pool',
  [...titusNames].some(n => mergedNames.has(n)),
  `e.g. ${[...titusNames].find(n => mergedNames.has(n))}`,
);

console.log('\nCO-LEADER STACK — simulate() runs end-to-end\n');
attacker.modifiers = { reroll_hits: 'ones' };
const r = simulate({
  attacker,
  defender,
  trials: TRIALS,
  rng,
  context: { at_half_range: true },
});
check(
  'simulate() returns finite kill probability',
  Number.isFinite(r.p_target_destroyed),
  `P(kill)=${(r.p_target_destroyed * 100).toFixed(1)}%, E[wounds]=${r.expected_wounds_dealt.toFixed(2)}/10`,
);

console.log('\nKNOWN LIMITATION (not failing this audit):');
console.log('  buildSimInputs replicates each leader weapon row × loadouts[0].model_count.');
console.log('  For uniform leader squads (e.g. a sergeant + 5 troopers), this is right.');
console.log('  For fixed-loadout hero squads where every submodel carries DIFFERENT gear');
console.log('  (Wardens of Ultramar: 6 named characters, each with a unique loadout), the');
console.log('  6× multiplier OVER-counts. Correct fix is to drive replication off the');
console.log(`  roster's per-submodel wargear arrays, not loadouts[0].model_count.`);
console.log(`  Surfaced in this run: Wardens contributed ${attacker.weapons.filter(w => wardenNames.has(w.name)).length} weapon copies (printed datasheet allocates 12 — 2 per character × 6).`);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
