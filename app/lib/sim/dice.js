// app/lib/sim/dice.js
//
// Parses Warhammer 40k 10th-edition dice expressions and returns roll
// functions that take an RNG (default: Math.random) and produce a numeric
// result. Supports the common shapes:
//   "3"      — static integer
//   "D6"     — single d6
//   "D3"     — single d3 (rolls 1d6 then halves rounded up; equivalent to floor(rng*3)+1)
//   "2D6"    — two d6, summed
//   "D6+2"   — d6 plus modifier
//   "2D6+1"  — two d6 plus modifier
// Empty / dash / unknown forms return a roll function that returns 0 so the
// engine can flag the weapon as unparseable rather than crashing.

const DICE_RE = /^\s*(\d+)?\s*[dD](\d+)\s*([+\-]\s*\d+)?\s*$/;
const STATIC_RE = /^\s*(\d+)\s*$/;

function parseModifier(s) {
  if (!s) return 0;
  return parseInt(s.replace(/\s+/g, ''), 10);
}

export function parseDice(expr) {
  if (typeof expr !== 'string' || !expr.trim()) {
    return (_rng) => 0;
  }
  const trimmed = expr.trim();
  const staticMatch = STATIC_RE.exec(trimmed);
  if (staticMatch) {
    const n = parseInt(staticMatch[1], 10);
    return (_rng) => n;
  }
  const m = DICE_RE.exec(trimmed);
  if (!m) {
    return (_rng) => 0;
  }
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const modifier = parseModifier(m[3]);
  return (rng) => {
    let total = modifier;
    for (let i = 0; i < count; i++) {
      total += Math.floor(rng() * sides) + 1;
    }
    return total;
  };
}

// Convenience: parse + roll once with default RNG.
export function rollDice(expr, rng = Math.random) {
  return parseDice(expr)(rng);
}
