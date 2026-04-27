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
]);

const SUSTAINED_HITS_RE = /^SUSTAINED HITS\s*(\d*)$/;
const RAPID_FIRE_RE = /^RAPID FIRE\s*(\d*)$/;
const ANTI_RE = /^ANTI-([A-Z][A-Z\s\-]*?)\s+(\d+)\+$/;

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
    unmodelled.push(tok);
  }
  if (anti.length > 0) out.anti = anti;
  if (unmodelled.length > 0) out.unmodelled = unmodelled;
  return out;
}
