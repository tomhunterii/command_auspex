// app/lib/model-positions.js
// Compute on-board model circles for a unit at a candidate centerIn, and
// resolve unit-vs-unit base overlaps by nudging the target unit out of any
// other unit's circles. Used by drag-drop, the context-menu spacing/rotate/
// formation sliders, and the mission-load path so two model bases can
// never share the same space.

import { baseDiameterPx, formationOffsets } from './base-geometry.js';

/**
 * Returns the per-model circle geometry [{cx, cy, r}, ...] for a unit at
 * `centerIn`. Honours the same `_formation`, `_rotationDeg`, and
 * `_spacingGapIn` overrides the renderer reads, so the collision math
 * sees the same circles the user does.
 *
 * `unit.models[i]._sourceDatasheet` (set when an attached leader is folded
 * in by applyAttachmentsToPlacements) supplies that submodel's own base
 * diameter, so a Logan attached to Wolf Guard Terminators yields the
 * 80mm + 5×40mm circles, not 6×40mm.
 */
export function computeModelCircles(unit, datasheet, centerIn) {
  if (!unit || !centerIn) return [];
  const defaultMm = datasheet?.base?.diameter_mm ?? 32;
  const perModel = datasheet?.base?.per_model ?? null;

  const models = [];
  for (const sub of unit.models ?? []) {
    const ownDs = sub._sourceDatasheet ?? null;
    const ownDefaultMm = ownDs?.base?.diameter_mm ?? defaultMm;
    const ownPerModel = ownDs?.base?.per_model ?? perModel;
    const match = ownPerModel?.find(pm => pm.submodel === sub.submodel);
    const mm = match?.diameter_mm ?? ownDefaultMm;
    const count = sub.count ?? 1;
    for (let k = 0; k < count; k++) models.push({ mm });
  }
  if (models.length === 0) return [];

  // Per-model absolute-position override (set by the resolver's per-model
  // packing fallback). Each model gets its own centre, independent of the
  // rigid formation lattice — used when the cluster can't fit and the unit
  // needs to rearrange around terrain / edges / other units.
  if (Array.isArray(unit._modelPositions) && unit._modelPositions.length === models.length) {
    return models.map((m, i) => ({
      cx: unit._modelPositions[i][0],
      cy: unit._modelPositions[i][1],
      r: baseDiameterPx(m.mm) / 2,
    }));
  }

  const maxMm = models.reduce((m, x) => Math.max(m, x.mm), defaultMm);
  const formation = unit._formation ?? 'cluster';
  const perModelPx = models.map(m => baseDiameterPx(m.mm));
  const gapIn = (typeof unit._spacingGapIn === 'number') ? unit._spacingGapIn : 0.5;
  const rotDeg = (typeof unit._rotationDeg === 'number') ? unit._rotationDeg : 0;
  const rawOffsets = formationOffsets(formation, models.length, baseDiameterPx(maxMm), perModelPx, gapIn);
  const offsets = rotDeg
    ? rawOffsets.map(([x, y]) => {
        const rad = rotDeg * Math.PI / 180;
        const c = Math.cos(rad), s = Math.sin(rad);
        return [x * c - y * s, x * s + y * c];
      })
    : rawOffsets;

  const [cx, cy] = centerIn;
  return models.map((m, i) => ({
    cx: cx + offsets[i][0],
    cy: cy + offsets[i][1],
    r: baseDiameterPx(m.mm) / 2,
  }));
}

/**
 * Mutates `target.centerIn` to the closest position where no model circle
 * in `target` overlaps any model circle in `others`. Strategy: outward
 * spiral from the desired center, returning the first ring slot that's
 * clear. Closest-unoccupied-space behaviour by construction.
 *
 * - `gapIn` reserves extra clearance between bases (default 0 — bases may
 *   touch but never overlap, matching tabletop measurement).
 * - `bounds` ({minX,minY,maxX,maxY}) keeps the resolved centre on the
 *   table; default is a standard 60×44" board.
 * - `stepIn` (default 0.5") and `maxStepIn` (default 30") size the spiral.
 * - `angularResolution` (default 24) is how many candidate angles per ring.
 * - Returns true if a clear position was found, false if the spiral
 *   exhausted without resolution; on failure the original centerIn is
 *   preserved so callers never silently keep an overlapping placement.
 */
export function resolveUnitOverlap(target, others, opts = {}) {
  const {
    gapIn = 0,
    bounds = { minX: 0, minY: 0, maxX: 60, maxY: 44 },
    stepIn = 0.25,
    maxStepIn = 75,
    angularResolution = 36,
  } = opts;
  if (!target) return true;
  // Pre-compute every other unit's circles ONCE — they don't change while
  // we hunt for the target's clear spot, and recomputing them per candidate
  // is the hot path in dense scenes.
  const otherCircles = (others ?? [])
    .map(o => computeModelCircles(o.unit, o.datasheet, o.centerIn))
    .filter(arr => arr.length > 0);
  // Already valid (clear AND fully on-board)?
  if (positionIsValid(target.unit, target.datasheet, target.centerIn, otherCircles, gapIn, bounds)) {
    return true;
  }
  // Seeded start angle so two units stacked at the same point don't both
  // squirt the same way — derived from the stable instanceId so the same
  // unit always picks the same direction first.
  const seed = hashString(String(target._instanceId ?? target.unit?.name ?? ''));
  const startAngleStep = seed % angularResolution;
  const [t0x, t0y] = target.centerIn;
  let bestPos = [t0x, t0y];
  let bestCost = positionCost(target.unit, target.datasheet, [t0x, t0y], otherCircles, gapIn, bounds);
  for (let r = stepIn; r <= maxStepIn + 1e-9; r += stepIn) {
    for (let a = 0; a < angularResolution; a++) {
      const ang = ((a + startAngleStep) % angularResolution) / angularResolution * Math.PI * 2;
      const cx = t0x + Math.cos(ang) * r;
      const cy = t0y + Math.sin(ang) * r;
      if (positionIsValid(target.unit, target.datasheet, [cx, cy], otherCircles, gapIn, bounds)) {
        target.centerIn = [cx, cy];
        return true;
      }
      const cost = positionCost(target.unit, target.datasheet, [cx, cy], otherCircles, gapIn, bounds);
      if (cost < bestCost) {
        bestCost = cost;
        bestPos = [cx, cy];
      }
    }
  }
  // Spiral exhausted without finding a fully-valid whole-cluster spot.
  // Try per-model packing — each model independently finds its closest
  // valid position, allowing the unit to REARRANGE around edges/obstacles
  // instead of being treated as a rigid block.
  const packed = packModelsIndependently(target, otherCircles, {
    bounds, gapIn, stepIn, maxStepIn, angularResolution,
  });
  if (packed) {
    if (target.unit) target.unit._modelPositions = packed;
    // Update centerIn to the centroid so drag/rotate continue to make sense.
    let sx = 0, sy = 0;
    for (const [x, y] of packed) { sx += x; sy += y; }
    target.centerIn = [sx / packed.length, sy / packed.length];
    return true;
  }
  // Last-resort fallback: lowest-cost whole-cluster position seen.
  // Out-of-bounds is weighted heavily, so this always beats off-board.
  target.centerIn = bestPos;
  return false;
}

// Per-model packing: places each circle of `target` at the closest valid
// position to its formation slot (where "valid" = on board, clear of every
// already-placed circle: same-unit packed so far, plus all other-unit
// circles). Returns Array<[x,y]> in model-index order, or null if any
// model can't be placed.
function packModelsIndependently(target, otherCirclesArr, opts) {
  const { bounds, gapIn, stepIn, maxStepIn, angularResolution } = opts;
  // Use the unit's formation-slot positions as initial guesses, computed
  // WITHOUT any prior _modelPositions override so we start from the
  // "ideal" lattice.
  const tmpUnit = { ...target.unit, _modelPositions: undefined };
  const idealCircles = computeModelCircles(tmpUnit, target.datasheet, target.centerIn);
  if (idealCircles.length === 0) return null;
  const blockingFromOthers = otherCirclesArr.flat();
  const placed = []; // same-unit circles placed so far
  const positions = [];
  // Largest-first so big bases anchor and smaller models rearrange around
  // them. Track original indices so the returned array matches model order.
  const order = idealCircles
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.r - a.c.r);
  const indexed = new Array(idealCircles.length);
  for (const { c: ideal, i } of order) {
    const found = findNearestValidModelPosition(
      ideal, blockingFromOthers, placed, bounds, gapIn, stepIn, maxStepIn, angularResolution,
    );
    if (!found) return null;
    indexed[i] = found;
    placed.push({ cx: found[0], cy: found[1], r: ideal.r });
  }
  for (let i = 0; i < indexed.length; i++) positions.push(indexed[i]);
  return positions;
}

function findNearestValidModelPosition(ideal, blockingFromOthers, sameUnitPlaced, bounds, gapIn, stepIn, maxStepIn, angRes) {
  if (modelCircleFits(ideal.cx, ideal.cy, ideal.r, bounds, blockingFromOthers, sameUnitPlaced, gapIn)) {
    return [ideal.cx, ideal.cy];
  }
  for (let r = stepIn; r <= maxStepIn + 1e-9; r += stepIn) {
    for (let a = 0; a < angRes; a++) {
      const ang = (a / angRes) * Math.PI * 2;
      const cx = ideal.cx + Math.cos(ang) * r;
      const cy = ideal.cy + Math.sin(ang) * r;
      if (modelCircleFits(cx, cy, ideal.r, bounds, blockingFromOthers, sameUnitPlaced, gapIn)) {
        return [cx, cy];
      }
    }
  }
  return null;
}

function modelCircleFits(cx, cy, r, bounds, blockingFromOthers, sameUnitPlaced, gapIn) {
  if (cx - r < bounds.minX - 1e-6) return false;
  if (cx + r > bounds.maxX + 1e-6) return false;
  if (cy - r < bounds.minY - 1e-6) return false;
  if (cy + r > bounds.maxY + 1e-6) return false;
  for (const b of blockingFromOthers) {
    const d = Math.hypot(cx - b.cx, cy - b.cy);
    if (d < r + b.r + gapIn - 1e-6) return false;
  }
  for (const b of sameUnitPlaced) {
    const d = Math.hypot(cx - b.cx, cy - b.cy);
    if (d < r + b.r + gapIn - 1e-6) return false;
  }
  return true;
}

// True iff every model circle of (unit at center) sits entirely inside
// `bounds` AND clear of every pre-computed other-unit circle.
function positionIsValid(unit, datasheet, center, otherCirclesArr, gapIn, bounds) {
  const tCircles = computeModelCircles(unit, datasheet, center);
  if (tCircles.length === 0) return true;
  for (const c of tCircles) {
    if (c.cx - c.r < bounds.minX - 1e-6) return false;
    if (c.cx + c.r > bounds.maxX + 1e-6) return false;
    if (c.cy - c.r < bounds.minY - 1e-6) return false;
    if (c.cy + c.r > bounds.maxY + 1e-6) return false;
  }
  for (const oCircles of otherCirclesArr) {
    for (const t of tCircles) {
      for (const oc of oCircles) {
        const d = Math.hypot(t.cx - oc.cx, t.cy - oc.cy);
        if (d < t.r + oc.r + gapIn - 1e-6) return false;
      }
    }
  }
  return true;
}

// Sum of all overlap depths plus heavily-weighted out-of-bounds penalties.
// Used to rank candidate positions when no fully-valid spot is found in
// the spiral, so the fallback prefers in-bounds-with-some-overlap to
// off-board-but-clear and prefers small overlaps to large.
function positionCost(unit, datasheet, center, otherCirclesArr, gapIn, bounds) {
  const tCircles = computeModelCircles(unit, datasheet, center);
  if (tCircles.length === 0) return 0;
  let cost = 0;
  // Out-of-bounds depth × 100 — board edges are inviolable.
  for (const c of tCircles) {
    cost += Math.max(0, bounds.minX - (c.cx - c.r)) * 100;
    cost += Math.max(0, (c.cx + c.r) - bounds.maxX) * 100;
    cost += Math.max(0, bounds.minY - (c.cy - c.r)) * 100;
    cost += Math.max(0, (c.cy + c.r) - bounds.maxY) * 100;
  }
  // Cross-unit overlap depth — soft penalty.
  for (const oCircles of otherCirclesArr) {
    for (const t of tCircles) {
      for (const oc of oCircles) {
        const d = Math.hypot(t.cx - oc.cx, t.cy - oc.cy);
        const overlap = (t.r + oc.r + gapIn) - d;
        if (overlap > 0) cost += overlap;
      }
    }
  }
  return cost;
}

function hashString(s) {
  // Tiny deterministic 32-bit hash — enough to spread instanceIds across
  // the angular-resolution range.
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

/**
 * Resolve overlaps across an array of placements in-place. Largest-footprint
 * units anchor; smaller units get nudged to clear them. Designed for the
 * mission-load post-pass when autoPlaceUnits couldn't find a clear spot and
 * dropped a unit at zone center on top of others.
 *
 * Cross-side collisions ARE resolved — attacker and defender bases can
 * never share physical space on the table.
 */
export function resolveAllOverlaps(placements, opts = {}) {
  // Largest-first so big units stay put and smaller ones move out of the way.
  const arr = [...placements].sort((a, b) => totalCircleArea(b) - totalCircleArea(a));
  for (let i = 1; i < arr.length; i++) {
    resolveUnitOverlap(arr[i], arr.slice(0, i), opts);
  }
}

function totalCircleArea(placement) {
  const cs = computeModelCircles(placement.unit, placement.datasheet, placement.centerIn);
  let s = 0;
  for (const c of cs) s += Math.PI * c.r * c.r;
  return s;
}
