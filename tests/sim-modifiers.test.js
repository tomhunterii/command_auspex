import { test } from 'node:test';
import assert from 'node:assert';
import { simulate } from '../app/lib/sim/combat.js';

function within(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol,
    `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`);
}

// reroll_hits: ones — recover the 1/6 of misses that were nat-1.
test('reroll_hits=ones at 4+ skill ≈ 7/12 hit rate', () => {
  const r = simulate({
    attacker: {
      weapons: [{ name: 'h', kind: 'ranged', range_in: 24, attacks: '12', skill: '4+', strength: 10, ap: 0, damage: '1' }],
      model_count: 1,
      modifiers: { reroll_hits: 'ones' },
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    trials: 50000,
  });
  // P(hit) = 0.5 + (1/6 * 0.5) = 7/12. Auto-wound 5/6, no save 5/6.
  // 12 * 7/12 * 25/36 ≈ 4.86
  within(r.expected_wounds_dealt, 4.86, 0.30);
});

// reroll_hits: all — 1 - (failure)^2.
test('reroll_hits=all at 4+ skill ≈ 3/4 hit rate', () => {
  const r = simulate({
    attacker: {
      weapons: [{ name: 'h', kind: 'ranged', range_in: 24, attacks: '12', skill: '4+', strength: 10, ap: 0, damage: '1' }],
      model_count: 1,
      modifiers: { reroll_hits: 'all' },
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    trials: 50000,
  });
  // 12 * 0.75 * 25/36 ≈ 6.25
  within(r.expected_wounds_dealt, 6.25, 0.30);
});

test('reroll_wounds=ones', () => {
  const r = simulate({
    attacker: {
      weapons: [{ name: 'w', kind: 'ranged', range_in: 24, attacks: '12', skill: 'N/A', strength: 4, ap: 0, damage: '1' }],
      model_count: 1,
      modifiers: { reroll_wounds: 'ones' },
    },
    defender: { toughness: 4, save: '7+', wounds_per_model: 100, model_count: 1 },
    trials: 50000,
  });
  // P(wound) = 0.5 + (1/6)*0.5 = 7/12. No save 5/6.
  // 12 * 7/12 * 5/6 ≈ 5.83
  within(r.expected_wounds_dealt, 5.83, 0.30);
});

test('reroll_wounds=all', () => {
  const r = simulate({
    attacker: {
      weapons: [{ name: 'w', kind: 'ranged', range_in: 24, attacks: '12', skill: 'N/A', strength: 4, ap: 0, damage: '1' }],
      model_count: 1,
      modifiers: { reroll_wounds: 'all' },
    },
    defender: { toughness: 4, save: '7+', wounds_per_model: 100, model_count: 1 },
    trials: 50000,
  });
  // 12 * 0.75 * 5/6 = 7.5
  within(r.expected_wounds_dealt, 7.5, 0.35);
});

test('plus_one_to_hit: 4+ → 3+', () => {
  const r = simulate({
    attacker: {
      weapons: [{ name: 'h', kind: 'ranged', range_in: 24, attacks: '12', skill: '4+', strength: 10, ap: 0, damage: '1' }],
      model_count: 1,
      modifiers: { plus_one_to_hit: true },
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    trials: 50000,
  });
  // 4+ +1 = 3+ → P(hit) = 4/6. 12 * 4/6 * 25/36 ≈ 5.56
  within(r.expected_wounds_dealt, 5.56, 0.30);
});

test('plus_one_to_hit caps at 2+', () => {
  const r = simulate({
    attacker: {
      weapons: [{ name: 'h', kind: 'ranged', range_in: 24, attacks: '12', skill: '2+', strength: 10, ap: 0, damage: '1' }],
      model_count: 1,
      modifiers: { plus_one_to_hit: true },
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    trials: 50000,
  });
  // 2+ unchanged. P(hit) = 5/6. 12 * 5/6 * 25/36 ≈ 6.94
  within(r.expected_wounds_dealt, 6.94, 0.30);
});

test('plus_one_to_wound: 5+ → 4+', () => {
  const r = simulate({
    attacker: {
      weapons: [{ name: 'w', kind: 'ranged', range_in: 24, attacks: '12', skill: 'N/A', strength: 3, ap: 0, damage: '1' }],
      model_count: 1,
      modifiers: { plus_one_to_wound: true },
    },
    defender: { toughness: 4, save: '7+', wounds_per_model: 100, model_count: 1 },
    trials: 50000,
  });
  // 5+ +1 = 4+ → 3/6. 12 * 3/6 * 5/6 = 5.0
  within(r.expected_wounds_dealt, 5.0, 0.30);
});

test('FNP 5+ ignores 1/3 of damage', () => {
  const r = simulate({
    attacker: {
      weapons: [{ name: 'd', kind: 'ranged', range_in: 24, attacks: '12', skill: 'N/A', strength: 100, ap: -10, damage: '1' }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1,
      modifiers: { fnp: 5 },
    },
    trials: 50000,
  });
  // strength=100 vs toughness=1 → woundT=2 → P(wound)=5/6.
  // Save: 7+ with AP-10 → threshold 17, but nat-6 always succeeds → P(fail save)=5/6.
  // FNP 5+: pass on 5 or 6 (nat-1 always fails) → P(survive FNP)=4/6.
  // 12 * 5/6 * 5/6 * 4/6 = 12 * 100/216 ≈ 5.56
  within(r.expected_wounds_dealt, 5.56, 0.40);
});

test('Cover: 4+ save → 3+ save', () => {
  const r = simulate({
    attacker: {
      weapons: [{ name: 'd', kind: 'ranged', range_in: 24, attacks: '12', skill: 'N/A', strength: 100, ap: 0, damage: '1' }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '4+', wounds_per_model: 100, model_count: 1,
      modifiers: { cover: true },
    },
    trials: 50000,
  });
  // strength=100 vs toughness=1 → woundT=2 → P(wound)=5/6.
  // 4+ +1 cover = 3+ → P(fail save)=2/6. 12 * 5/6 * 1/3 ≈ 3.33
  within(r.expected_wounds_dealt, 3.33, 0.30);
});

test('Cover caps at 3+', () => {
  const r = simulate({
    attacker: {
      weapons: [{ name: 'd', kind: 'ranged', range_in: 24, attacks: '12', skill: 'N/A', strength: 100, ap: 0, damage: '1' }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '3+', wounds_per_model: 100, model_count: 1,
      modifiers: { cover: true },
    },
    trials: 50000,
  });
  // strength=100 vs toughness=1 → woundT=2 → P(wound)=5/6.
  // 3+ +1 cover = capped at 3+ → P(fail save)=2/6. 12 * 5/6 * 1/3 ≈ 3.33
  // (same result as 4+ with cover — this verifies the cap)
  within(r.expected_wounds_dealt, 3.33, 0.30);
});

test('combined modifiers stack and produce a sane result', () => {
  // Sanity bound only.
  const r = simulate({
    attacker: {
      weapons: [{ name: 'c', kind: 'ranged', range_in: 24, attacks: '20', skill: '4+', strength: 4, ap: 0, damage: '1' }],
      model_count: 1,
      modifiers: { reroll_hits: 'all', plus_one_to_wound: true },
    },
    defender: {
      toughness: 4, save: '4+', wounds_per_model: 1, model_count: 100,
      modifiers: { fnp: 5 },
    },
    trials: 30000,
  });
  assert.ok(r.expected_wounds_dealt > 0 && r.expected_wounds_dealt < 20);
});
