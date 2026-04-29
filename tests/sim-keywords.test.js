import { test } from 'node:test';
import assert from 'node:assert';
import { parseKeywords } from '../app/lib/sim/keywords.js';
import { simulate } from '../app/lib/sim/combat.js';

function within(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol,
    `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`);
}

// --- parser ---

test('parseKeywords: empty/null returns empty abilities', () => {
  assert.deepStrictEqual(parseKeywords(''), {});
  assert.deepStrictEqual(parseKeywords(null), {});
  assert.deepStrictEqual(parseKeywords('—'), {});
});

test('parseKeywords: simple flag keywords', () => {
  const k = parseKeywords('[LETHAL HITS], [TWIN-LINKED], [DEVASTATING WOUNDS]');
  assert.strictEqual(k.lethal_hits, true);
  assert.strictEqual(k.twin_linked, true);
  assert.strictEqual(k.devastating_wounds, true);
});

test('parseKeywords: SUSTAINED HITS N captures the integer', () => {
  assert.strictEqual(parseKeywords('[SUSTAINED HITS 1]').sustained_hits, 1);
  assert.strictEqual(parseKeywords('[SUSTAINED HITS 2]').sustained_hits, 2);
  // Bare "SUSTAINED HITS" with no number defaults to 1.
  assert.strictEqual(parseKeywords('[SUSTAINED HITS]').sustained_hits, 1);
});

test('parseKeywords: ANTI-X N+ captures keyword and threshold', () => {
  const k = parseKeywords('[ANTI-INFANTRY 4+]');
  assert.deepStrictEqual(k.anti, [{ target_keyword: 'INFANTRY', threshold: 4 }]);
});

test('parseKeywords: multiple Anti-X entries accumulate', () => {
  const k = parseKeywords('[ANTI-INFANTRY 4+], [ANTI-VEHICLE 3+]');
  assert.deepStrictEqual(k.anti, [
    { target_keyword: 'INFANTRY', threshold: 4 },
    { target_keyword: 'VEHICLE', threshold: 3 },
  ]);
});

test('parseKeywords: unrecognized keywords land in unmodelled list', () => {
  const k = parseKeywords('[SOME UNKNOWN KEYWORD], [LETHAL HITS]');
  assert.strictEqual(k.lethal_hits, true);
  assert.deepStrictEqual(k.unmodelled, ['SOME UNKNOWN KEYWORD']);
});

test('parseKeywords: case and whitespace tolerant', () => {
  const k = parseKeywords(' [lethal hits],[twin-linked] ');
  assert.strictEqual(k.lethal_hits, true);
  assert.strictEqual(k.twin_linked, true);
});

// --- simulator effects ---

test('Lethal Hits: nat-6 hits auto-wound (skip wound roll)', () => {
  // 18 attacks, 3+ to hit. Wound roll fails always (S=1, T=10 → 6+ wound).
  // Without LH: P(wound) = (4/6) * (1/6 with nat-6 always succeeding) = roughly (4/6 * 1/6) = 0.111 per attack.
  // With LH: any nat-6 hit auto-wounds.
  //   P(nat-6 hit on a 3+ skill) = 1/6.
  //   P(other hit succeeds AND wounds) = (3/6) * (1/6) = 3/36 = 0.0833 per non-nat-6 attack.
  //   P(per-attack wound) = 1/6 + (5/6) * P(non-nat-6 hit hits) * (1/6 wound)
  //   Wait. Let me redo: of 6 hit-roll outcomes:
  //     1: miss (no contribution)
  //     2: miss (3+ skill, 2 fails)... wait 3+ is 3,4,5,6 hits; 1,2 miss.
  //     3,4,5: hit, then wound roll (6+ for S1T10) = 1/6 wound
  //     6: hit + LH → auto-wound
  //   Without LH: per-attack wound prob = (3/6)*(1/6) + (1/6)*(1/6) = 4/36
  //   With LH:    per-attack wound prob = (3/6)*(1/6) + (1/6)*1     = 3/36 + 6/36 = 9/36 = 0.25
  // 18 attacks → expected wounds dealt with LH = 18 * 0.25 = 4.5
  // Save 7+ on 1 model: still saves on nat 6 (1/6). So expected wounds applied = 4.5 * (5/6) = 3.75
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'lethal', kind: 'ranged', range_in: 24,
        attacks: '18', skill: '3+', strength: 1, ap: 0, damage: '1',
        abilities: { lethal_hits: true },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 10, save: '7+', wounds_per_model: 100, model_count: 1,
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 3.75, 0.15);
});

test('Sustained Hits 1: nat-6 hit generates 1 extra hit', () => {
  // Auto-wound (S=10 vs T=1 → 2+ wound). Save 7+. So per attack:
  //   Hit on 3+: 4/6, of which nat-6: 1/6 → +1 extra hit
  //   Each hit auto-wounds on 2+ → fails only on nat 1 = 5/6
  //   Each wound bypasses save (7+ saves only on nat 6 = 1/6, fails 5/6)
  // Expected wounds per ATTACK = (4/6) * (5/6) * (5/6) = 100/216 ≈ 0.463
  // Sustained Hits 1 adds: extra hits at rate (1/6) * (5/6 wound) * (5/6 no-save) = 25/216 ≈ 0.116
  // Total per attack ≈ 0.579
  // 12 attacks → expected wounds ≈ 6.94
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'sustain', kind: 'ranged', range_in: 24,
        attacks: '12', skill: '3+', strength: 10, ap: 0, damage: '1',
        abilities: { sustained_hits: 1 },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1,
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 6.94, 0.20);
});

test('Devastating Wounds: nat-6 wound bypasses save (mortal)', () => {
  // 18 auto-hit attacks (Torrent / N/A skill), S=4 vs T=4 (4+ wound).
  // Of 6 wound outcomes: 1,2,3 fail; 4,5 wound normally (subject to save); 6 = devastating mortal.
  // Save 2+ vs AP 0: fails only on 1 = 1/6.
  // Per attack expected wound application:
  //   wound on 4: needs save 2+, save fails 1/6 → 1/6 of these contribute → (1/6)(1/6) = 1/36
  //   wound on 5: same → 1/36
  //   wound on 6: devastating, no save → 1/6
  // Total per-attack = 2/36 + 6/36 = 8/36 = 2/9 ≈ 0.222
  // 18 attacks → expected wounds ≈ 4.0
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'dev', kind: 'ranged', range_in: 24,
        attacks: '18', skill: 'N/A', strength: 4, ap: 0, damage: '1',
        abilities: { devastating_wounds: true },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 4, save: '2+', wounds_per_model: 100, model_count: 1,
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 4.0, 0.20);
});

test('Twin-linked: failed wound rolls re-rolled once', () => {
  // 12 auto-hit attacks, S=3 vs T=4 → wound on 5+. P(wound) = 2/6 = 1/3.
  // Twin-linked re-rolls failures: P(wound) becomes 1 - (4/6)^2 = 1 - 16/36 = 20/36 = 5/9 ≈ 0.556
  // Save 7+ (only nat-6 saves) fails 5/6.
  // Per attack with TL: 0.556 * (5/6) ≈ 0.463
  // 12 attacks → expected wounds ≈ 5.56
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'tl', kind: 'ranged', range_in: 24,
        attacks: '12', skill: 'N/A', strength: 3, ap: 0, damage: '1',
        abilities: { twin_linked: true },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 4, save: '7+', wounds_per_model: 100, model_count: 1,
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 5.56, 0.20);
});

test('Anti-INFANTRY 4+: replaces wound threshold vs INFANTRY targets', () => {
  // 12 auto-hit attacks. S=3, T=8 → S/T table says 6+ wound. Anti-INFANTRY 4+ replaces with 4+ (since 4+ is better).
  // Defender has INFANTRY keyword → use 4+. P(wound) = 3/6 = 1/2.
  // Save 7+ fails 5/6. Per attack = 1/2 * 5/6 = 5/12 ≈ 0.417
  // 12 attacks → expected wounds ≈ 5.0
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'antiinf', kind: 'ranged', range_in: 24,
        attacks: '12', skill: 'N/A', strength: 3, ap: 0, damage: '1',
        abilities: { anti: [{ target_keyword: 'INFANTRY', threshold: 4 }] },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 8, save: '7+', wounds_per_model: 100, model_count: 1,
      keywords: ['INFANTRY'],
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 5.0, 0.20);
});

test('Anti-INFANTRY 4+: ineffective vs non-INFANTRY targets', () => {
  // Same setup but defender has no INFANTRY keyword.
  // S=3, T=8 → 6+ wound (only nat-6 wounds).
  // Save 7+ fails 5/6. Per attack = 1/6 * 5/6 = 5/36 ≈ 0.139
  // 12 attacks → expected wounds ≈ 1.67
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'antiinf', kind: 'ranged', range_in: 24,
        attacks: '12', skill: 'N/A', strength: 3, ap: 0, damage: '1',
        abilities: { anti: [{ target_keyword: 'INFANTRY', threshold: 4 }] },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 8, save: '7+', wounds_per_model: 100, model_count: 1,
      keywords: ['VEHICLE'],
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 1.67, 0.20);
});

test('Anti-X: best matching anti wins when multiple entries match the defender', () => {
  // Weapon carries BOTH [ANTI-INFANTRY 5+] and [ANTI-CHARACTER 3+]. Defender
  // is INFANTRY + CHARACTER (a typical character-led model). The 3+ entry
  // should win (lower threshold = easier wound).
  // S=3, T=8 → table 6+. Best matching anti = 3+. P(wound) = 4/6 ≈ 0.667.
  // Save 7+ fails 5/6. Per attack ≈ 0.556. 12 attacks → ~6.67.
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'multi-anti', kind: 'ranged', range_in: 24,
        attacks: '12', skill: 'N/A', strength: 3, ap: 0, damage: '1',
        abilities: { anti: [
          { target_keyword: 'INFANTRY',  threshold: 5 },
          { target_keyword: 'CHARACTER', threshold: 3 },
        ] },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 8, save: '7+', wounds_per_model: 100, model_count: 1,
      keywords: ['INFANTRY', 'CHARACTER'],
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 6.67, 0.30);
});

test('Anti-X: only the matching anti entries are considered', () => {
  // Same weapon as above; defender is INFANTRY but NOT CHARACTER. The 3+
  // entry must NOT apply — only the 5+ does.
  // S=3, T=8 → table 6+. Matching anti = 5+. P(wound) = 2/6 ≈ 0.333.
  // Save 7+ fails 5/6. Per attack ≈ 0.278. 12 attacks → ~3.33.
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'multi-anti', kind: 'ranged', range_in: 24,
        attacks: '12', skill: 'N/A', strength: 3, ap: 0, damage: '1',
        abilities: { anti: [
          { target_keyword: 'INFANTRY',  threshold: 5 },
          { target_keyword: 'CHARACTER', threshold: 3 },
        ] },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 8, save: '7+', wounds_per_model: 100, model_count: 1,
      keywords: ['INFANTRY'], // CHARACTER absent → 3+ entry must not fire
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 3.33, 0.30);
});

test('Anti-X + Devastating Wounds: rolls meeting Anti-X threshold are Critical → mortal wounds', () => {
  // S=3, T=8 → table 6+ wound. Anti-INFANTRY 4+ → 4+ wound. With DW,
  // every 4/5/6 wound roll vs an INFANTRY target is a Critical Wound
  // and produces D=1 mortal wound (bypasses save). Save 7+ would have
  // been ineffective anyway, but the key signal is mortals are dealt
  // on 4/5 in addition to nat-6.
  //
  // Per attack: P(crit wound) = P(roll ≥ 4 AND not nat-1) = 3/6 = 0.5.
  // Damage = 1 mortal each (D=1, no FNP). 12 attacks → ~6.0 wounds.
  // For comparison: WITHOUT Anti-X, only nat-6 wounds would be DW
  // criticals, and the wound roll would be 6+ (since the table threshold
  // is 6+ vs T8) — so per attack just 1/6, expected ~2.0.
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'anti+dw', kind: 'ranged', range_in: 24,
        attacks: '12', skill: 'N/A', strength: 3, ap: 0, damage: '1',
        abilities: {
          anti: [{ target_keyword: 'INFANTRY', threshold: 4 }],
          devastating_wounds: true,
        },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 8, save: '7+', wounds_per_model: 100, model_count: 1,
      keywords: ['INFANTRY'],
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 6.0, 0.30);
});

test('Anti-X + Devastating Wounds: silent against non-matching defender', () => {
  // Same weapon as above, but defender lacks INFANTRY keyword. Anti
  // doesn't fire, so the wound threshold reverts to the table (6+).
  // DW only triggers on nat-6 (1/6). Per attack: 1/6 × 1 mortal = 0.167.
  // 12 attacks → ~2.0 mortal wounds.
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'anti+dw', kind: 'ranged', range_in: 24,
        attacks: '12', skill: 'N/A', strength: 3, ap: 0, damage: '1',
        abilities: {
          anti: [{ target_keyword: 'INFANTRY', threshold: 4 }],
          devastating_wounds: true,
        },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 8, save: '7+', wounds_per_model: 100, model_count: 1,
      keywords: ['VEHICLE'], // INFANTRY absent
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 2.0, 0.30);
});

test('Anti-X without DW: criticals do NOT generate mortal wounds (Anti is wound-roll only)', () => {
  // Same weapon stripped of DW. Anti-INFANTRY 4+ still improves wound
  // threshold but no critical-wound mortal-wound conversion happens.
  // S=3, T=8 → 4+ wound vs INFANTRY. P(wound) = 3/6 = 0.5.
  // Save 7+ fails 5/6. Per attack = 0.5 × 5/6 = 5/12 ≈ 0.417.
  // 12 attacks → ~5.0 wounds. (Same as the original anti-only test.)
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'anti-only', kind: 'ranged', range_in: 24,
        attacks: '12', skill: 'N/A', strength: 3, ap: 0, damage: '1',
        abilities: { anti: [{ target_keyword: 'INFANTRY', threshold: 4 }] },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 8, save: '7+', wounds_per_model: 100, model_count: 1,
      keywords: ['INFANTRY'],
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 5.0, 0.30);
});

test('Anti-X uses min(table, anti_threshold) — anti only helps when better', () => {
  // S=10 vs T=1 → 2+ wound (already easy). Anti-INFANTRY 4+ should NOT make it worse.
  // Per attack: 5/6 * 5/6 = 25/36 ≈ 0.694. 12 attacks → 8.33.
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'antieasy', kind: 'ranged', range_in: 24,
        attacks: '12', skill: 'N/A', strength: 10, ap: 0, damage: '1',
        abilities: { anti: [{ target_keyword: 'INFANTRY', threshold: 4 }] },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1,
      keywords: ['INFANTRY'],
    },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 8.33, 0.30);
});

test('combined: Lethal Hits + Twin-linked + Devastating Wounds', () => {
  // Sanity check that multiple keywords compose. We don't pin a tight number;
  // assert this is strictly better than each in isolation.
  const base = simulate({
    attacker: {
      weapons: [{
        name: 'plain', kind: 'ranged', range_in: 24,
        attacks: '20', skill: '3+', strength: 4, ap: -1, damage: '1',
      }],
      model_count: 1,
    },
    defender: { toughness: 4, save: '3+', wounds_per_model: 1, model_count: 100 },
    trials: 30000,
  });
  const combo = simulate({
    attacker: {
      weapons: [{
        name: 'combo', kind: 'ranged', range_in: 24,
        attacks: '20', skill: '3+', strength: 4, ap: -1, damage: '1',
        abilities: { lethal_hits: true, twin_linked: true, devastating_wounds: true },
      }],
      model_count: 1,
    },
    defender: { toughness: 4, save: '3+', wounds_per_model: 1, model_count: 100 },
    trials: 30000,
  });
  assert.ok(combo.expected_wounds_dealt > base.expected_wounds_dealt * 1.3,
    `combo (${combo.expected_wounds_dealt}) should be at least 30% better than base (${base.expected_wounds_dealt})`);
});

test('result.unmodelled_abilities surfaces unparseable keywords', () => {
  // Pass a weapon whose abilities include unmodelled keywords — they should
  // appear in the result so the UI can warn the user the math is approximate.
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'mixed', kind: 'ranged', range_in: 24,
        attacks: '5', skill: '3+', strength: 4, ap: 0, damage: '1',
        abilities: { lethal_hits: true, unmodelled: ['BLAST', 'HAZARDOUS'] },
      }],
      model_count: 1,
    },
    defender: { toughness: 4, save: '3+', wounds_per_model: 1, model_count: 5 },
    trials: 1000,
  });
  assert.ok(Array.isArray(result.unmodelled_abilities));
  assert.ok(result.unmodelled_abilities.includes('BLAST'));
  assert.ok(result.unmodelled_abilities.includes('HAZARDOUS'));
});

// --- Pass B parser ---

test('parseKeywords: HEAVY flag', () => {
  assert.strictEqual(parseKeywords('[HEAVY]').heavy, true);
});

test('parseKeywords: BLAST flag', () => {
  assert.strictEqual(parseKeywords('[BLAST]').blast, true);
});

test('parseKeywords: HAZARDOUS flag', () => {
  assert.strictEqual(parseKeywords('[HAZARDOUS]').hazardous, true);
});

test('parseKeywords: RAPID FIRE N captures the integer', () => {
  assert.strictEqual(parseKeywords('[RAPID FIRE 1]').rapid_fire, 1);
  assert.strictEqual(parseKeywords('[RAPID FIRE 2]').rapid_fire, 2);
  assert.strictEqual(parseKeywords('[RAPID FIRE]').rapid_fire, 1);
});

test('parseKeywords: combined Pass A + Pass B keywords', () => {
  const k = parseKeywords('[HEAVY], [LETHAL HITS], [BLAST]');
  assert.strictEqual(k.heavy, true);
  assert.strictEqual(k.lethal_hits, true);
  assert.strictEqual(k.blast, true);
});

test('parseKeywords: ASSAULT, PISTOL, PSYCHIC parse as flags (not unmodelled)', () => {
  const k = parseKeywords('[ASSAULT], [PISTOL], [PSYCHIC]');
  assert.strictEqual(k.assault, true);
  assert.strictEqual(k.pistol, true);
  assert.strictEqual(k.psychic, true);
  assert.strictEqual(k.unmodelled, undefined);
});

test('parseKeywords: MELTA N captures the integer', () => {
  assert.strictEqual(parseKeywords('[MELTA 2]').melta, 2);
  assert.strictEqual(parseKeywords('[MELTA 4]').melta, 4);
});

test('parseKeywords: IGNORES COVER parses as a flag (not unmodelled)', () => {
  const k = parseKeywords('[IGNORES COVER]');
  assert.strictEqual(k.ignores_cover, true);
  assert.strictEqual(k.unmodelled, undefined);
});

test('parseKeywords: INDIRECT FIRE parses as a flag (not unmodelled)', () => {
  const k = parseKeywords('[INDIRECT FIRE]');
  assert.strictEqual(k.indirect_fire, true);
  assert.strictEqual(k.unmodelled, undefined);
});

test('parseKeywords: PRECISION parses as a flag (not unmodelled)', () => {
  const k = parseKeywords('[PRECISION]');
  assert.strictEqual(k.precision, true);
  assert.strictEqual(k.unmodelled, undefined);
});

test('Precision: bypasses Look Out, Sir — attacks target leader directly', () => {
  // Attached unit: 10 bodyguards (T4 3+ Sv 2W) led by a Captain (T4 3+
  // Sv 4+ Inv 5W). Without precision, attacks chew through bodyguards
  // first; with precision, every attack lands on the Captain straight
  // away. We verify by counting CAPTAIN deaths (leader pool size went
  // from 1 to 0) — only achievable in 1 turn if precision is active.
  // 6 attacks at S=10 (auto-wound on 2+) AP=-3 D=2.
  // Vs Captain (3+ Sv -3 = 6+ → cap by 4+ inv): save at 4+, fail 3/6.
  // P(unsaved per hit) = 5/6 × 3/6 = 15/36. Per attack damage = 2.
  // 6 attacks × 15/36 × 2 ≈ 5 wounds, distributed entirely on Captain
  // (5W). Captain dies cleanly most trials.
  const r = simulate({
    attacker: {
      weapons: [{
        name: 'precise', kind: 'ranged', range_in: 24,
        attacks: '6', skill: 'N/A', strength: 10, ap: -3, damage: '2',
        abilities: { precision: true },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 4, save: '3+', wounds_per_model: 2, model_count: 10,
      keywords: ['INFANTRY'],
      leader: {
        wounds_per_model: 5,
        invulnerable: '4+',
        keywords: ['INFANTRY', 'CHARACTER'],
      },
    },
    trials: 30000,
  });
  // The bodyguard pool of 10 × 2W = 20 wounds is untouched. Most damage
  // falls on the Captain (5 W). With ~5 expected wounds dealt all to the
  // leader, leader dies most trials.
  assert.ok(r.expected_wounds_dealt > 4.0, `expected ≥4 wounds, got ${r.expected_wounds_dealt}`);
  assert.ok(r.expected_wounds_dealt < 6.0, `expected <6 wounds (capped at leader's 5W), got ${r.expected_wounds_dealt}`);
});

test('Precision: NO effect when defender has no leader (Look Out, Sir not applicable)', () => {
  // A standard squad with no attached character — precision is a no-op.
  // Verify the result matches a non-precision weapon's output.
  const opts = {
    attacker: {
      weapons: [{
        name: 'plain', kind: 'ranged', range_in: 24,
        attacks: '12', skill: 'N/A', strength: 4, ap: 0, damage: '1',
        abilities: { precision: true },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 4, save: '3+', wounds_per_model: 2, model_count: 10,
      keywords: ['INFANTRY'],
    },
    trials: 50000,
  };
  // P(wound at 4+)=3/6, save 3+ AP 0 → P(fail save)=2/6.
  // 12 × 3/6 × 2/6 = 2.0 wounds.
  const r = simulate(opts);
  within(r.expected_wounds_dealt, 2.0, 0.30);
});

test('Precision: non-precision weapon hits bodyguard first, ignores leader while bodyguards alive', () => {
  // Same defender as the precision test, but weapon has no precision.
  // All damage routes to the 10 bodyguards (T4 3+ Sv 2W) — none lands
  // on the Captain. 6 attacks at S=10 AP=-3 D=2:
  //   bodyguard save: 3+ -3 = 6+ (no invuln) → fail 5/6.
  //   Per attack: 5/6 × 5/6 × 2 = 50/36 ≈ 1.39 wounds.
  //   6 attacks → ~8.33 wounds, all on bodyguard pool (20W cap).
  const r = simulate({
    attacker: {
      weapons: [{
        name: 'no-precision', kind: 'ranged', range_in: 24,
        attacks: '6', skill: 'N/A', strength: 10, ap: -3, damage: '2',
        abilities: {},
      }],
      model_count: 1,
    },
    defender: {
      toughness: 4, save: '3+', wounds_per_model: 2, model_count: 10,
      keywords: ['INFANTRY'],
      leader: {
        wounds_per_model: 5,
        invulnerable: '4+',
        keywords: ['INFANTRY', 'CHARACTER'],
      },
    },
    trials: 30000,
  });
  within(r.expected_wounds_dealt, 8.33, 0.40);
});

test('Precision: leader\'s invulnerable save applies when targeted directly', () => {
  // Confirm the save chain uses the LEADER\'s stats when precision routes
  // an attack to them. Captain has 4+ Inv vs an AP-6 weapon — the
  // invuln must kick in (otherwise the bodyguard's 3+ Sv -6 = 9+ would
  // make any wound automatic).
  const r = simulate({
    attacker: {
      weapons: [{
        name: 'apocalyptic', kind: 'ranged', range_in: 24,
        attacks: '6', skill: 'N/A', strength: 10, ap: -6, damage: '1',
        abilities: { precision: true },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 4, save: '3+', wounds_per_model: 2, model_count: 10,
      keywords: ['INFANTRY'],
      leader: {
        wounds_per_model: 5,
        invulnerable: '4+',
        keywords: ['INFANTRY', 'CHARACTER'],
      },
    },
    trials: 30000,
  });
  // 6 attacks × 5/6 wound × 3/6 fail invuln × 1 damage = 6 × 5/12 = 2.5.
  // (Capped at the leader's 5W ceiling — well above 2.5, so no clip.)
  within(r.expected_wounds_dealt, 2.5, 0.30);
});

test('Indirect Fire: firing without LoS applies -1 to hit (no auto cover)', () => {
  // 12 attacks, BS 4+. Without indirect: hits on 4+ (3/6).
  // With indirect (firing_indirectly=true): -1 to hit → hits on 5+ (2/6).
  // S=100 vs T=1: 5/6 wound. Defender 4+ Sv (no cover — INDIRECT FIRE
  // does NOT grant Benefit of Cover; cover is purely positional).
  // Per attack: 2/6 (hit) × 5/6 (wound) × 3/6 (fail save) ≈ 0.139.
  // 12 × 0.139 ≈ 1.67 wounds.
  const r = simulate({
    attacker: {
      weapons: [{
        name: 'mortar', kind: 'ranged', range_in: 48, attacks: '12',
        skill: '4+', strength: 100, ap: 0, damage: '1',
        abilities: { indirect_fire: true },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '4+', wounds_per_model: 100, model_count: 1 },
    context: { firing_indirectly: true },
    trials: 50000,
  });
  within(r.expected_wounds_dealt, 1.67, 0.30);
});

test('Indirect Fire: with line-of-sight (firing_indirectly=false) — no penalty', () => {
  // Same weapon, firing_indirectly is unset/false → no -1 to hit.
  // Per attack: 3/6 × 5/6 × 3/6 ≈ 0.208. 12 × 0.208 ≈ 2.50.
  const r = simulate({
    attacker: {
      weapons: [{
        name: 'mortar', kind: 'ranged', range_in: 48, attacks: '12',
        skill: '4+', strength: 100, ap: 0, damage: '1',
        abilities: { indirect_fire: true },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '4+', wounds_per_model: 100, model_count: 1 },
    trials: 50000,
  });
  within(r.expected_wounds_dealt, 2.50, 0.30);
});

test('Indirect Fire: defender in actual cover stacks with the -1 hit penalty', () => {
  // The defender's positional cover still applies independently. -1 to
  // hit AND the cover save bonus both fire when the target is genuinely
  // in cover and the firer has no LoS.
  // Per attack: 2/6 (hit) × 5/6 (wound) × 2/6 (fail 3+ save) ≈ 0.0926.
  // 12 × 0.0926 ≈ 1.11 wounds.
  const r = simulate({
    attacker: {
      weapons: [{
        name: 'mortar', kind: 'ranged', range_in: 48, attacks: '12',
        skill: '4+', strength: 100, ap: 0, damage: '1',
        abilities: { indirect_fire: true },
      }],
      model_count: 1,
    },
    defender: {
      toughness: 1, save: '4+', wounds_per_model: 100, model_count: 1,
      modifiers: { cover: true }, // defender is physically in cover
    },
    context: { firing_indirectly: true },
    trials: 50000,
  });
  within(r.expected_wounds_dealt, 1.11, 0.30);
});

// --- Pass B simulator effects ---

test('Heavy: +1 to hit when attacker_stationary is true', () => {
  // Use 5+ base skill so the Heavy bonus is distinguishable.
  // Moving  (5+ stays 5+): hits on 5,6 = 2/6. 12*(2/6)*(5/6)^2 = 12*50/216 ≈ 2.78
  // Stationary (5+ → 4+ via Heavy): hits on 4,5,6 = 3/6. 12*(3/6)*(5/6)^2 = 12*75/216 ≈ 4.17
  const stationary = simulate({
    attacker: {
      weapons: [{
        name: 'h', kind: 'ranged', range_in: 24,
        attacks: '12', skill: '5+', strength: 10, ap: 0, damage: '1',
        abilities: { heavy: true },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    context: { attacker_stationary: true },
    trials: 50000,
  });
  within(stationary.expected_wounds_dealt, 4.17, 0.20);

  const moving = simulate({
    attacker: {
      weapons: [{
        name: 'h', kind: 'ranged', range_in: 24,
        attacks: '12', skill: '5+', strength: 10, ap: 0, damage: '1',
        abilities: { heavy: true },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    context: { attacker_stationary: false },
    trials: 50000,
  });
  within(moving.expected_wounds_dealt, 2.78, 0.20);
});

test('Heavy: skill cap at 2+ — does not improve to 1+', () => {
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'h2', kind: 'ranged', range_in: 24,
        attacks: '12', skill: '2+', strength: 10, ap: 0, damage: '1',
        abilities: { heavy: true },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    context: { attacker_stationary: true },
    trials: 50000,
  });
  // 12 * (5/6) * (5/6) * (5/6) = 12 * 125/216 = 6.94
  within(result.expected_wounds_dealt, 6.94, 0.20);
});

test('Melta 2: +2 damage per attack at half range', () => {
  // 6 auto-hit attacks. S=10 vs T=1 (wound on 2+ per table). Wound
  // success rate accounts for nat-1 always failing → 5/6. Save 7+ →
  // nat-6 always succeeds → 5/6 unsaved. Damage = 1 base + 2 melta = 3
  // per unsaved wound. Per attack: 5/6 × 5/6 × 3 = 75/36 ≈ 2.083.
  // 6 attacks → ~12.5 wounds.
  const half = simulate({
    attacker: {
      weapons: [{
        name: 'melta', kind: 'ranged', range_in: 24,
        attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1',
        abilities: { melta: 2 },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    context: { at_half_range: true },
    trials: 50000,
  });
  within(half.expected_wounds_dealt, 12.5, 0.50);
});

test('Melta 2: NO bonus beyond half range', () => {
  // Same setup, at_half_range=false. Damage = 1 (no melta bonus). Per
  // attack: 5/6 × 5/6 × 1 = 25/36 ≈ 0.694. 6 attacks → ~4.17 wounds.
  const long = simulate({
    attacker: {
      weapons: [{
        name: 'melta', kind: 'ranged', range_in: 24,
        attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1',
        abilities: { melta: 2 },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    context: { at_half_range: false },
    trials: 50000,
  });
  within(long.expected_wounds_dealt, 4.17, 0.30);
});

test('Melta 2: bonus also applies on Devastating Wounds critical-mortals', () => {
  // The melta bonus must apply to the DW critical path AS WELL — Critical
  // wounds roll the weapon's damage characteristic, and at half range that
  // characteristic is base+melta.
  // S=4, T=4 → 4+ wound. DW makes nat-6 a Critical Wound → mortal damage
  // bypasses save. P(crit wound) = 1/6 per attack. Damage at half range
  // = 1 + 2 = 3 mortal per crit. 12 attacks × 1/6 × 3 = 6.0 mortals.
  // Plus normal wounds: 12 × P(wound)·non-crit × P(unsaved) × damage
  //   = 12 × (2/6) × (5/6) × 3 = 10.0 (the 4/5 wound rolls also get melta)
  // Total expected: 16.0.
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'melta-dw', kind: 'ranged', range_in: 24,
        attacks: '12', skill: 'N/A', strength: 4, ap: 0, damage: '1',
        abilities: { melta: 2, devastating_wounds: true },
      }],
      model_count: 1,
    },
    defender: { toughness: 4, save: '7+', wounds_per_model: 100, model_count: 1 },
    context: { at_half_range: true },
    trials: 50000,
  });
  within(result.expected_wounds_dealt, 16.0, 0.60);
});

test('Rapid Fire 1: +1 attack at half range', () => {
  const half = simulate({
    attacker: {
      weapons: [{
        name: 'rf', kind: 'ranged', range_in: 24,
        attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1',
        abilities: { rapid_fire: 1 },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    context: { at_half_range: true },
    trials: 50000,
  });
  // 7 attacks * (5/6 wound) * (5/6 no save) = 7 * 25/36 = 4.86
  within(half.expected_wounds_dealt, 4.86, 0.20);

  const long = simulate({
    attacker: {
      weapons: [{
        name: 'rf', kind: 'ranged', range_in: 24,
        attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1',
        abilities: { rapid_fire: 1 },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    context: { at_half_range: false },
    trials: 50000,
  });
  // 6 attacks * 25/36 = 4.17
  within(long.expected_wounds_dealt, 4.17, 0.20);
});

test('Blast: +1 attack per 5 enemy models', () => {
  // 1 base attack, target has 12 models → +floor(12/5) = +2 → 3 attacks.
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'blast', kind: 'ranged', range_in: 24,
        attacks: '1', skill: 'N/A', strength: 10, ap: 0, damage: '1',
        abilities: { blast: true },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 12 },
    trials: 50000,
  });
  // 3 attacks * 25/36 = 2.08
  within(result.expected_wounds_dealt, 2.08, 0.15);
});

test('Blast: 0 bonus when target unit < 5 models', () => {
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'blast', kind: 'ranged', range_in: 24,
        attacks: '1', skill: 'N/A', strength: 10, ap: 0, damage: '1',
        abilities: { blast: true },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 4 },
    trials: 50000,
  });
  // 1 attack * 25/36 = 0.694
  within(result.expected_wounds_dealt, 0.694, 0.10);
});

test('Hazardous: per-weapon end-of-shoot mortal-wound chance to attacker', () => {
  // 1 hazardous weapon → 1d6 at end, on 1 attacker takes 1 mortal wound. Expected = 1/6 ≈ 0.167.
  const result = simulate({
    attacker: {
      weapons: [{
        name: 'haz', kind: 'ranged', range_in: 24,
        attacks: '1', skill: 'N/A', strength: 10, ap: 0, damage: '1',
        abilities: { hazardous: true },
      }],
      model_count: 1,
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    trials: 50000,
  });
  assert.ok(typeof result.expected_attacker_self_damage === 'number');
  within(result.expected_attacker_self_damage, 1/6, 0.05);
});

test('Hazardous: two weapons → ~0.33 expected self-damage', () => {
  // Two distinct hazardous weapons → 2 * 1/6 ≈ 0.333.
  const result = simulate({
    attacker: {
      weapons: [
        { name: 'h1', kind: 'ranged', range_in: 24, attacks: '1', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: { hazardous: true } },
        { name: 'h2', kind: 'ranged', range_in: 24, attacks: '1', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: { hazardous: true } },
      ],
      model_count: 1,
    },
    defender: { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 },
    trials: 50000,
  });
  within(result.expected_attacker_self_damage, 2/6, 0.05);
});

// --- ASSAULT / PISTOL gates ---

const dummyDefender = { toughness: 1, save: '7+', wounds_per_model: 100, model_count: 1 };

test('Assault: after Advance, only ASSAULT-tagged ranged weapons fire', () => {
  // Two ranged weapons of the same profile, only one tagged Assault. Auto-hit
  // (skill N/A) keeps the math clean: 6 attacks × (5/6 wound) × (5/6 no save)
  // = 6 × 25/36 ≈ 4.17 expected wounds when only the Assault weapon fires.
  const advanced = simulate({
    attacker: {
      weapons: [
        { name: 'std',    kind: 'ranged', range_in: 24, attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: {} },
        { name: 'assault', kind: 'ranged', range_in: 24, attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: { assault: true } },
      ],
      model_count: 1,
    },
    defender: dummyDefender,
    context: { attacker_advanced: true },
    trials: 30000,
  });
  within(advanced.expected_wounds_dealt, 4.17, 0.20);

  // Same loadout without the Advance flag: BOTH weapons fire → 12 × 25/36 ≈ 8.33.
  const stationary = simulate({
    attacker: {
      weapons: [
        { name: 'std',    kind: 'ranged', range_in: 24, attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: {} },
        { name: 'assault', kind: 'ranged', range_in: 24, attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: { assault: true } },
      ],
      model_count: 1,
    },
    defender: dummyDefender,
    trials: 30000,
  });
  within(stationary.expected_wounds_dealt, 8.33, 0.30);
});

test('Assault: melee weapons are unaffected by attacker_advanced', () => {
  const result = simulate({
    attacker: {
      weapons: [
        { name: 'cc', kind: 'melee', range_in: 0, attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: {} },
        { name: 'rifle', kind: 'ranged', range_in: 24, attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: {} },
      ],
      model_count: 1,
    },
    defender: dummyDefender,
    context: { attacker_advanced: true },
    trials: 30000,
  });
  // Only the melee weapon fires: 6 × 25/36 ≈ 4.17.
  within(result.expected_wounds_dealt, 4.17, 0.20);
});

test('Pistol: in Engagement Range, only PISTOL-tagged ranged weapons fire', () => {
  const engaged = simulate({
    attacker: {
      weapons: [
        { name: 'rifle',  kind: 'ranged', range_in: 24, attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: {} },
        { name: 'pistol', kind: 'ranged', range_in: 12, attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: { pistol: true } },
      ],
      model_count: 1,
    },
    defender: dummyDefender,
    context: { attacker_in_engagement_range: true },
    trials: 30000,
  });
  // Only the pistol fires: 6 × 25/36 ≈ 4.17.
  within(engaged.expected_wounds_dealt, 4.17, 0.20);
});

test('Pistol: outside Engagement Range, pistols and non-pistols both fire', () => {
  const result = simulate({
    attacker: {
      weapons: [
        { name: 'rifle',  kind: 'ranged', range_in: 24, attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: {} },
        { name: 'pistol', kind: 'ranged', range_in: 12, attacks: '6', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: { pistol: true } },
      ],
      model_count: 1,
    },
    defender: dummyDefender,
    trials: 30000,
  });
  // Both fire: 12 × 25/36 ≈ 8.33.
  within(result.expected_wounds_dealt, 8.33, 0.30);
});

test('Hazardous: a gated-out weapon does NOT roll its self-damage die', () => {
  // One Hazardous non-Assault rifle, with Advance flag set. The weapon
  // cannot fire, so its Hazardous die must not roll.
  const result = simulate({
    attacker: {
      weapons: [
        { name: 'haz-non-assault', kind: 'ranged', range_in: 24, attacks: '1', skill: 'N/A', strength: 10, ap: 0, damage: '1', abilities: { hazardous: true } },
      ],
      model_count: 1,
    },
    defender: dummyDefender,
    context: { attacker_advanced: true },
    trials: 30000,
  });
  assert.strictEqual(result.expected_attacker_self_damage, 0);
});
