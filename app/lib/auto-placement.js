// app/lib/auto-placement.js
// Pack units into a deployment-zone polygon largest-first.
//
// Input units must carry `_base.diameter_mm` (resolved from datasheet)
// and model counts (from roster). Units without `_base` default to
// 32mm.

import { pointInPolygon, polygonBounds } from './geometry.js';

const INTER_UNIT_GAP_IN = 1.0;
const GRID_STEP_IN = 1.0;
const MM_PER_INCH = 25.4;

function baseDiameterInches(u) {
  const mm = u._base?.diameter_mm ?? 32;
  return mm / MM_PER_INCH;
}

function unitFootprintRadius(u) {
  // Rough bounding radius based on model count + base diameter.
  // A single-row cluster of n bases is ≈ (n * baseDia)/2 radius.
  // Use sqrt(n) as a hex-packing approximation.
  const d = baseDiameterInches(u);
  return (Math.sqrt(u.total_models) * d) / 2 + d / 2;
}

export function autoPlaceUnits(units, zone) {
  const sorted = [...units].sort((a, b) => unitFootprintRadius(b) - unitFootprintRadius(a));

  const { minX, minY, maxX, maxY } = polygonBounds(zone);
  const placements = [];

  for (const unit of sorted) {
    const r = unitFootprintRadius(unit);
    let placed = false;

    for (let y = minY + 0.5; y <= maxY - 0.5 && !placed; y += GRID_STEP_IN) {
      for (let x = minX + 0.5; x <= maxX - 0.5 && !placed; x += GRID_STEP_IN) {
        if (!pointInPolygon([x, y], zone)) continue;

        let clear = true;
        for (const p of placements) {
          const dx = p.centerIn[0] - x, dy = p.centerIn[1] - y;
          const minDist = r + p.radius + INTER_UNIT_GAP_IN;
          if ((dx * dx + dy * dy) < minDist * minDist) { clear = false; break; }
        }
        if (!clear) continue;

        const offsets = [[0, -r], [0, r], [-r, 0], [r, 0]];
        const circleInZone = offsets.every(([dx, dy]) => pointInPolygon([x + dx, y + dy], zone));
        if (!circleInZone) continue;

        placements.push({ unit, centerIn: [x, y], radius: r });
        placed = true;
      }
    }

    if (!placed) {
      placements.push({
        unit,
        centerIn: [(minX + maxX) / 2, (minY + maxY) / 2],
        radius: r,
        overlap: true,
      });
    }
  }

  return placements;
}
