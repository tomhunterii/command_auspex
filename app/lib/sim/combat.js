// app/lib/sim/combat.js
//
// Monte Carlo combat simulator for Warhammer 40k 10th edition.
// Implements the core resolution chain plus first-pass keyword effects:
// Lethal Hits, Sustained Hits N, Devastating Wounds, Twin-linked, Anti-X N+.
//
// Pass C-1: unit-level modifier surface via attacker.modifiers / defender.modifiers.
// When absent, behaviour is unchanged (full backwards compatibility).
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

// Roll once; re-roll if policy demands it. Returns { roll, passed }.
// Used for both hit and wound re-rolls.
function rollAndMaybeReroll(threshold, rng, rerollPolicy) {
  let roll = D6(rng);
  if (passesRoll(roll, threshold)) return { roll, passed: true };
  if (rerollPolicy === 'all' || (rerollPolicy === 'ones' && roll === 1)) {
    roll = D6(rng);
  }
  return { roll, passed: passesRoll(roll, threshold) };
}

function effectiveSave(armorPlus, ap, invulnPlus, defenderMods, ignoresCover = false) {
  let modifiedArmor = armorPlus - ap;
  // Benefit of Cover applies only when the defender is physically in
  // cover (positional — set by the caller). [IGNORES COVER] trumps it.
  // INDIRECT FIRE does NOT grant automatic cover; cover is purely
  // positional per 10th-ed core.
  if (defenderMods?.cover && !ignoresCover) {
    modifiedArmor -= 1;
    // Cover cap: cannot improve armor beyond 3+.
    if (modifiedArmor < 3) modifiedArmor = 3;
  }
  const candidates = [modifiedArmor];
  if (invulnPlus !== null && invulnPlus !== undefined) candidates.push(invulnPlus);
  return Math.min(...candidates);
}

// Best matching Anti-X threshold for this weapon vs this defender, or null
// if either the weapon has no Anti-X or none of its entries match a
// keyword on the defender. Used both to compute the effective wound
// threshold AND to flag Critical Wounds (an unmodified roll meeting an
// Anti-X threshold is a Critical Wound, which triggers Devastating
// Wounds — see resolvePostHit).
function bestMatchingAntiThreshold(weapon, defender) {
  const anti = weapon.abilities?.anti;
  if (!Array.isArray(anti) || anti.length === 0) return null;
  const defKw = (defender.keywords ?? []).map(k => String(k).toUpperCase());
  const matching = anti.filter(a =>
    defKw.includes(String(a.target_keyword).toUpperCase())
  );
  if (matching.length === 0) return null;
  return Math.min(...matching.map(a => a.threshold));
}

function chooseWoundThreshold(weapon, defender, attackerMods) {
  const tableThresh = woundThresholdFromTable(weapon.strength, defender.toughness);
  const antiThresh = bestMatchingAntiThreshold(weapon, defender);
  let baseThresh = antiThresh !== null
    ? Math.min(tableThresh, antiThresh)
    : tableThresh;

  if (attackerMods?.plus_one_to_wound) baseThresh -= 1;
  if (attackerMods?.plus_one_to_wound_melee && weapon.kind === 'melee') baseThresh -= 1;
  if (baseThresh < 2) baseThresh = 2;
  if (baseThresh > 6) baseThresh = 6;
  return baseThresh;
}

// Apply Feel No Pain per damage point. Returns surviving damage count.
function applyFnp(damage, fnpThreshold, rng) {
  if (!fnpThreshold || damage <= 0) return damage;
  let surviving = 0;
  for (let i = 0; i < damage; i++) {
    const r = D6(rng);
    if (!passesRoll(r, fnpThreshold)) surviving += 1;
  }
  return surviving;
}

// Roll one weapon's damage characteristic. Applies the [MELTA N] bonus
// when the attack is at half range — N flat is added to the rolled
// damage characteristic (10th-ed core: "Each time an attack made with
// this weapon targets a unit within Half range, improve the Damage
// characteristic of that attack by N").
function rollDamage(weapon, context, rng) {
  let dmg = parseDice(String(weapon.damage ?? '1'))(rng);
  if (context?.at_half_range && weapon.abilities?.melta) {
    dmg += weapon.abilities.melta;
  }
  return dmg;
}

// Resolves a single attack that has already been determined to be a hit.
// Returns { damage: number, mortal: number }.
//
// autoWound: true when Lethal Hits triggered — skip the wound roll entirely.
// Devastating Wounds CANNOT trigger from auto-wounds (no wound roll → no nat-6
// wound roll to detect).
function resolvePostHit(weapon, defender, rng, context, autoWound, attackerMods, defenderMods) {
  const ab = weapon.abilities ?? {};

  if (!autoWound) {
    const tl = !!ab.twin_linked;
    const dev = !!ab.devastating_wounds;
    const woundT = chooseWoundThreshold(weapon, defender, attackerMods);
    // Anti-X criticals: an unmodified wound roll that meets a matching
    // Anti-X threshold is a Critical Wound (10th-ed core), which triggers
    // Devastating Wounds the same as a nat-6 does. Null when either the
    // weapon has no Anti-X or no entry matches the defender's keywords.
    const antiCritThresh = bestMatchingAntiThreshold(weapon, defender);

    let woundRoll;
    let succeeded;

    if (tl) {
      // Twin-linked: re-roll a failed wound once. TL takes precedence — skip
      // the modifier re-roll so we don't double-dip.
      woundRoll = D6(rng);
      succeeded = passesRoll(woundRoll, woundT);
      if (!succeeded) {
        woundRoll = D6(rng);
        succeeded = passesRoll(woundRoll, woundT);
      }
    } else {
      // Standard wound roll, with optional modifier re-roll.
      const result = rollAndMaybeReroll(woundT, rng, attackerMods?.reroll_wounds ?? null);
      woundRoll = result.roll;
      succeeded = result.passed;
    }

    if (!succeeded) return { damage: 0, mortal: 0 };

    // Critical Wound = unmodified nat-6 OR (Anti-X applies AND
    // unmodified roll ≥ matching Anti-X threshold). Devastating Wounds
    // converts every Critical Wound into mortal wounds that bypass armour
    // and invuln. Without this branch, a Sternguard combi-weapon
    // ([ANTI-INFANTRY 4+] + [DEVASTATING WOUNDS]) only triggered DW on a
    // nat-6 wound roll, when the printed rule says every 4+ wound vs
    // INFANTRY targets is a Critical and should mortal-wound.
    const isCritical =
      woundRoll === 6 ||
      (antiCritThresh !== null && woundRoll >= antiCritThresh);
    if (dev && isCritical) {
      const rawDmg = rollDamage(weapon, context, rng);
      const mortal = applyFnp(rawDmg, defenderMods?.fnp ?? null, rng);
      return { damage: 0, mortal };
    }
  }

  // Save chain (applies to both normal wounds and auto-wounds from Lethal Hits).
  const armor = parseSkill(defender.save);
  const invuln = (defender.invulnerable !== undefined && defender.invulnerable !== null)
    ? parseSkill(defender.invulnerable)
    : null;
  const ignoresCover = !!ab.ignores_cover;
  const save = effectiveSave(armor ?? 7, weapon.ap ?? 0, invuln, defenderMods, ignoresCover);
  const saveRoll = D6(rng);
  if (passesRoll(saveRoll, save)) return { damage: 0, mortal: 0 };

  const rawDmg = rollDamage(weapon, context, rng);
  const woundDamage = applyFnp(rawDmg, defenderMods?.fnp ?? null, rng);
  return { damage: woundDamage, mortal: 0 };
}

function rollAttacksCount(weapon, defender, context, rng) {
  let count = parseDice(String(weapon.attacks ?? '1'))(rng);
  if (weapon.abilities?.blast) {
    count += Math.floor((defender.model_count ?? 0) / 5);
  }
  if (weapon.abilities?.rapid_fire && context?.at_half_range) {
    count += weapon.abilities.rapid_fire;
  }
  return count;
}

function effectiveHitThreshold(weapon, context, attackerMods) {
  const base = parseSkill(weapon.skill);
  if (base === null) return null;
  let t = base;
  if (weapon.abilities?.heavy && context?.attacker_stationary) t -= 1;
  if (attackerMods?.plus_one_to_hit) t -= 1;
  // INDIRECT FIRE without line-of-sight: -1 to hit (raises threshold).
  if (weapon.abilities?.indirect_fire && context?.firing_indirectly) t += 1;
  // 10th-edition modifier cap: cannot improve to better than 2+.
  if (t < 2) t = 2;
  if (t > 6) t = 6;
  return t;
}

// Resolve one attack roll. Returns an array of post-hit result objects
// (length ≥ 1 because Sustained Hits can generate extra hits from a single
// attack roll).
function resolveOneAttack(weapon, defender, rng, context, attackerMods, defenderMods) {
  const skill = effectiveHitThreshold(weapon, context, attackerMods);
  const ab = weapon.abilities ?? {};

  // Auto-hit case (Torrent / N/A skill): single hit, no nat-6 hit triggers.
  if (skill === null) {
    return [resolvePostHit(weapon, defender, rng, context, false, attackerMods, defenderMods)];
  }

  const { roll: hitRoll, passed: hit } = rollAndMaybeReroll(skill, rng, attackerMods?.reroll_hits ?? null);
  if (!hit) return [{ damage: 0, mortal: 0 }];

  const isCrit = (hitRoll === 6);
  const lethalAuto = isCrit && !!ab.lethal_hits;
  const sustainedExtras = (isCrit && ab.sustained_hits) ? ab.sustained_hits : 0;

  const out = [];
  // The primary hit (potentially auto-wounded by Lethal Hits).
  out.push(resolvePostHit(weapon, defender, rng, context, lethalAuto, attackerMods, defenderMods));
  // Sustained Hits extras — these are additional hits that proceed to the
  // wound roll normally. They do NOT carry nat-6 hit properties (to prevent
  // infinite recursion and per 10th ed rules).
  for (let i = 0; i < sustainedExtras; i++) {
    out.push(resolvePostHit(weapon, defender, rng, context, false, attackerMods, defenderMods));
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

function rollHazardousSelfDamage(attacker, context, rng) {
  let mw = 0;
  for (const w of attacker.weapons) {
    if (!w.abilities?.hazardous) continue;
    // A weapon that was gated out (Advance / Engagement Range) did not fire,
    // so it cannot trigger its Hazardous self-damage roll.
    if (!canFireWeapon(w, context)) continue;
    if (D6(rng) === 1) mw += 1;
  }
  return mw;
}

// 10th-ed firing gates that depend on what the unit did this turn:
//   - A unit that Advanced may shoot only ASSAULT weapons.
//   - A unit in Engagement Range may shoot only PISTOL weapons.
// Both gates are ranged-only (melee weapons fire regardless). Unset context
// flags leave behaviour unchanged so existing call sites are unaffected.
function canFireWeapon(weapon, context) {
  if (weapon.kind !== 'ranged') return true;
  const ab = weapon.abilities ?? {};
  if (context?.attacker_advanced && !ab.assault) return false;
  if (context?.attacker_in_engagement_range && !ab.pistol) return false;
  return true;
}

function runOneTrial(attacker, defender, context, rng) {
  const attackerMods = attacker.modifiers ?? null;
  const defenderMods = defender.modifiers ?? null;
  const state = {
    modelsRemaining: defender.model_count,
    currentModelWounds: defender.wounds_per_model,
    totalWoundsDealt: 0,
  };
  for (const weapon of attacker.weapons) {
    if (!canFireWeapon(weapon, context)) continue;
    const attackCount = rollAttacksCount(weapon, defender, context, rng);
    for (let i = 0; i < attackCount; i++) {
      if (state.modelsRemaining <= 0) break;
      const results = resolveOneAttack(weapon, defender, rng, context, attackerMods, defenderMods);
      for (const r of results) {
        applyDamageToDefender(state, r, defender);
        if (state.modelsRemaining <= 0) break;
      }
    }
    if (state.modelsRemaining <= 0) break;
  }
  const modelsLost = defender.model_count - state.modelsRemaining;
  const attackerSelfDamage = rollHazardousSelfDamage(attacker, context, rng);
  return {
    wounds: state.totalWoundsDealt,
    models_lost: modelsLost,
    destroyed: state.modelsRemaining <= 0,
    attacker_self_damage: attackerSelfDamage,
  };
}

function collectUnmodelled(attacker) {
  const set = new Set();
  for (const w of attacker.weapons) {
    for (const u of w.abilities?.unmodelled ?? []) set.add(u);
  }
  return [...set];
}

export function simulate({ attacker, defender, context = {}, trials = 5000, rng = Math.random } = {}) {
  if (!attacker || !defender) throw new Error('simulate: attacker and defender are required');
  let totalWounds = 0;
  let totalModelsLost = 0;
  let destroyedCount = 0;
  let totalAttackerSelfDamage = 0;
  const histogram_models_lost = new Array(defender.model_count + 1).fill(0);
  const histogram_wounds_dealt = new Array(defender.model_count * defender.wounds_per_model + 1).fill(0);

  for (let t = 0; t < trials; t++) {
    const r = runOneTrial(attacker, defender, context, rng);
    totalWounds += r.wounds;
    totalModelsLost += r.models_lost;
    if (r.destroyed) destroyedCount += 1;
    totalAttackerSelfDamage += r.attacker_self_damage;
    if (r.models_lost < histogram_models_lost.length) histogram_models_lost[r.models_lost] += 1;
    if (r.wounds < histogram_wounds_dealt.length) histogram_wounds_dealt[r.wounds] += 1;
  }
  return {
    trials,
    expected_wounds_dealt: totalWounds / trials,
    expected_models_lost: totalModelsLost / trials,
    p_target_destroyed: destroyedCount / trials,
    expected_attacker_self_damage: totalAttackerSelfDamage / trials,
    histogram_models_lost,
    histogram_wounds_dealt,
    unmodelled_abilities: collectUnmodelled(attacker),
  };
}
