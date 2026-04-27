// app/lib/sim/combat.js
//
// Monte Carlo combat simulator for Warhammer 40k 10th edition.
// Implements the core resolution chain only — no keyword effects in this
// pass (Lethal Hits, Sustained, Devastating Wounds, Anti-X, etc. layer on
// top later via the same per-attack hook points).
//
// Pure-functional: takes structured input, returns a distribution. No
// side effects, no DB access, no DOM. Trivially testable via Node's
// built-in test runner.

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

function woundThreshold(strength, toughness) {
  if (strength >= 2 * toughness) return 2;
  if (strength > toughness) return 3;
  if (strength === toughness) return 4;
  if (strength * 2 <= toughness) return 6;
  return 5;
}

function effectiveSave(armorPlus, ap, invulnPlus) {
  // ap is a non-positive integer; AP -2 means modifiedArmor = armor + 2.
  const modifiedArmor = armorPlus - ap; // -ap because ap is non-positive
  const candidates = [modifiedArmor];
  if (invulnPlus !== null && invulnPlus !== undefined) candidates.push(invulnPlus);
  return Math.min(...candidates);
}

function resolveOneAttack(weapon, defender, rng) {
  // Returns damage dealt (0 if missed/saved) on a single attack.
  const skill = parseSkill(weapon.skill);
  if (skill !== null) {
    const hitRoll = D6(rng);
    if (!passesRoll(hitRoll, skill)) return 0;
  }
  const woundT = woundThreshold(weapon.strength, defender.toughness);
  const woundRoll = D6(rng);
  if (!passesRoll(woundRoll, woundT)) return 0;
  const armor = parseSkill(defender.save);
  const invuln = defender.invulnerable !== undefined && defender.invulnerable !== null
    ? parseSkill(defender.invulnerable)
    : null;
  const save = effectiveSave(armor ?? 7, weapon.ap ?? 0, invuln);
  const saveRoll = D6(rng);
  if (passesRoll(saveRoll, save)) return 0;
  return parseDice(String(weapon.damage ?? '1'))(rng);
}

function rollAttacksCount(attacks, rng) {
  return parseDice(String(attacks ?? '1'))(rng);
}

function runOneTrial(attacker, defender, rng) {
  // Track defender state through the trial.
  const wpm = defender.wounds_per_model;
  let modelsRemaining = defender.model_count;
  let currentModelWounds = wpm;
  let totalWoundsDealt = 0;

  for (const weapon of attacker.weapons) {
    const attackCount = rollAttacksCount(weapon.attacks, rng);
    for (let i = 0; i < attackCount; i++) {
      if (modelsRemaining <= 0) break;
      const dmg = resolveOneAttack(weapon, defender, rng);
      if (dmg <= 0) continue;
      // Damage caps at the current model's remaining wounds — no spillover
      // for non-Devastating-Wounds attacks (10th-edition core rule).
      const applied = Math.min(dmg, currentModelWounds);
      currentModelWounds -= applied;
      totalWoundsDealt += applied;
      if (currentModelWounds <= 0) {
        modelsRemaining -= 1;
        currentModelWounds = wpm;
      }
    }
    if (modelsRemaining <= 0) break;
  }
  const modelsLost = defender.model_count - modelsRemaining;
  return { wounds: totalWoundsDealt, models_lost: modelsLost, destroyed: modelsRemaining <= 0 };
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
  };
}
