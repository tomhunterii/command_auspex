#!/usr/bin/env node
// audit-sim-math.js
//
// Closed-form audit of the combat simulator. For each scenario we compute
// the expected wounds-dealt analytically, run the Monte-Carlo simulator
// at high trial counts, and assert the relative error is within tolerance.
//
// Run: node scripts/audit-sim-math.js [--trials=40000] [--tol=0.02] [--seed=N]
// Exit 0 on success, 1 on any failure.

import { simulate } from '../app/lib/sim/combat.js';

// --- CLI ---------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const TRIALS = parseInt(args.trials ?? '40000', 10);
const TOL = parseFloat(args.tol ?? '0.025');
const SEED = args.seed != null ? parseInt(args.seed, 10) : null;

// Deterministic RNG when --seed is given (mulberry32). The simulator
// accepts an `rng` callable returning floats in [0, 1).
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

// --- closed-form helpers ----------------------------------------------
const skillProb = (n) => Math.max(1, 7 - n) / 6; // n+ → P(success)

// Wound roll target per S vs T (10th edition).
function woundTarget(S, T) {
  if (S >= 2 * T) return 2;
  if (S > T) return 3;
  if (S === T) return 4;
  if (S * 2 <= T) return 6;
  return 5;
}

// Save target after AP (no invuln, no cover, no FNP).
function saveProb(sv, ap, inv = null) {
  const armour = sv + Math.abs(ap); // ap is negative
  const armourProb = armour > 6 ? 0 : skillProb(armour);
  const invProb = inv != null ? skillProb(inv) : 0;
  return Math.max(armourProb, invProb);
}

// Parse "D6", "2D3", "D6+1", "3" → {n, sides, plus}; constants → {n:0, plus}.
function parseDice(expr) {
  const m = String(expr).match(/^(\d*)D(\d+)(?:\+(\d+))?$/i);
  if (!m) {
    const c = parseInt(expr, 10);
    return { n: 0, sides: 0, plus: Number.isFinite(c) ? c : 0 };
  }
  return {
    n: m[1] ? parseInt(m[1], 10) : 1,
    sides: parseInt(m[2], 10),
    plus: m[3] ? parseInt(m[3], 10) : 0,
  };
}
const meanDice = (expr) => {
  const { n, sides, plus } = parseDice(expr);
  return n * (sides + 1) / 2 + plus;
};

// E[wounds dealt] for a single weapon profile against a single defender.
// Models: A attacks → hit at WS/BS → wound at S vs T → save (best of armour
// post-AP / invuln) → damage. No keywords, no modifiers, no FNP, no cover.
function expectedWoundsClosedForm({ A, skill, S, ap, dmg, T, sv, inv = null }) {
  const pHit = skillProb(skill);
  const pWound = skillProb(woundTarget(S, T));
  const pSave = saveProb(sv, ap, inv);
  const pFail = 1 - pSave;
  return meanDice(A) * pHit * pWound * pFail * meanDice(dmg);
}

// --- scenarios ---------------------------------------------------------
// Each scenario is { name, weapon, defender, model_count(default 1) }.
const scenarios = [
  // (1) Bolters into MEQ
  {
    name: 'Bolter (4/3+/4/0/1) vs MEQ T4 3+ Sv',
    closed: { A: '4', skill: 3, S: 4, ap: 0, dmg: '1', T: 4, sv: 3 },
    sim: {
      weapons: [{ name: 'bolter', kind: 'ranged', range_in: 24,
        attacks: '4', skill: '3+', strength: 4, ap: 0, damage: '1' }],
      defender: { toughness: 4, save: '3+', wounds_per_model: 1 },
    },
  },
  // (2) Plasma vs MEQ — high S, AP-3, D2
  {
    name: 'Plasma (1/3+/8/-3/2) vs MEQ T4 3+',
    closed: { A: '1', skill: 3, S: 8, ap: -3, dmg: '2', T: 4, sv: 3 },
    sim: { weapons: [{ name: 'plasma', kind: 'ranged', range_in: 24,
      attacks: '1', skill: '3+', strength: 8, ap: -3, damage: '2' }],
      defender: { toughness: 4, save: '3+', wounds_per_model: 1 } },
  },
  // (3) Random attacks (D6) — exercises the dice parser
  {
    name: 'Heavy bolter (D6/4+/5/-1/2) vs T3 5+ Sv',
    closed: { A: 'D6', skill: 4, S: 5, ap: -1, dmg: '2', T: 3, sv: 5 },
    sim: { weapons: [{ name: 'hb', kind: 'ranged', range_in: 36,
      attacks: 'D6', skill: '4+', strength: 5, ap: -1, damage: '2' }],
      defender: { toughness: 3, save: '5+', wounds_per_model: 1 } },
  },
  // (4) Random damage (D3+1)
  {
    name: 'Lascannon-ish (1/3+/12/-3/D3+1) vs T9 3+',
    closed: { A: '1', skill: 3, S: 12, ap: -3, dmg: 'D3+1', T: 9, sv: 3 },
    sim: { weapons: [{ name: 'las', kind: 'ranged', range_in: 48,
      attacks: '1', skill: '3+', strength: 12, ap: -3, damage: 'D3+1' }],
      defender: { toughness: 9, save: '3+', wounds_per_model: 1 } },
  },
  // (5) Save-of-7 (gun ignores armour) — invuln-only path
  {
    name: 'AP-6 (1/3+/10/-6/3) vs 4+ Inv',
    closed: { A: '1', skill: 3, S: 10, ap: -6, dmg: '3', T: 4, sv: 3, inv: 4 },
    sim: { weapons: [{ name: 'voidsong', kind: 'ranged', range_in: 24,
      attacks: '1', skill: '3+', strength: 10, ap: -6, damage: '3' }],
      defender: { toughness: 4, save: '3+', invulnerable: '4+', wounds_per_model: 1 } },
  },
  // (6) Cover modifier (+1 save) — 10th-ed cap: cover cannot improve a save
  // beyond 3+, so we test against a 4+ save (4+ → 3+ in cover).
  // Cover lives at defender.modifiers.cover per the engine.
  {
    name: 'Bolter vs Guard 4+ Sv in cover (4+ → 3+)',
    closed: { A: '4', skill: 3, S: 4, ap: 0, dmg: '1', T: 3, sv: 3 },
    sim: { weapons: [{ name: 'bolter', kind: 'ranged', range_in: 24,
      attacks: '4', skill: '3+', strength: 4, ap: 0, damage: '1' }],
      defender: { toughness: 3, save: '4+', wounds_per_model: 1, modifiers: { cover: true } } },
  },
  // (7) Wound on equal: S=T=4
  {
    name: 'S=T=4 wound on 4+',
    closed: { A: '5', skill: 3, S: 4, ap: -1, dmg: '1', T: 4, sv: 4 },
    sim: { weapons: [{ name: 'sword', kind: 'melee', range_in: 0,
      attacks: '5', skill: '3+', strength: 4, ap: -1, damage: '1' }],
      defender: { toughness: 4, save: '4+', wounds_per_model: 1 } },
  },
  // (8) Wound on 6 (S × 2 ≤ T)
  {
    name: 'S=4 vs T=8 (wound on 6)',
    closed: { A: '10', skill: 3, S: 4, ap: 0, dmg: '1', T: 8, sv: 3 },
    sim: { weapons: [{ name: 'fists', kind: 'melee', range_in: 0,
      attacks: '10', skill: '3+', strength: 4, ap: 0, damage: '1' }],
      defender: { toughness: 8, save: '3+', wounds_per_model: 1 } },
  },
  // (9) Wound on 2 (S ≥ 2T)
  {
    name: 'S=10 vs T=4 (wound on 2)',
    closed: { A: '3', skill: 3, S: 10, ap: -2, dmg: '2', T: 4, sv: 3 },
    sim: { weapons: [{ name: 'mace', kind: 'melee', range_in: 0,
      attacks: '3', skill: '3+', strength: 10, ap: -2, damage: '2' }],
      defender: { toughness: 4, save: '3+', wounds_per_model: 1 } },
  },
  // (10) Many low-damage attacks — sample-mean precision check
  {
    name: 'Hormagaunt charge (60/4+/3/0/1) vs MEQ T4 3+',
    closed: { A: '60', skill: 4, S: 3, ap: 0, dmg: '1', T: 4, sv: 3 },
    sim: { weapons: [{ name: 'claws', kind: 'melee', range_in: 0,
      attacks: '60', skill: '4+', strength: 3, ap: 0, damage: '1' }],
      defender: { toughness: 4, save: '3+', wounds_per_model: 1 } },
  },
];

// --- runner ------------------------------------------------------------
let pass = 0, fail = 0;
const failures = [];

function fmt(n) { return n.toFixed(4); }

console.log(`\nCombat sim math audit — trials=${TRIALS}, tol=${(TOL * 100).toFixed(1)}%${SEED != null ? `, seed=${SEED}` : ''}`);
console.log('─'.repeat(74));

for (const s of scenarios) {
  const expected = expectedWoundsClosedForm(s.closed);
  // The engine has no damage spillover — each unsaved wound caps at the
  // current model's remaining W. To compare against the closed-form total
  // damage, give the defender a single model with effectively-infinite
  // wounds so damage is never truncated.
  const defender = {
    ...s.sim.defender,
    model_count: 1,
    wounds_per_model: 9999,
    keywords: s.sim.defender.keywords ?? [],
  };
  const attacker = { weapons: s.sim.weapons, model_count: 1 };
  const r = simulate({ attacker, defender, trials: TRIALS, rng });
  const observed = r.expected_wounds_dealt;
  const absErr = Math.abs(observed - expected);
  const relErr = expected > 0 ? absErr / expected : absErr;
  const ok = relErr <= TOL;
  if (ok) pass++; else { fail++; failures.push({ s, expected, observed, relErr }); }
  const tag = ok ? '✔' : '✘';
  const colour = ok ? '\x1b[32m' : '\x1b[31m';
  console.log(`${colour}${tag}\x1b[0m ${s.name.padEnd(48)}  exp=${fmt(expected)} obs=${fmt(observed)} err=${(relErr * 100).toFixed(2)}%`);
}

console.log('─'.repeat(74));
console.log(`pass: ${pass}  fail: ${fail}  scenarios: ${scenarios.length}`);

if (fail > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) {
    console.log(`  ${f.s.name}`);
    console.log(`    expected ${fmt(f.expected)}  observed ${fmt(f.observed)}  rel err ${(f.relErr * 100).toFixed(2)}%`);
  }
  process.exit(1);
}

process.exit(0);
