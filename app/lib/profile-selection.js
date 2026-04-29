// app/lib/profile-selection.js
//
// UNIFIED weapon profile picker — one module, one rule:
// when a single weapon prints multiple firing profiles in the catalogue
// (stored as separate weapon rows like "Foo – strike" / "Foo – sweep",
// or plasma's "Foo" / "Foo – supercharge"), the player picks ONE per
// turn. This subsumes the previous overcharge module and covers every
// other multi-profile weapon in the catalogue:
//
//   • Plasma incinerator        : standard | supercharge
//   • Old One Eye's claws        : – strike | – sweep
//   • Massive scything talons    : – strike | – sweep
//   • Warp Blast                 : – witchfire | – focused
//   • Psychic Tendril            : – neuroparasite | – neuroblast | – neurolance
//
// Per the Captain's directive ("picking focused for witchfire is the same
// as choosing hazardous"), all of these are mechanically the same kind of
// decision and live behind one picker.
//
// Profile picks are DISTINCT from per-model "fight with one melee" picks
// (which weapon a multi-armed model swings) — that rule is handled by
// `app/lib/melee-selection.js` and is intentionally kept separate.
//
// EXTRA ATTACKS exemption: weapons tagged [EXTRA ATTACKS] are NEVER pick
// candidates — they always stack on top of whichever primary fires.

const PAREN_SUFFIX_RE   = /\s*\([^)]*\)\s*$/;
const PROFILE_SUFFIX_RE = /\s+[–—-]\s+([^\s].*?)\s*$/;
// Plasma's "supercharge" / "overcharge" lives under the same regex, but we
// expose the older predicates so callers that want a quick "is this the
// dangerous profile?" check still work.
const OVERCHARGE_RE = /\s+[–—-]\s+(supercharge|overcharge)\s*$/i;

// Canonical base name: strip profile suffix first ("– strike",
// "– supercharge", "– witchfire"), then any remaining parenthetical
// annotation ("(twin-linked)"). Order matters when both are present
// ("Foo (twin-linked) – strike"): the profile suffix sits at the end,
// the parens are mid-string after stripping it. Lowercased + trimmed
// for stable Map keys.
export function canonicalBase(name) {
  return String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(PROFILE_SUFFIX_RE, '')
    .trim()
    .replace(PAREN_SUFFIX_RE, '')
    .trim();
}

// Returns the suffix word(s) after " – " (e.g. "supercharge", "strike",
// "witchfire", "neuroparasite (precision)") lowercased, or null if the
// weapon name has no profile suffix (i.e. it is the unsuffixed default).
export function profileSuffix(name) {
  const m = PROFILE_SUFFIX_RE.exec(String(name ?? '').toLowerCase().trim());
  return m ? m[1].trim() : null;
}

export function isOverchargeProfile(name) {
  return OVERCHARGE_RE.test(String(name ?? ''));
}

// Group weapons by canonical base. Returns Map<base, profiles[]> where
// profiles is [{ weapon, name, suffix }, ...] in insertion order.
// EXTRA ATTACKS weapons are NOT included (they always stack regardless
// of which primary profile is picked). Only groups with >1 entry are
// returned — single-profile weapons need no pick.
export function findWeaponProfiles(weapons) {
  const groups = new Map();
  for (const w of weapons ?? []) {
    if (w.abilities?.extra_attacks) continue;
    const base = canonicalBase(w.name);
    if (!base) continue;
    const arr = groups.get(base) ?? [];
    arr.push({ weapon: w, name: w.name, suffix: profileSuffix(w.name) });
    groups.set(base, arr);
  }
  const out = new Map();
  for (const [base, profiles] of groups.entries()) {
    if (profiles.length > 1) out.set(base, profiles);
  }
  return out;
}

// Default profile rule: an unsuffixed row (no profile suffix at all)
// wins — that is the "safe" or "primary" profile (plasma standard,
// regular bolt rifle when the catalogue separately stores a special
// variant, etc.). If every row is suffixed, fall back to insertion
// order (first wins). Both arms produce a stable, predictable default.
export function defaultProfile(profiles) {
  return profiles.find(p => !p.suffix) ?? profiles[0];
}

// Filter the weapon pool to keep:
//   • single-profile weapons (groups with 1 entry — never picks)
//   • [EXTRA ATTACKS] weapons (always stack)
//   • the chosen profile from each multi-profile group
//
// `chooseFor(canonicalBase)` returns a weapon name (any case / spacing —
// we lowercase + trim for comparison) from the group, or null/undefined
// to fall back to the default profile.
export function applyProfileSelection(weapons, chooseFor) {
  const groups = findWeaponProfiles(weapons);
  if (groups.size === 0) return weapons;

  const drop = new Set(); // weapon names to drop (lowercased + trimmed)
  for (const [base, profiles] of groups.entries()) {
    const requested = String(chooseFor?.(base) ?? '').toLowerCase().trim();
    const chosen = profiles.find(p => p.name.toLowerCase().trim() === requested)
                ?? defaultProfile(profiles);
    for (const p of profiles) {
      if (p.weapon !== chosen.weapon) drop.add(p.name.toLowerCase().trim());
    }
  }
  return weapons.filter(w => !drop.has(String(w.name).toLowerCase().trim()));
}
