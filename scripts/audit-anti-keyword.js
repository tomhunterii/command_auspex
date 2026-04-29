#!/usr/bin/env node
// audit-anti-keyword.js
//
// End-to-end verification that the Anti-X keyword pipeline survives the
// trip from catalogue → buildSimInputs → simulate. The combat-engine
// effect is already covered by tests/sim-keywords.test.js; this audit
// closes the loop by pulling a real catalogue weapon ([ANTI-INFANTRY 4+]
// on Sternguard combi-weapon) and confirming it fires correctly against
// an INFANTRY defender but stays silent against a MONSTER.
//
// Run: node scripts/audit-anti-keyword.js [--trials=40000]

import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulate } from '../app/lib/sim/combat.js';
import { parseKeywords } from '../app/lib/sim/keywords.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const DB_PATH = join(REPO, 'src-tauri/resources/catalogue.db');

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const TRIALS = parseInt(args.trials ?? '40000', 10);

const db = new DatabaseSync(DB_PATH, { readOnly: true });

// Pull the Sternguard combi-weapon row from the catalogue and reshape it
// into the combat-engine attacker weapon shape (mirror of buildSimInputs).
const combiRow = db.prepare(`
  SELECT name, kind, range_in, attacks, skill, strength, ap, damage, keywords
  FROM weapons
  WHERE unit_id = (SELECT id FROM units WHERE slug='sternguard-veteran-squad')
    AND name = 'Combi-weapon'
`).get();

if (!combiRow) {
  console.error('FATAL: Sternguard combi-weapon not in catalogue. Rebuild via npm run build:catalogue.');
  process.exit(1);
}

const combiWeapon = {
  name: combiRow.name,
  kind: combiRow.kind,
  range_in: combiRow.range_in,
  attacks: combiRow.attacks,
  skill: combiRow.skill,
  strength: combiRow.strength,
  ap: combiRow.ap,
  damage: combiRow.damage,
  abilities: parseKeywords(combiRow.keywords),
};

console.log('CATALOGUE ANTI-X PIPELINE AUDIT\n');
console.log(`Weapon under test: ${combiRow.name} (Sternguard Veteran Squad)`);
console.log(`  raw keywords:   ${combiRow.keywords}`);
console.log(`  parsed.anti:    ${JSON.stringify(combiWeapon.abilities.anti)}`);
console.log(`  S${combiRow.strength} AP${combiRow.ap} D${combiRow.damage}, ${combiRow.skill} BS\n`);

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  const mark = ok ? '✔' : '✘';
  console.log(`  ${mark} ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++; else fail++;
};

check(
  '[ANTI-INFANTRY 4+] survived parseKeywords()',
  Array.isArray(combiWeapon.abilities.anti)
    && combiWeapon.abilities.anti.length === 1
    && combiWeapon.abilities.anti[0].target_keyword === 'INFANTRY'
    && combiWeapon.abilities.anti[0].threshold === 4,
);

// Run the combi-weapon (10 copies — Sternguard squad of 10) against two
// defenders that differ ONLY in toughness + keyword set so we can isolate
// the Anti-X effect:
//
//   INFANTRY target: T6, INFANTRY keyword, 100 wounds (no model deaths to
//                    distort wound accumulation), 7+ Sv.
//                    Table wound: 5+ (S4 vs T6). Anti 4+ kicks in. P(wound) = 3/6.
//   MONSTER target:  T6, MONSTER keyword (no INFANTRY), 100W, 7+ Sv.
//                    Table wound: 5+. Anti silent. P(wound) = 2/6.
//
// Per attack damage (no save): pistol vs heavy bolter etc. — all simplified
// out by the 100W defender and 7+ Sv (only nat 6 saves).
//   Anti vs Infantry:  10 × (Rapid Fire 1 → 2 attacks at 24" half range
//                      isn't relevant here — combi has [RAPID FIRE 1] but
//                      we simulate at_half_range=false so it stays at 1 A).
// Combi-weapon: A=1, BS=4+. So 10 attacks total.
//   With BS 4+: P(hit) = 3/6 = 0.5. After hit, anti vs Infantry: P(wound) = 3/6.
//   Save 7+: 5/6 unsaved. Per attack: 0.5 * 0.5 * 5/6 ≈ 0.208. 10 attacks → 2.08 wounds.
//   Without anti (vs Monster): 0.5 * 2/6 * 5/6 ≈ 0.139. 10 attacks → 1.39 wounds.
//
// (DEVASTATING WOUNDS still fires on nat-6 wound rolls, adding a ~5% kicker
// to both — but the Infantry case still wins by ~50%.)

const tenCombis = Array.from({ length: 10 }, () => ({
  ...combiWeapon, abilities: { ...combiWeapon.abilities },
}));

const infantryTarget = {
  toughness: 6, save: '7+', wounds_per_model: 100, model_count: 1,
  keywords: ['INFANTRY'],
};
const monsterTarget = {
  toughness: 6, save: '7+', wounds_per_model: 100, model_count: 1,
  keywords: ['MONSTER'],
};

const rInf = simulate({
  attacker: { weapons: tenCombis, model_count: 10 },
  defender: infantryTarget,
  trials: TRIALS,
});
const rMon = simulate({
  attacker: { weapons: tenCombis, model_count: 10 },
  defender: monsterTarget,
  trials: TRIALS,
});

console.log(`\nDamage profile (10 × combi-weapon, BS 4+ no half-range):`);
console.log(`  vs T6 INFANTRY: E[wounds] = ${rInf.expected_wounds_dealt.toFixed(2)}`);
console.log(`  vs T6 MONSTER:  E[wounds] = ${rMon.expected_wounds_dealt.toFixed(2)}\n`);

check(
  'Anti-Infantry produces strictly more damage vs INFANTRY than vs MONSTER',
  rInf.expected_wounds_dealt > rMon.expected_wounds_dealt + 0.3,
  `Δ=+${(rInf.expected_wounds_dealt - rMon.expected_wounds_dealt).toFixed(2)}`,
);
check(
  'INFANTRY damage near analytic expectation (~2.08, with DW kicker)',
  Math.abs(rInf.expected_wounds_dealt - 2.08) <= 0.40,
  `${rInf.expected_wounds_dealt.toFixed(2)} vs ~2.08`,
);
check(
  'MONSTER damage near analytic expectation (~1.39, with DW kicker)',
  Math.abs(rMon.expected_wounds_dealt - 1.39) <= 0.40,
  `${rMon.expected_wounds_dealt.toFixed(2)} vs ~1.39`,
);

// Cross-check: the SAME weapon stripped of its Anti-X should produce
// damage roughly equal to the MONSTER case against either target — proving
// the Anti-X is the only thing driving the INFANTRY uplift.
const noAntiCombi = tenCombis.map(w => ({
  ...w, abilities: { ...w.abilities, anti: undefined },
}));
const rInfNoAnti = simulate({
  attacker: { weapons: noAntiCombi, model_count: 10 },
  defender: infantryTarget,
  trials: TRIALS,
});
console.log(`\nControl (same weapon with Anti stripped):`);
console.log(`  vs T6 INFANTRY: E[wounds] = ${rInfNoAnti.expected_wounds_dealt.toFixed(2)}\n`);
check(
  'Stripping Anti-X collapses INFANTRY damage to roughly the MONSTER baseline',
  Math.abs(rInfNoAnti.expected_wounds_dealt - rMon.expected_wounds_dealt) <= 0.30,
  `noAnti=${rInfNoAnti.expected_wounds_dealt.toFixed(2)} vs monster=${rMon.expected_wounds_dealt.toFixed(2)}, Δ=${(rInfNoAnti.expected_wounds_dealt - rMon.expected_wounds_dealt).toFixed(2)}`,
);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
