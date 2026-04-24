// app/lib/base-geometry.js
// Convert mm base sizes to board pixels and lay out model clusters.

export const INCH_PX = 10;
export const MM_PER_INCH = 25.4;

export function baseDiameterPx(mm) {
  return (mm / MM_PER_INCH) * INCH_PX;
}

/**
 * Return N [dx, dy] offsets (in pixels) arranging `n` bases in a
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
