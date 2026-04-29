// app/lib/leader-grants.js
//
// Merge attached-leader `grants_to_attached_unit` blocks into a built
// attacker shape. Per the 10th-ed "this unit" rule, a leader's grants
// reach every model in the Attached Unit — so e.g. Titus's Press the
// Attack [SUSTAINED HITS 1] applies to every ranged weapon in the
// merged pool, not just the leader's own.
//
// Schema (per leader's `grants_to_attached_unit` frontmatter block):
//   modifiers              — attacker-level mods (re-rolls, +1 to wound, ...)
//   weapon_abilities       — per-weapon ability grants for ALL kinds
//   weapon_abilities_ranged — per-weapon ability grants, RANGED only
//   weapon_abilities_melee  — per-weapon ability grants, MELEE only
//
// All three weapon-ability sources stack; per-kind blocks are gated by
// `weapon.kind`. The all-kinds `weapon_abilities` block stays as
// shorthand for "applies regardless of kind" — useful for grants that
// genuinely buff both phases (which the 10th-ed catalogue currently has
// none of, but the schema permits).
//
// Stacking policy: union, first-wins per key. If a weapon already carries
// a stronger value (e.g. [SUSTAINED HITS 2] from its own profile), a
// leader granting [SUSTAINED HITS 1] will not overwrite. If two leaders
// grant the same modifier, the first one wins (insertion order = leader
// order in the attachedLeaders list).
//
// Leaders may arrive as bare getUnit() results OR wrapped
// { unit, equippedCounts } pairs (see buildSimInputs); we unwrap.

export function mergeLeaderGrants(attacker, leaders) {
  const list = (Array.isArray(leaders) ? leaders : [leaders])
    .map(l => (l && typeof l === 'object' && 'unit' in l) ? l.unit : l)
    .filter(l => l && l.grants);
  if (list.length === 0) return attacker;

  const mods = { ...(attacker.modifiers ?? {}) };
  for (const leader of list) {
    const g = leader.grants;
    if (g.modifiers) {
      for (const [k, v] of Object.entries(g.modifiers)) {
        if (mods[k] == null) mods[k] = v;
      }
    }
  }

  // For each weapon in the pool, walk every leader's grants in order.
  // The kind-specific block fires only when the weapon's kind matches;
  // the all-kinds block fires regardless. First-wins per key.
  function applicableAbilityBlocks(grants, kind) {
    const blocks = [];
    if (grants.weapon_abilities) blocks.push(grants.weapon_abilities);
    if (kind === 'ranged' && grants.weapon_abilities_ranged) blocks.push(grants.weapon_abilities_ranged);
    if (kind === 'melee'  && grants.weapon_abilities_melee)  blocks.push(grants.weapon_abilities_melee);
    return blocks;
  }

  const weapons = (attacker.weapons ?? []).map(w => {
    const merged = { ...(w.abilities ?? {}) };
    for (const leader of list) {
      for (const block of applicableAbilityBlocks(leader.grants, w.kind)) {
        for (const [k, v] of Object.entries(block)) {
          if (merged[k] == null) merged[k] = v;
        }
      }
    }
    return { ...w, abilities: merged };
  });

  return { ...attacker, weapons, modifiers: mods };
}
