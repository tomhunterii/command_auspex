// app/lib/melee-selection.js
//
// 10th-edition core rule: each time a model fights, it makes attacks with
// ONE of its melee weapons, OR with each of its melee weapons that have
// the [EXTRA ATTACKS] ability. So when a model carries multiple melee
// weapons (e.g. Hive Tyrant: bonesword-and-lash-whip + scything talons),
// the player must pick one each turn; weapons tagged [EXTRA ATTACKS]
// (e.g. Carnifex extra scything talons, Norn Emissary rending claws)
// always stack on top of the picked weapon.
//
// This module lets the simulator UI surface a melee-pick selector and
// strip the unselected non-extra-attacks melee weapons before damage
// math runs.

// Returns Map<lowercased-trimmed-name, weapon> of melee weapons that
// REQUIRE selection — i.e. melee weapons WITHOUT the [EXTRA ATTACKS]
// keyword. If this map has 0 or 1 entries, no selection is needed.
export function findMeleeChoices(weapons) {
  const choices = new Map();
  for (const w of weapons ?? []) {
    if (w.kind !== 'melee') continue;
    if (w.abilities?.extra_attacks) continue;
    choices.set(String(w.name).toLowerCase().trim(), w);
  }
  return choices;
}

// Filter the weapon pool to keep:
//   • all ranged weapons,
//   • all [EXTRA ATTACKS] melee weapons,
//   • the single melee weapon whose name (lowercased, trimmed) matches
//     `selectedNameLower`.
//
// Pass-through cases:
//   • If there are 0 or 1 selectable melee weapons, no filter applied.
//   • If `selectedNameLower` is null/empty, no filter applied (caller has
//     not yet picked one — preserve the full pool so the UI can prompt).
export function applyMeleeSelection(weapons, selectedNameLower) {
  const choices = findMeleeChoices(weapons);
  if (choices.size <= 1) return weapons;
  if (!selectedNameLower) return weapons;
  const target = String(selectedNameLower).toLowerCase().trim();
  return weapons.filter(w => {
    if (w.kind !== 'melee') return true;
    if (w.abilities?.extra_attacks) return true;
    return String(w.name).toLowerCase().trim() === target;
  });
}
