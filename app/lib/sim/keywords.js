// app/lib/sim/keywords.js
//
// Parses the catalogue weapons table's `keywords` column into structured
// ability flags the simulator consumes. Format from the markdown:
//   "[LETHAL HITS], [SUSTAINED HITS 1], [ANTI-INFANTRY 4+]"
// Always uppercase, always bracketed, sometimes with a numeric parameter.
// Unrecognized keywords land in `unmodelled` so the simulator can surface
// them in the result and the UI can warn the math is approximate.

const FLAG_KEYWORDS = new Map([
  ['LETHAL HITS',         'lethal_hits'],
  ['DEVASTATING WOUNDS',  'devastating_wounds'],
  ['TWIN-LINKED',         'twin_linked'],
  ['TORRENT',             'torrent'],
  ['HEAVY',               'heavy'],
  ['BLAST',               'blast'],
  ['HAZARDOUS',           'hazardous'],
  // ASSAULT: this weapon can shoot after the bearer's unit Advanced.
  // PISTOL: this weapon can shoot while the bearer's unit is in Engagement
  //   Range (and a unit that is in Engagement Range can only shoot Pistols).
  // PSYCHIC: pure label — flagged so it does not pollute `unmodelled`.
  //   Has no effect on the damage chain by itself; future Anti-Psyker rules
  //   can read this flag.
  ['ASSAULT',             'assault'],
  ['PISTOL',              'pistol'],
  ['PSYCHIC',             'psychic'],
  // EXTRA ATTACKS: the weapon's attacks happen IN ADDITION to whichever
  // primary melee weapon a model fights with. Models with multiple non-
  // EXTRA-ATTACKS melee weapons must pick ONE per turn; an [EXTRA ATTACKS]
  // weapon stacks on top regardless of selection. Combat engine treats
  // these weapons identically — the keyword only matters to the upstream
  // melee-selection filter (app/lib/melee-selection.js).
  ['EXTRA ATTACKS',       'extra_attacks'],
  // IGNORES COVER: defender's Benefit-of-Cover armor bonus does not
  // apply against this weapon. Combat engine gates the +1 armor branch
  // in effectiveSave on this flag.
  ['IGNORES COVER',       'ignores_cover'],
  // INDIRECT FIRE: weapon can target enemy units the firing unit cannot
  // see. When firing without line-of-sight (`context.firing_indirectly`),
  // attacks suffer -1 to hit. Cover is NOT automatic — it remains
  // positional, granted by `defenderMods.cover` only when the target is
  // physically in cover. Targeting permission (whether the firer needs
  // LoS at all) is a board-state concern outside the sim engine.
  ['INDIRECT FIRE',       'indirect_fire'],
]);

const SUSTAINED_HITS_RE = /^SUSTAINED HITS\s*(\d*)$/;
const RAPID_FIRE_RE = /^RAPID FIRE\s*(\d*)$/;
const ANTI_RE = /^ANTI-([A-Z][A-Z\s\-]*?)\s+(\d+)\+$/;
// MELTA N — at half range, add N to the damage roll. Multi-melta has
// MELTA 2 most often; single-target meltas are MELTA 2 in 10th ed.
const MELTA_RE = /^MELTA\s*(\d+)$/;

export function parseKeywords(input) {
  if (!input || typeof input !== 'string') return {};
  const cleaned = input.trim();
  if (!cleaned || cleaned === '—' || cleaned === '-') return {};
  const tokens = cleaned
    .split(',')
    .map(t => t.trim().toUpperCase())
    .map(t => t.replace(/^\[/, '').replace(/\]$/, '').trim())
    .filter(Boolean);

  const out = {};
  const unmodelled = [];
  const anti = [];

  for (const tok of tokens) {
    if (FLAG_KEYWORDS.has(tok)) {
      out[FLAG_KEYWORDS.get(tok)] = true;
      continue;
    }
    const sh = SUSTAINED_HITS_RE.exec(tok);
    if (sh) {
      const n = sh[1] ? parseInt(sh[1], 10) : 1;
      out.sustained_hits = n;
      continue;
    }
    const rf = RAPID_FIRE_RE.exec(tok);
    if (rf) {
      const n = rf[1] ? parseInt(rf[1], 10) : 1;
      out.rapid_fire = n;
      continue;
    }
    const a = ANTI_RE.exec(tok);
    if (a) {
      anti.push({ target_keyword: a[1].trim(), threshold: parseInt(a[2], 10) });
      continue;
    }
    const mel = MELTA_RE.exec(tok);
    if (mel) {
      out.melta = parseInt(mel[1], 10);
      continue;
    }
    unmodelled.push(tok);
  }
  if (anti.length > 0) out.anti = anti;
  if (unmodelled.length > 0) out.unmodelled = unmodelled;
  return out;
}
