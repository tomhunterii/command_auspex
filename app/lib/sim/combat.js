// app/lib/sim/combat.js
//
// Monte Carlo combat simulator for Warhammer 40k 10th edition.
// Implements the core resolution chain plus first-pass keyword effects:
// Lethal Hits, Sustained Hits N, Devastating Wounds, Twin-linked, Anti-X N+.
//
// Pure-functional: takes structured input, returns a distribution. No
// side effects, no DB access, no DOM.

import { parseDice } from './dice.js';

const D6 = (rng) => Math.floor(rng() * 6) + 1;

function parseSkill(s) {
  // "3+" → 3. "N/A" or null → null (auto-hit).
  if (!s || s === 'N/A' || s === 'n/a') return null;
  const m = /(\d+)/.exec(String(s));
  return m ? parseInt(m[1], 10) : null;
}

function passesRoll(roll, threshold) {
  // Standard 10th-edition: nat 1 always fails, nat 6 always succeeds.
  if (roll === 1) return false;
  if (roll === 6) return true;
  return roll >= threshold;
}

function woundThresholdFromTable(strength, toughness) {
  if (strength >= 2 * toughness) return 2;
  if (strength > toughness) return 3;
  if (strength === toughness) return 4;
  if (strength * 2 <= toughness) return 6;
  return 5;
}

function effectiveSave(armorPlus, ap, invulnPlus) {
  // ap is a non-positive integer; AP -2 means modifiedArmor = armor + 2.
  const modifiedArmor = armorPlus - ap;
  const candidates = [modifiedArmor];
  if (invulnPlus !== null && invulnPlus !== undefined) candidates.push(invulnPlus);
  return Math.min(...candidates);
}

function chooseWoundThreshold(weapon, defender) {
  const tableThresh = woundThresholdFromTable(weapon.strength, defender.toughness);
  const anti = weapon.abilities?.anti;
  if (!Array.isArray(anti) || anti.length === 0) return tableThresh;
  const defKw = (defender.keywords ?? []).map(k => String(k).toUpperCase());
  const matchingAnti = anti.filter(a => defKw.includes(String(a.target_keyword).toUpperCase()));
  if (matchingAnti.length === 0) return tableThresh;
  // Take the best Anti-X threshold the defender qualifies for.
  const bestAnti = Math.min(...matchingAnti.map(a => a.threshold));
  // Anti-X is a replacement threshold — only use it when it is better (lower number).
  return Math.min(tableThresh, bestAnti);
}

// Resolves a single attack that has already been determined to be a hit.
// Returns { damage: number, mortal: number }.
//
// autoWound: true when Lethal Hits triggered — skip the wound roll entirely.
// Devastating Wounds CANNOT trigger from auto-wounds (no wound roll → no nat-6
// wound roll to detect).
function resolvePostHit(weapon, defender, rng, autoWound) {
  const ab = weapon.abilities ?? {};

  if (!autoWound) {
    const tl = !!ab.twin_linked;
    const dev = !!ab.devastating_wounds;
    const woundT = chooseWoundThreshold(weapon, defender);

    let woundRoll = D6(rng);
    let succeeded = passesRoll(woundRoll, woundT);
    if (!succeeded && tl) {
      // Twin-linked: re-roll a failed wound once. Re-rolled die becomes the wound roll.
      woundRoll = D6(rng);
      succeeded = passesRoll(woundRoll, woundT);
    }
    if (!succeeded) return { damage: 0, mortal: 0 };

    // Devastating Wounds — only on UNMODIFIED nat-6 wound roll.
    if (dev && woundRoll === 6) {
      const dmg = parseDice(String(weapon.damage ?? '1'))(rng);
      return { damage: 0, mortal: dmg };
    }
  }

  // Save chain (applies to both normal wounds and auto-wounds from Lethal Hits).
  const armor = parseSkill(defender.save);
  const invuln = (defender.invulnerable !== undefined && defender.invulnerable !== null)
    ? parseSkill(defender.invulnerable)
    : null;
  const save = effectiveSave(armor ?? 7, weapon.ap ?? 0, invuln);
  const saveRoll = D6(rng);
  if (passesRoll(saveRoll, save)) return { damage: 0, mortal: 0 };

  const woundDamage = parseDice(String(weapon.damage ?? '1'))(rng);
  return { damage: woundDamage, mortal: 0 };
}

function rollAttacksCount(attacks, rng) {
  return parseDice(String(attacks ?? '1'))(rng);
}

// Resolve one attack roll. Returns an array of post-hit result objects
// (length ≥ 1 because Sustained Hits can generate extra hits from a single
// attack roll).
function resolveOneAttack(weapon, defender, rng) {
  const skill = parseSkill(weapon.skill);
  const ab = weapon.abilities ?? {};

  // Auto-hit case (Torrent / N/A skill): single hit, no nat-6 hit triggers.
  if (skill === null) {
    return [resolvePostHit(weapon, defender, rng, false)];
  }

  const hitRoll = D6(rng);
  if (!passesRoll(hitRoll, skill)) return [{ damage: 0, mortal: 0 }];

  const isCrit = (hitRoll === 6);
  const lethalAuto = isCrit && !!ab.lethal_hits;
  const sustainedExtras = (isCrit && ab.sustained_hits) ? ab.sustained_hits : 0;

  const out = [];
  // The primary hit (potentially auto-wounded by Lethal Hits).
  out.push(resolvePostHit(weapon, defender, rng, lethalAuto));
  // Sustained Hits extras — these are additional hits that proceed to the
  // wound roll normally. They do NOT carry nat-6 hit properties (to prevent
  // infinite recursion and per 10th ed rules).
  for (let i = 0; i < sustainedExtras; i++) {
    out.push(resolvePostHit(weapon, defender, rng, false));
  }
  return out;
}

function applyDamageToDefender(state, entry, defender) {
  if (state.modelsRemaining <= 0) return;
  const totalDamage = (entry.damage || 0) + (entry.mortal || 0);
  if (totalDamage <= 0) return;
  // Damage caps at current model's remaining wounds — no spillover for this pass.
  const applied = Math.min(totalDamage, state.currentModelWounds);
  state.currentModelWounds -= applied;
  state.totalWoundsDealt += applied;
  if (state.currentModelWounds <= 0) {
    state.modelsRemaining -= 1;
    state.currentModelWounds = defender.wounds_per_model;
  }
}

function runOneTrial(attacker, defender, rng) {
  const state = {
    modelsRemaining: defender.model_count,
    currentModelWounds: defender.wounds_per_model,
    totalWoundsDealt: 0,
  };
  for (const weapon of attacker.weapons) {
    const attackCount = rollAttacksCount(weapon.attacks, rng);
    for (let i = 0; i < attackCount; i++) {
      if (state.modelsRemaining <= 0) break;
      const results = resolveOneAttack(weapon, defender, rng);
      for (const r of results) {
        applyDamageToDefender(state, r, defender);
        if (state.modelsRemaining <= 0) break;
      }
    }
    if (state.modelsRemaining <= 0) break;
  }
  const modelsLost = defender.model_count - state.modelsRemaining;
  return {
    wounds: state.totalWoundsDealt,
    models_lost: modelsLost,
    destroyed: state.modelsRemaining <= 0,
  };
}

function collectUnmodelled(attacker) {
  const set = new Set();
  for (const w of attacker.weapons) {
    for (const u of w.abilities?.unmodelled ?? []) set.add(u);
  }
  return [...set];
}

export function simulate({ attacker, defender, trials = 5000, rng = Math.random } = {}) {
  if (!attacker || !defender) throw new Error('simulate: attacker and defender are required');
  let totalWounds = 0;
  let totalModelsLost = 0;
  let destroyedCount = 0;
  const histogram_models_lost = new Array(defender.model_count + 1).fill(0);
  const histogram_wounds_dealt = new Array(defender.model_count * defender.wounds_per_model + 1).fill(0);

  for (let t = 0; t < trials; t++) {
    const r = runOneTrial(attacker, defender, rng);
    totalWounds += r.wounds;
    totalModelsLost += r.models_lost;
    if (r.destroyed) destroyedCount += 1;
    if (r.models_lost < histogram_models_lost.length) histogram_models_lost[r.models_lost] += 1;
    if (r.wounds < histogram_wounds_dealt.length) histogram_wounds_dealt[r.wounds] += 1;
  }
  return {
    trials,
    expected_wounds_dealt: totalWounds / trials,
    expected_models_lost: totalModelsLost / trials,
    p_target_destroyed: destroyedCount / trials,
    histogram_models_lost,
    histogram_wounds_dealt,
    unmodelled_abilities: collectUnmodelled(attacker),
  };
}
