// app/lib/leader-grants.js
//
// Merge attached-leader `grants_to_attached_unit` blocks into a built
// attacker shape. Per the 10th-ed "this unit" rule, a leader's grants
// reach every model in the Attached Unit — so e.g. Titus's Press the
// Attack [SUSTAINED HITS 1] + re-roll-hits-of-1 applies to every
// weapon in the merged pool, not just the leader's own.
//
// Stacking policy: union, first-wins per key. If a weapon already
// carries a stronger value (e.g. [SUSTAINED HITS 2] from its own
// profile), a leader granting [SUSTAINED HITS 1] will not overwrite.
// If two leaders grant the same modifier, the first one wins
// (insertion order = leader order in the attachedLeaders list).
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

  const weapons = (attacker.weapons ?? []).map(w => {
    const merged = { ...(w.abilities ?? {}) };
    for (const leader of list) {
      const g = leader.grants;
      if (g.weapon_abilities) {
        for (const [k, v] of Object.entries(g.weapon_abilities)) {
          if (merged[k] == null) merged[k] = v;
        }
      }
    }
    return { ...w, abilities: merged };
  });

  return { ...attacker, weapons, modifiers: mods };
}
