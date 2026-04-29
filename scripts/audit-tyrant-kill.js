#!/usr/bin/env node
// audit-tyrant-kill.js
//
// What is the probability that a 5× Sternguard + 6× Wardens of Ultramar
// + 1× Captain Titus combined unit kills a Hive Tyrant in a single turn?
//
// Run: node scripts/audit-tyrant-kill.js [--trials=20000] [--seed=42]
//
// Source datasheets (single source of truth):
//   datasheets/space-marines/units/sternguard-veteran-squad.md
//   datasheets/space-marines/units/wardens-of-ultramar.md
//   datasheets/space-marines/units/captain-demetrian-titus.md
//   datasheets/tyranids/units/hive-tyrant.md

import { simulate } from '../app/lib/sim/combat.js';
import { parseKeywords } from '../app/lib/sim/keywords.js';

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

// --- Defender: Hive Tyrant (foot) -------------------------------------
// T10, 2+ Sv, 4+ Inv, W=10, single model. Keywords used by sim: NONE
// of our weapons key off them (no Anti-Monster, no Anti-Character).
const hiveTyrant = {
  toughness: 10,
  save: '2+',
  invulnerable: '4+',
  wounds_per_model: 10,
  model_count: 1,
  keywords: ['MONSTER', 'CHARACTER', 'PSYKER', 'SYNAPSE', 'HIVE TYRANT', 'TYRANIDS'],
};

// --- Helpers -----------------------------------------------------------
function w(name, kind, attacks, skill, S, ap, dmg, kwString = '—') {
  return {
    name,
    kind,
    range_in: kind === 'melee' ? 0 : 24,
    attacks: String(attacks),
    skill: typeof skill === 'string' ? skill : `${skill}+`,
    strength: S,
    ap,
    damage: String(dmg),
    abilities: parseKeywords(kwString),
  };
}

// Multiply a single per-model weapon entry into N copies (one per model
// carrying it). Mirrors what buildSimInputs does in catalogue.js.
function copies(n, weapon) {
  return Array.from({ length: n }, () => ({ ...weapon, abilities: { ...weapon.abilities } }));
}

// --- Sternguard 10-model default (no swaps) ---------------------------
const sternguardWeapons = [
  ...copies(10, w('Sternguard bolt pistol', 'ranged', 1, 3, 4, 0, 1, '[DEVASTATING WOUNDS], [PISTOL]')),
  ...copies(10, w('Sternguard bolt rifle',  'ranged', 2, 3, 4, -1, 1, '[ASSAULT], [DEVASTATING WOUNDS], [HEAVY], [RAPID FIRE 1]')),
  ...copies(10, w('Close combat weapon (Sternguard)', 'melee', 4, 3, 4, 0, 1)),
];

// --- Wardens of Ultramar (fixed 6-model unit) -------------------------
const wardensWeapons = [
  // Ancient Gadriel — bolt rifle + ccw
  w('Bolt rifle (Gadriel)',          'ranged', 2, 3, 4, -1, 1, '[ASSAULT], [HEAVY]'),
  w('Close combat weapon (Gadriel)', 'melee',  4, 2, 4, 0,  1),
  // Veteran Sergeant Metaurus — heavy bolt pistol + master-crafted power weapon
  w('Heavy bolt pistol (Metaurus)',         'ranged', 1, 3, 4, -1, 1, '[PISTOL]'),
  w('Master-crafted power weapon',          'melee',  5, 2, 5, -2, 2),
  // Gaius Silva — archeotech laspistol + power weapon
  w('Archeotech laspistol (Silva)',  'ranged', 1, 3, 4, -1, 1, '[PISTOL]'),
  w('Power weapon (Silva)',          'melee',  4, 2, 4, -2, 1),
  // Aemelia Minervas — archeotech laspistol + power weapon
  w('Archeotech laspistol (Minervas)', 'ranged', 1, 3, 4, -1, 1, '[PISTOL]'),
  w('Power weapon (Minervas)',         'melee',  4, 2, 4, -2, 1),
  // Dainal Kornelius — astropathic blast + force stave
  w('Astropathic blast',  'ranged', 'D6', 3, 4, -1, 1, '[BLAST], [PSYCHIC]'),
  w('Force stave',        'melee',  1,    2, 5, -2, 2, '[PSYCHIC]'),
  // Lucia Vestha — archeotech laspistol + ccw
  w('Archeotech laspistol (Vestha)', 'ranged', 1, 3, 4, -1, 1, '[PISTOL]'),
  w('Close combat weapon (Vestha)',  'melee',  4, 2, 4, 0,  1),
];

// --- Captain Titus ----------------------------------------------------
const titusWeapons = [
  w('Bolt pistol (Titus)',           'ranged', 1, 2, 4, 0,  1, '[PISTOL]'),
  w('Master-crafted bolter',         'ranged', 2, 2, 4, -1, 2, '[ASSAULT], [HEAVY]'),
  // Anti-Infantry 2+ does NOT apply against Hive Tyrant (Monster, not Infantry)
  w('Master-crafted chainsword',     'melee',  8, 2, 5, -1, 2, '[ANTI-INFANTRY 2+]'),
];

// --- Apply Titus's Press the Attack to ranged weapons -----------------
// Press the Attack grants ONLY [SUSTAINED HITS 1], and only to RANGED
// weapons (per the printed datasheet — confirmed in the per-kind grants
// schema: `weapon_abilities_ranged: { sustained_hits: 1 }`). First-wins
// so the Sternguard heavy bolter's printed [SUSTAINED HITS 1] is not
// double-applied. Melee weapons untouched.
function applyTitusGrants(weapons) {
  return weapons.map(weapon => {
    if (weapon.kind !== 'ranged') return weapon;
    const ab = { ...weapon.abilities };
    if (ab.sustained_hits == null) ab.sustained_hits = 1;
    return { ...weapon, abilities: ab };
  });
}
const titusModifiers = {};

// --- Attacker assembly ------------------------------------------------
const allRanged = [...sternguardWeapons, ...wardensWeapons, ...titusWeapons]
  .filter(x => x.kind === 'ranged');
const allMelee  = [...sternguardWeapons, ...wardensWeapons, ...titusWeapons]
  .filter(x => x.kind === 'melee');

function makeAttacker({ kind, oath = false, atHalfRange = false }) {
  let weapons = kind === 'ranged' ? allRanged
              : kind === 'melee'  ? allMelee
              : [...allRanged, ...allMelee];
  weapons = applyTitusGrants(weapons);

  const modifiers = { ...titusModifiers };
  // Oath of Moment (Adeptus Astartes faction): re-roll Hit roll vs the
  // Oath target, +1 to Wound roll (mono-codex SM).
  // Sternguard Focus (Sternguard datasheet): "Each time a model in this
  // unit makes an attack that targets your Oath of Moment target, you can
  // re-roll the Wound roll." Per 10th-ed rules, "this unit" on an
  // Attached Unit means every model in that Attached Unit — leader and
  // bodyguard alike — so Sternguard Focus extends to the Wardens and
  // Titus while they are part of this combined unit.
  if (oath) {
    modifiers.reroll_hits = 'all';
    modifiers.plus_one_to_wound = true;
    modifiers.reroll_wounds = 'all';
  }
  return { weapons, model_count: 1, modifiers };
}

// --- Run scenarios ----------------------------------------------------
console.log(`\nWardens(6) + Sternguard(10) + Titus → Hive Tyrant`);
console.log(`Defender: T10  2+ Sv  4+ Inv  W=10  (1 model)`);
console.log(`Trials:   ${TRIALS}${SEED != null ? `, seed=${SEED}` : ''}`);
console.log('─'.repeat(74));

const fmt = (p) => `${(p * 100).toFixed(1)}%`;
const fmtN = (n) => n.toFixed(2);

const scenarios = [
  { label: 'Ranged @ half range  (no Oath)',     kind: 'ranged', oath: false, atHalfRange: true  },
  { label: 'Ranged @ full range  (no Oath)',     kind: 'ranged', oath: false, atHalfRange: false },
  { label: 'Melee                (no Oath)',     kind: 'melee',  oath: false, atHalfRange: false },
  { label: 'Combined (shoot @ ½ + melee)',        kind: 'all',    oath: false, atHalfRange: true  },
  { label: 'Combined + Oath of Moment',           kind: 'all',    oath: true,  atHalfRange: true  },
];

for (const sc of scenarios) {
  const attacker = makeAttacker({ kind: sc.kind, oath: sc.oath, atHalfRange: sc.atHalfRange });
  const r = simulate({
    attacker,
    defender: hiveTyrant,
    trials: TRIALS,
    rng,
    context: { at_half_range: sc.atHalfRange },
  });
  console.log(
    `${sc.label.padEnd(38)}  P(kill)=${fmt(r.p_target_destroyed).padStart(6)}  ` +
    `E[wounds]=${fmtN(r.expected_wounds_dealt).padStart(5)}/10`,
  );
}

console.log('─'.repeat(74));
console.log('Notes:');
console.log('  • Sternguard 10-model default loadout (pistols + bolt rifles + ccw, no swaps).');
console.log('  • Titus\'s Press the Attack grants [SUSTAINED HITS 1] only — no re-rolls.');
console.log('  • Oath row stacks: re-roll all hits + +1 to wound + re-roll wounds');
console.log('    (Sternguard Focus — applies to every model in the Attached Unit per the');
console.log('    10th-ed "this unit" rule).');
console.log('  • [DEVASTATING WOUNDS] on Sternguard bolt weapons → critical wounds → MWs');
console.log('    bypass the Tyrant\'s 2+/4++ entirely.');
