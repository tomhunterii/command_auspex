// app/lib/base-geometry.js
// Convert mm base sizes to SVG user units (inches) and lay out model clusters.

export const INCH_PX = 1;
export const MM_PER_INCH = 25.4;

export function baseDiameterPx(mm) {
  return (mm / MM_PER_INCH) * INCH_PX;
}

/**
 * Return N [dx, dy] offsets (in inches) arranging `n` bases in a
 * tight hex cluster around the origin. Coherency spacing: gap of
 * 0.5" between base edges (well inside 2" coherency).
 */
export function clusterOffsets(n, baseDiameterPx, gapIn = 0.5) {
  if (n <= 0) return [];
  if (n === 1) return [[0, 0]];
  const gap = gapIn * INCH_PX;
  const step = baseDiameterPx + gap;
  const offsets = [[0, 0]];
  // Place subsequent models in expanding hex rings
  const ringDirs = [
    [1, 0], [0.5, Math.sqrt(3) / 2], [-0.5, Math.sqrt(3) / 2],
    [-1, 0], [-0.5, -Math.sqrt(3) / 2], [0.5, -Math.sqrt(3) / 2],
  ];
  let ring = 1;
  while (offsets.length < n) {
    let pos = [ring * step, 0];
    for (let side = 0; side < 6 && offsets.length < n; side++) {
      const dir = ringDirs[(side + 2) % 6];
      for (let k = 0; k < ring && offsets.length < n; k++) {
        offsets.push([pos[0], pos[1]]);
        pos = [pos[0] + dir[0] * step, pos[1] + dir[1] * step];
      }
    }
    ring++;
  }
  return offsets.slice(0, n);
}

/**
 * Per-model variant of clusterOffsets — handles mixed-base squads
 * (e.g., Wolf Guard Terminators on 40mm + Logan Grimnar on 80mm).
 *
 * Algorithm: lay out the hex lattice using the *modal* (most-common)
 * base diameter so rank-and-file pack tightly. For any model larger
 * than the modal base, push its slot radially outward by enough to
 * keep its edge clear of the rank-and-file neighbors. The outward
 * push is `(D_oversize - D_modal) / 2 + 0.25"` — derived from the
 * fact that a base of diameter D sitting at radius `modal_step`
 * needs an extra `(D - D_modal)/2` outward to keep its inner edge
 * where the modal-base edge would have been, plus a 0.25" cushion
 * against the angled neighbor at ±60°.
 *
 * Limitation: if two oversize models end up at adjacent ring slots
 * (rare — would require two characters in one squad on big bases),
 * they may still overlap each other. The single-leader case (the
 * common one) is handled correctly.
 *
 * @param {number[]} diametersPx — one entry per model in placement order
 * @returns {Array<[number, number]>} offsets, length = diametersPx.length
 */
export function clusterOffsetsMixed(diametersPx, gapIn = 0.5) {
  const n = diametersPx.length;
  if (n === 0) return [];
  if (n === 1) return [[0, 0]];

  // Modal diameter — most common base wins. Ties broken by first occurrence.
  const counts = new Map();
  for (const d of diametersPx) counts.set(d, (counts.get(d) ?? 0) + 1);
  let modalDia = diametersPx[0];
  let bestCount = 0;
  for (const [d, c] of counts.entries()) {
    if (c > bestCount) { bestCount = c; modalDia = d; }
  }

  // Lay out the lattice using the modal step.
  const offsets = clusterOffsets(n, modalDia, gapIn);

  // Push oversize models radially outward.
  const gap = gapIn * INCH_PX;
  // Closed-form push for an oversize on a hex ring: the oversize sits at a
  // ring slot at distance `r` from origin; its tightest neighbor (the same
  // ring, ±60° away) is at distance `step = modalDia + gap`. The line from
  // origin to neighbor and from origin to oversize subtend 60°, so neighbor
  // and oversize centers are at distance √((r - step/2)² + (step·√3/2)²).
  // We need that ≥ (D_over/2 + D_modal/2 + gap). Solving for r gives:
  //   r ≥ step/2 + √(R² - 3·step²/4)   where R = D_over/2 + D_modal/2 + gap
  // The previous heuristic `(d - modalDia)/2 + gap/2` under-pushed at small
  // gap values (e.g. Logan 80mm + Wolf Guard Terminators 40mm at gap=0
  // overlapped neighbors). The closed-form form is exact for ring-1 and an
  // upper bound for deeper rings, so it never overlaps.
  const stepIn = modalDia + gap;
  const requiredFor = (dOver) => dOver / 2 + modalDia / 2 + gap;
  const minRadiusFor = (dOver) => {
    const R = requiredFor(dOver);
    const cornerSq = (3 * stepIn * stepIn) / 4;
    const inside = R * R - cornerSq;
    return stepIn / 2 + Math.sqrt(Math.max(0, inside));
  };
  for (let i = 0; i < n; i++) {
    const d = diametersPx[i];
    if (d <= modalDia + 1e-6) continue; // rank-and-file or smaller — no push
    const [x, y] = offsets[i];
    const r = Math.sqrt(x * x + y * y);
    if (r === 0) {
      // Oversize landed at center (i.e., placement order put the leader at
      // index 0). Move it to a ring-1 slot at angle 0 and shift whoever was
      // at ring-1 angle 0 into the center. This keeps rank-and-file at
      // center, where they belong.
      const neighborIdx = offsets.findIndex(([nx, ny], j) => j !== i &&
        Math.abs(Math.sqrt(nx*nx + ny*ny) - stepIn) < 1e-6);
      if (neighborIdx >= 0) {
        offsets[i] = [...offsets[neighborIdx]];
        offsets[neighborIdx] = [0, 0];
      }
      const [x2, y2] = offsets[i];
      const r2 = Math.sqrt(x2 * x2 + y2 * y2);
      if (r2 === 0) continue;
      const k = minRadiusFor(d) / r2;
      offsets[i] = [x2 * k, y2 * k];
      continue;
    }
    const target = Math.max(r, minRadiusFor(d));
    const k = target / r;
    offsets[i] = [x * k, y * k];
  }
  return offsets;
}

// Center an [rows × cols] rectangular grid of points around the origin,
// fill row-major up to `n` slots, return [dx, dy] inches per slot.
function gridOffsetsRowMajor(n, baseDiameterPx, rows, cols, gapIn = 0.5) {
  if (n <= 0) return [];
  const gap = gapIn * INCH_PX;
  const step = baseDiameterPx + gap;
  const x0 = -((cols - 1) * step) / 2;
  const y0 = -((rows - 1) * step) / 2;
  const offsets = [];
  for (let r = 0; r < rows && offsets.length < n; r++) {
    for (let c = 0; c < cols && offsets.length < n; c++) {
      offsets.push([x0 + c * step, y0 + r * step]);
    }
  }
  return offsets;
}

// Single-file line. Orientation 'horizontal' = row of n; 'vertical' = column of n.
export function lineOffsets(n, baseDiameterPx, orientation = 'horizontal', gapIn = 0.5) {
  const rows = orientation === 'vertical' ? n : 1;
  const cols = orientation === 'vertical' ? 1 : n;
  return gridOffsetsRowMajor(n, baseDiameterPx, rows, cols, gapIn);
}

// Fixed-width column formation, defaults to 2 wide. Fills row-major.
export function columnOffsets(n, baseDiameterPx, cols = 2, gapIn = 0.5) {
  if (n <= 0) return [];
  const c = Math.max(1, Math.min(cols, n));
  const rows = Math.ceil(n / c);
  return gridOffsetsRowMajor(n, baseDiameterPx, rows, c, gapIn);
}

// Standard rectangular block — caps row count at `maxRows` (default 4),
// growing columns as needed. Fills row-major. n=10, maxRows=4 → 3 cols × 4 rows.
export function standardOffsets(n, baseDiameterPx, maxRows = 4, gapIn = 0.5) {
  if (n <= 0) return [];
  const cols = Math.max(1, Math.ceil(n / maxRows));
  const rows = Math.min(maxRows, Math.ceil(n / cols));
  return gridOffsetsRowMajor(n, baseDiameterPx, rows, cols, gapIn);
}

// Formation dispatcher. Unknown formations fall back to 'cluster'.
//
// Optional `perModelDiametersPx` (one entry per model) opts in to per-model
// spacing for mixed-base squads — only applied to the 'cluster' formation,
// which is the one that benefits (grids/lines pre-commit to a uniform step
// because they're explicit user choices). When all entries are equal it
// degrades to the existing uniform-step path.
//
// Optional `gapIn` overrides the 0.5" default base-edge-to-base-edge gap.
// Range 0..2 inches (10th-Ed Unit Coherency tops out at 2" between bases).
//
// Legacy formation IDs are aliased so older saved scenarios still resolve:
//   'line_horizontal', 'line_vertical' → 'line'
//   'column'                            → 'rows_2'
//   'standard'                          → 'rows_4'
// (The unit context menu lets the captain rotate the formation, so the two
// line orientations and the column collapsed into a single 'line' / N-rows
// shape.)
export function formationOffsets(formation, n, baseDiameterPx, perModelDiametersPx = null, gapIn = 0.5) {
  if (formation === 'cluster' && perModelDiametersPx && perModelDiametersPx.length === n) {
    const allEqual = perModelDiametersPx.every(d => d === perModelDiametersPx[0]);
    if (!allEqual) return clusterOffsetsMixed(perModelDiametersPx, gapIn);
  }
  switch (formation) {
    case 'line':
    case 'line_horizontal':
    case 'line_vertical':   return lineOffsets(n, baseDiameterPx, 'horizontal', gapIn);
    case 'rows_2':
    case 'column':          return standardOffsets(n, baseDiameterPx, 2, gapIn);
    case 'rows_4':
    case 'standard':        return standardOffsets(n, baseDiameterPx, 4, gapIn);
    case 'cluster':
    default:                return clusterOffsets(n, baseDiameterPx, gapIn);
  }
}

export const FORMATIONS = [
  { id: 'cluster', label: 'Cluster' },
  { id: 'line',    label: 'Line' },
  { id: 'rows_2',  label: '2 Rows' },
  { id: 'rows_4',  label: '4 Rows' },
];
