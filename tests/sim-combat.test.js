import { test } from 'node:test';
import assert from 'node:assert';
import { simulate } from '../app/lib/sim/combat.js';

// Repeatable seeded RNG for deterministic tests where it matters. For
// distribution checks we use the default Math.random with a high trial
// count and assert on tolerances.

function within(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol,
    `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`);
}

test('simulate: 1 attack, auto-hit, auto-wound, no save → kills 1 W1 model', () => {
  // Attacker: 1 attack, Torrent (skill N/A) → auto-hit. S 2 vs T 1 → wound on 2+ (5/6).
  // Defender: T 1, save 7+ (nat-6 still saves → 1/6 chance), W 1, 1 model.
  // P(damage) = P(wound) * P(save fails) = 5/6 * 5/6 = 25/36 ≈ 0.694
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'auto', kind: 'ranged', range_in: 12,
        attacks: '1', skill: 'N/A', strength: 2, ap: 0, damage: '1',
      }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '7+', wounds_per_model: 1, model_count: 1,
    },
    trials: 20000,
  });
  // 25/36 ≈ 0.694
  within(result.expected_wounds_dealt, 25 / 36, 0.05);
  within(result.expected_models_lost, 25 / 36, 0.05);
});

test('simulate: 5 attacks, 3+ to hit, S4 vs T4, 3+ save, AP 0, D1, 5 models W1', () => {
  // Per-attack analytic (10th ed nat-1/nat-6 rules):
  //   P(hit)   = 3+ skill → hits on 3,4,5,6; misses on 1,2 = 4/6
  //   P(wound) = S=T → 4+ → wounds on 4,5,6; misses on 1,2,3 = 3/6
  //   P(no save) = 3+ save AP0 → saves on 3,4,5,6; fails on 1,2 = 2/6
  // P(damage per attack) = 4/6 * 3/6 * 2/6 = 24/216 = 1/9 ≈ 0.111
  // 5 attacks → expected wounds dealt = 5/9 ≈ 0.556
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'rifle', kind: 'ranged', range_in: 24,
        attacks: '5', skill: '3+', strength: 4, ap: 0, damage: '1',
      }],
      model_count: 1,
    },
    defender: {
      toughness: 4, save: '3+', wounds_per_model: 1, model_count: 5,
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 5 / 9, 0.04);
});

test('simulate: nat 1 hit always misses even with strong skill', () => {
  // 6 attacks, BS 2+ (only nat 1 misses). S=10 vs T=1 → wound on 2+ (5/6).
  // Save 7+: nat-6 always saves (1/6), so P(save fails) = 5/6.
  // P(per attack deals damage) = P(hit) * P(wound) * P(save fails)
  //   = 5/6 * 5/6 * 5/6 = 125/216 ≈ 0.579
  // 6 attacks → expected wounds = 6 * 125/216 = 750/216 ≈ 3.472
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'shot', kind: 'ranged', range_in: 12,
        attacks: '6', skill: '2+', strength: 10, ap: 0, damage: '1',
      }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '7+', wounds_per_model: 1, model_count: 6,
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 750 / 216, 0.10);
});

test('simulate: AP modifies save (3+ save, AP -2, requires 5+ to save)', () => {
  // 6 attacks, Torrent (auto-hit), S=100 vs T=1 → wound on 2+ (5/6).
  // AP -2 vs 3+ save → modified 5+. Fails on 1,2,3,4; saves on 5,6 (nat-6 already included).
  // P(save fails) = 4/6.
  // P(per attack deals damage) = 5/6 * 4/6 = 20/36 ≈ 0.556
  // 6 attacks → 6 * 20/36 = 120/36 = 10/3 ≈ 3.333
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'pierce', kind: 'ranged', range_in: 24,
        attacks: '6', skill: 'N/A', strength: 100, ap: -2, damage: '1',
      }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '3+', wounds_per_model: 1, model_count: 6,
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 10 / 3, 0.10);
});

test('simulate: invulnerable save kicks in when better than modified armor', () => {
  // AP -3 vs save 3+ → modified armor 6+. Invuln 4+. Best save = 4+ (invuln).
  // 8 attacks, Torrent (auto-hit), S=100 vs T=1 → wound on 2+ (5/6).
  // Save 4+: fails on 1,2,3 = 3/6; succeeds on 4,5,6 = 3/6.
  // P(save fails) = 3/6 = 0.5
  // P(per attack deals damage) = 5/6 * 1/2 = 5/12
  // 8 attacks → 8 * 5/12 = 40/12 = 10/3 ≈ 3.333
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'plasma', kind: 'ranged', range_in: 24,
        attacks: '8', skill: 'N/A', strength: 100, ap: -3, damage: '1',
      }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '3+', invulnerable: '4+',
      wounds_per_model: 1, model_count: 8,
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 10 / 3, 0.10);
});

test('simulate: damage > wounds_per_model still only kills one model', () => {
  // 1 attack, Torrent (auto-hit), S=100 vs T=1 → wound on 2+ (5/6).
  // Save 3+ AP-10 → modified 13+. Only nat-6 saves (1/6). P(save fails) = 5/6.
  // D=10 vs W=1: applied = min(10, 1) = 1. No spillover. At most 1 model dies per attack.
  // P(damage) = 5/6 * 5/6 = 25/36. When it deals damage: 1 model dies. Else: 0.
  // Expected models_lost = expected_wounds_dealt = 25/36 ≈ 0.694.
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'overkill', kind: 'ranged', range_in: 24,
        attacks: '1', skill: 'N/A', strength: 100, ap: -10, damage: '10',
      }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '3+', wounds_per_model: 1, model_count: 5,
    },
    trials: 20000,
  });
  within(result.expected_models_lost, 25 / 36, 0.05);
  within(result.expected_wounds_dealt, 25 / 36, 0.05);
});

test('simulate: multi-wound damage accumulates within one model before spillover blocking', () => {
  // 1 attack, Torrent (auto-hit), S=100 vs T=1 → wound on 2+ (5/6).
  // Save 3+ AP-10 → modified 13+. Only nat-6 saves (1/6). P(save fails) = 5/6.
  // D=2 vs W=4: applied = min(2, 4) = 2. Model survives (2 wounds remain). No models lost.
  // P(damage dealt) = 5/6 * 5/6 = 25/36. When damage triggers: 2 wounds dealt. Else: 0.
  // Expected wounds dealt = 2 * 25/36 = 50/36 ≈ 1.389. Expected models lost = 0.
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'D2', kind: 'ranged', range_in: 24,
        attacks: '1', skill: 'N/A', strength: 100, ap: -10, damage: '2',
      }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '3+', wounds_per_model: 4, model_count: 1,
    },
    trials: 20000,
  });
  within(result.expected_wounds_dealt, 50 / 36, 0.08);
  within(result.expected_models_lost, 0.0, 0.05);
});

test('simulate: report shape includes histogram and trials count', () => {
  const result = simulate({
    attacker: { weapons: [{
      name: 'x', kind: 'ranged', range_in: 24,
      attacks: '5', skill: '3+', strength: 4, ap: 0, damage: '1',
    }], model_count: 1 },
    defender: { toughness: 4, save: '3+', wounds_per_model: 1, model_count: 5 },
    trials: 1000,
  });
  assert.strictEqual(result.trials, 1000);
  assert.ok(Array.isArray(result.histogram_models_lost));
  assert.ok(typeof result.expected_wounds_dealt === 'number');
  assert.ok(typeof result.expected_models_lost === 'number');
  assert.ok(typeof result.p_target_destroyed === 'number');
  assert.ok(result.p_target_destroyed >= 0 && result.p_target_destroyed <= 1);
});

test('simulate: multiple weapons on the attacker stack additively', () => {
  // Two identical 5-attack weapons; expected wounds should ~double a single weapon's expectation.
  const single = simulate({
    attacker: { weapons: [{
      name: 'a', kind: 'ranged', range_in: 24,
      attacks: '5', skill: '3+', strength: 4, ap: 0, damage: '1',
    }], model_count: 1 },
    defender: { toughness: 4, save: '3+', wounds_per_model: 1, model_count: 100 },
    trials: 30000,
  });
  const dual = simulate({
    attacker: { weapons: [
      { name: 'a', kind: 'ranged', range_in: 24, attacks: '5', skill: '3+', strength: 4, ap: 0, damage: '1' },
      { name: 'b', kind: 'ranged', range_in: 24, attacks: '5', skill: '3+', strength: 4, ap: 0, damage: '1' },
    ], model_count: 1 },
    defender: { toughness: 4, save: '3+', wounds_per_model: 1, model_count: 100 },
    trials: 30000,
  });
  within(dual.expected_wounds_dealt / single.expected_wounds_dealt, 2.0, 0.10);
});
