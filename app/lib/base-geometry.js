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
export function clusterOffsets(n, baseDiameterPx) {
  if (n <= 0) return [];
  if (n === 1) return [[0, 0]];
  const gap = 0.5 * INCH_PX; // 0.5" gap
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
export function clusterOffsetsMixed(diametersPx) {
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
  const offsets = clusterOffsets(n, modalDia);

  // Push oversize models radially outward.
  const gap = 0.5 * INCH_PX;
  for (let i = 0; i < n; i++) {
    const d = diametersPx[i];
    if (d <= modalDia + 1e-6) continue; // rank-and-file or smaller — no push
    const [x, y] = offsets[i];
    const r = Math.sqrt(x * x + y * y);
    if (r === 0) {
      // Oversize landed at center (i.e., placement order put the leader at
      // index 0). Move it to a ring-1 slot at angle 0 with the pushed radius
      // and shift whoever was at ring-1 angle 0 into the center. This keeps
      // rank-and-file at center, where they belong.
      const neighborIdx = offsets.findIndex(([nx, ny], j) => j !== i &&
        Math.abs(Math.sqrt(nx*nx + ny*ny) - (modalDia + gap)) < 1e-6);
      if (neighborIdx >= 0) {
        offsets[i] = [...offsets[neighborIdx]];
        offsets[neighborIdx] = [0, 0];
      }
      // Re-read the new position for the push step below.
      const [x2, y2] = offsets[i];
      const r2 = Math.sqrt(x2 * x2 + y2 * y2);
      if (r2 === 0) continue;
      const extra = (d - modalDia) / 2 + gap / 2;
      const k = (r2 + extra) / r2;
      offsets[i] = [x2 * k, y2 * k];
      continue;
    }
    const extra = (d - modalDia) / 2 + gap / 2;
    const k = (r + extra) / r;
    offsets[i] = [x * k, y * k];
  }
  return offsets;
}

// Center an [rows × cols] rectangular grid of points around the origin,
// fill row-major up to `n` slots, return [dx, dy] inches per slot.
function gridOffsetsRowMajor(n, baseDiameterPx, rows, cols) {
  if (n <= 0) return [];
  const gap = 0.5 * INCH_PX;
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
export function lineOffsets(n, baseDiameterPx, orientation = 'horizontal') {
  const rows = orientation === 'vertical' ? n : 1;
  const cols = orientation === 'vertical' ? 1 : n;
  return gridOffsetsRowMajor(n, baseDiameterPx, rows, cols);
}

// Fixed-width column formation, defaults to 2 wide. Fills row-major.
export function columnOffsets(n, baseDiameterPx, cols = 2) {
  if (n <= 0) return [];
  const c = Math.max(1, Math.min(cols, n));
  const rows = Math.ceil(n / c);
  return gridOffsetsRowMajor(n, baseDiameterPx, rows, c);
}

// Standard rectangular block — caps row count at `maxRows` (default 4),
// growing columns as needed. Fills row-major. n=10, maxRows=4 → 3 cols × 4 rows.
export function standardOffsets(n, baseDiameterPx, maxRows = 4) {
  if (n <= 0) return [];
  const cols = Math.max(1, Math.ceil(n / maxRows));
  const rows = Math.min(maxRows, Math.ceil(n / cols));
  return gridOffsetsRowMajor(n, baseDiameterPx, rows, cols);
}

// Formation dispatcher. Unknown formations fall back to 'cluster'.
//
// Optional `perModelDiametersPx` (one entry per model) opts in to per-model
// spacing for mixed-base squads — only applied to the 'cluster' formation,
// which is the one that benefits (grids/lines pre-commit to a uniform step
// because they're explicit user choices). When all entries are equal it
// degrades to the existing uniform-step path.
export function formationOffsets(formation, n, baseDiameterPx, perModelDiametersPx = null) {
  if (formation === 'cluster' && perModelDiametersPx && perModelDiametersPx.length === n) {
    const allEqual = perModelDiametersPx.every(d => d === perModelDiametersPx[0]);
    if (!allEqual) return clusterOffsetsMixed(perModelDiametersPx);
  }
  switch (formation) {
    case 'line_horizontal': return lineOffsets(n, baseDiameterPx, 'horizontal');
    case 'line_vertical':   return lineOffsets(n, baseDiameterPx, 'vertical');
    case 'column':          return columnOffsets(n, baseDiameterPx, 2);
    case 'standard':        return standardOffsets(n, baseDiameterPx, 4);
    case 'cluster':
    default:                return clusterOffsets(n, baseDiameterPx);
  }
}

export const FORMATIONS = [
  { id: 'cluster',         label: 'Cluster' },
  { id: 'line_vertical',   label: 'Vertical Line' },
  { id: 'line_horizontal', label: 'Horizontal Line' },
  { id: 'column',          label: 'Column (2 wide)' },
  { id: 'standard',        label: 'Standard (max 4 rows)' },
];
