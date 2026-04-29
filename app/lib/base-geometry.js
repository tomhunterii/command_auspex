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
export function formationOffsets(formation, n, baseDiameterPx) {
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
