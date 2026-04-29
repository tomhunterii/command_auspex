// app/lib/overcharge.js
// Plasma overcharge / supercharge profile detection and filtering.
// A weapon list often contains both the safe ("standard") and dangerous
// ("supercharge") profile of the same gun as separate entries — the player
// must choose ONE per fight, not roll both.

export const OVERCHARGE_RE = /\s*[–—-]\s*(supercharge|overcharge)\s*$/i;

export function isOverchargeProfile(name) {
  return OVERCHARGE_RE.test(String(name ?? ''));
}

export function baseWeaponName(name) {
  return String(name ?? '').replace(OVERCHARGE_RE, '').trim();
}

// Map<lowercased-base-name, {standard, overcharge}>. Only base names with BOTH
// profiles present are returned — solo profiles pass through filtering.
export function findOverchargePairs(weapons) {
  const byBase = new Map();
  for (const w of weapons ?? []) {
    const base = baseWeaponName(w.name).toLowerCase();
    if (!base) continue;
    const slot = byBase.get(base) ?? {};
    if (isOverchargeProfile(w.name)) slot.overcharge = w;
    else slot.standard = w;
    byBase.set(base, slot);
  }
  const pairs = new Map();
  for (const [base, pair] of byBase.entries()) {
    if (pair.standard && pair.overcharge) pairs.set(base, pair);
  }
  return pairs;
}

// Strip the unselected profile of every overcharge pair from the list.
// `choiceFor(baseLower)` returns 'standard' (default) or 'overcharge'.
export function applyOverchargeFilter(weapons, choiceFor) {
  const pairs = findOverchargePairs(weapons);
  if (pairs.size === 0) return weapons;
  return weapons.filter(w => {
    const base = baseWeaponName(w.name).toLowerCase();
    const pair = pairs.get(base);
    if (!pair) return true;
    const choice = choiceFor(base) === 'overcharge' ? 'overcharge' : 'standard';
    return choice === 'overcharge' ? isOverchargeProfile(w.name) : !isOverchargeProfile(w.name);
  });
}
