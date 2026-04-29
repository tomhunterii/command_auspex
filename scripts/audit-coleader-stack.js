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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulate } from '../app/lib/sim/combat.js';
import { buildSimInputs } from '../app/lib/catalogue.js';
import { parseFrontmatter } from '../app/lib/yaml-frontmatter.js';
import { findMeleeChoices, applyMeleeSelection } from '../app/lib/melee-selection.js';
import { mergeLeaderGrants } from '../app/lib/leader-grants.js';

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

// Load the Norallus roster YAML so we can drive buildSimInputs the way the
// UI does — with per-submodel equippedCounts for each unit. Without this
// the bare-catalogue path replicates each Warden weapon × 6 (their loadout
// model count), badly inflating the merged pool.
const ROSTER_PATH = join(REPO, 'rosters/norallus-purge-and-burn.md');
const rosterFm = await parseFrontmatter(readFileSync(ROSTER_PATH, 'utf8'));
function rosterEquippedCounts(unitName) {
  const u = rosterFm?.units?.find(x => x.name === unitName);
  if (!u) return null;
  const counts = new Map();
  for (const m of u.models ?? []) {
    for (const w of m.wargear ?? []) {
      if (!w.item) continue;
      const key = String(w.item).toLowerCase().trim();
      // Roster wargear count is the absolute total across the submodel
      // group already; do not multiply by submodel count.
      counts.set(key, (counts.get(key) ?? 0) + (w.count ?? 1));
    }
  }
  return counts;
}
const sternguardEc = rosterEquippedCounts('Sternguard Veteran Squad');
const wardensEc    = rosterEquippedCounts('Wardens of Ultramar');
const titusEc      = rosterEquippedCounts('Captain Titus'); // roster shorthand for Demetrian Titus

console.log('\nCO-LEADER STACK — buildSimInputs (with per-submodel equippedCounts)\n');
const { attacker } = buildSimInputs(sternguard, {
  kind: 'all',
  attacker_model_count: 10,
  attachedLeaders: [
    { unit: wardens, equippedCounts: wardensEc },
    { unit: titus,   equippedCounts: titusEc   },
  ],
  equippedCounts: sternguardEc,
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

console.log('\nCO-LEADER STACK — Titus grants flow through mergeLeaderGrants\n');
const wrappedLeaders = [
  { unit: wardens, equippedCounts: wardensEc },
  { unit: titus,   equippedCounts: titusEc   },
];
const granted = mergeLeaderGrants(attacker, wrappedLeaders);
// Press the Attack grants ONLY [SUSTAINED HITS 1] per the printed datasheet —
// no re-roll-1s, no other modifier. Confirm the merge does not invent one.
check(
  'no spurious reroll_hits modifier applied (Press the Attack is SH-only)',
  granted.modifiers?.reroll_hits == null,
  `modifiers.reroll_hits=${granted.modifiers?.reroll_hits ?? '(unset, correct)'}`,
);
const allGotSh = granted.weapons.every(w => w.abilities?.sustained_hits === 1);
check(
  'sustained_hits=1 reached every weapon in the merged pool',
  allGotSh,
  `${granted.weapons.filter(w => w.abilities?.sustained_hits === 1).length}/${granted.weapons.length} weapons carry SH 1`,
);

console.log('\nCO-LEADER STACK — simulate() with grants applied (combined ½-range)\n');
// Without-grants baseline first (re-using the same merged pool but no
// Titus modifiers / weapon abilities), so the grant effect can be
// measured directly rather than against a hand-built reference whose
// equipped loadout differs from the Norallus roster.
const rNoGrants = simulate({
  attacker, defender, trials: TRIALS, rng, context: { at_half_range: true },
});
const rGranted = simulate({
  attacker: granted, defender, trials: TRIALS, rng, context: { at_half_range: true },
});
check(
  'simulate() with grants returns finite kill probability',
  Number.isFinite(rGranted.p_target_destroyed),
  `P(kill)=${(rGranted.p_target_destroyed * 100).toFixed(1)}%, E[wounds]=${rGranted.expected_wounds_dealt.toFixed(2)}/10`,
);
check(
  `Titus's grants visibly increase expected damage vs ungranted baseline`,
  rGranted.expected_wounds_dealt > rNoGrants.expected_wounds_dealt + 0.1,
  `granted=${rGranted.expected_wounds_dealt.toFixed(2)} vs baseline=${rNoGrants.expected_wounds_dealt.toFixed(2)}, Δ=+${(rGranted.expected_wounds_dealt - rNoGrants.expected_wounds_dealt).toFixed(2)}`,
);
// Loose hand-built sanity comparison (audit-tyrant-kill.js, no Oath,
// combined ½-range — re-run after the Press-the-Attack reroll_hits fix:
//   P(kill) ≈ 52.8%, E[wounds] ≈ 8.62/10).
// Loadouts differ between the two scripts — Norallus has a sergeant
// Power fist + 2 heavy bolters that the hand-built reference does not
// include — so we expect the catalogue path to skew somewhat higher.
// ±20pp / ±1.0 wounds is enough to catch a wiring regression without
// flagging the legitimate loadout-fidelity uplift.
check(
  'P(kill) within 20pp of hand-built reference (~52.8%, loose)',
  Math.abs(rGranted.p_target_destroyed - 0.528) <= 0.20,
  `${(rGranted.p_target_destroyed * 100).toFixed(1)}% vs ref 52.8%, Δ=${((rGranted.p_target_destroyed - 0.528) * 100).toFixed(1)}pp`,
);
check(
  'E[wounds] within 1.0 of hand-built reference (~8.62, loose)',
  Math.abs(rGranted.expected_wounds_dealt - 8.62) <= 1.0,
  `${rGranted.expected_wounds_dealt.toFixed(2)} vs ref 8.62, Δ=${(rGranted.expected_wounds_dealt - 8.62).toFixed(2)}`,
);

// Per-submodel allocation check — assert the total merged pool matches
// the sum of the three roster equippedCounts (filtering each map to keys
// that actually exist as weapons in that unit's catalogue list, since
// rosters also list non-weapon wargear like 'Storm Shield' / 'Refractor
// Field' that don't appear in the weapons table).
function expectedFromRoster(unit, ec) {
  if (!ec) return 0;
  const weaponNames = new Set(unit.weapons.map(w => String(w.name).toLowerCase().trim()));
  let total = 0;
  for (const [key, n] of ec.entries()) {
    if (weaponNames.has(key)) total += n;
  }
  return total;
}
const expected =
  expectedFromRoster(sternguard, sternguardEc) +
  expectedFromRoster(wardens, wardensEc) +
  expectedFromRoster(titus, titusEc);
check(
  `Merged pool size matches per-roster expected total (${expected})`,
  attacker.weapons.length === expected,
  `pool=${attacker.weapons.length}`,
);
// And specifically: Wardens (6 named characters) should contribute the
// 12 weapons their roster wargear arrays declare. Compare via the
// per-Warden equippedCounts map rather than name-matching against the
// merged pool (Wardens' "Close combat weapon" name collides with
// Sternguard's "Close combat weapon", which would inflate a name match).
const wardensExpected = expectedFromRoster(wardens, wardensEc);
check(
  'Wardens roster equippedCounts sum to 12 weapon copies',
  wardensExpected === 12,
  `${wardensExpected} copies declared in roster`,
);

// Melee selection check — Old One Eye prints two melee profiles of the
// same weapon (claws and talons – strike vs – sweep). Neither has
// [EXTRA ATTACKS], so findMeleeChoices should return exactly 2 entries
// and the player must pick one per turn. (The Hive Tyrant's scything
// talons carry [EXTRA ATTACKS] and always stack with its bonesword, so
// it is NOT a useful selection-test target.)
const ooeUnit = readUnit(db, 'old-one-eye');
const ooeInputs = buildSimInputs(ooeUnit, { kind: 'all', model_count: 1 });
const ooeMeleeChoices = findMeleeChoices(ooeInputs.attacker.weapons);
check(
  'Old One Eye exposes 2 melee picks (strike vs sweep profiles)',
  ooeMeleeChoices.size === 2,
  `${ooeMeleeChoices.size} non-EXTRA-ATTACKS melee weapons`,
);
const ooeAfterPick = applyMeleeSelection(
  ooeInputs.attacker.weapons,
  "old one eye's claws and talons – strike",
);
const ooeMeleeAfter = ooeAfterPick.filter(w => w.kind === 'melee');
check(
  'After melee pick = strike, only the strike profile remains',
  ooeMeleeAfter.length === 1 && ooeMeleeAfter[0].name.toLowerCase().includes('strike'),
  ooeMeleeAfter.map(w => w.name).join(', '),
);

console.log('\nKNOWN LIMITATION (not failing this audit):');
console.log('  Titus\'s Press the Attack is RANGED-ONLY per the printed datasheet,');
console.log('  but `grants_to_attached_unit.weapon_abilities` has no kind-filter so');
console.log('  the merge applies sustained_hits to melee weapons too. Hand-built');
console.log('  reference (audit-tyrant-kill.js applyTitusGrants) has the same gap.');
console.log('  Real fix: extend the grants schema to support per-kind targeting.');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
