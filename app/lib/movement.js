// app/lib/movement.js
//
// Parse a datasheet's M characteristic into { min, max } in inches.
// Returns null when the input can't be interpreted (e.g. "*", missing).
//
// Supported shapes:
//   "6\""             → { min: 6, max: 6 }
//   "10\""            → { min: 10, max: 10 }
//   "D6+2\""          → { min: 3,  max: 8  }
//   "2D6+1\""         → { min: 3,  max: 13 }
//   "D3+1\""          → { min: 2,  max: 4  }
//   "D6\""            → { min: 1,  max: 6  }
//   "D6-1\""          → { min: 0,  max: 5  }   (D-min/D-max are floored at 0)
//   "*", "", null     → null

const DICE_RE = /^\s*(\d*)\s*[Dd](\d+)\s*([+-]\s*\d+)?\s*"?\s*$/;
const FIXED_RE = /^\s*(\d+)\s*"?\s*$/;

function clampZero(n) {
  return n < 0 ? 0 : n;
}

export function parseMovement(mStr) {
  if (mStr === null || mStr === undefined) return null;
  const s = String(mStr).trim();
  if (!s || s === '*' || s === '-') return null;

  const fixed = FIXED_RE.exec(s);
  if (fixed) {
    const n = parseInt(fixed[1], 10);
    return { min: n, max: n };
  }

  const dice = DICE_RE.exec(s);
  if (dice) {
    const count = dice[1] ? parseInt(dice[1], 10) : 1;
    const sides = parseInt(dice[2], 10);
    const mod = dice[3] ? parseInt(dice[3].replace(/\s+/g, ''), 10) : 0;
    const min = clampZero(count + mod);          // each die rolls at least 1
    const max = clampZero(count * sides + mod);  // each die rolls at most `sides`
    return { min, max };
  }

  return null;
}
