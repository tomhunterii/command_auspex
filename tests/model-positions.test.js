import { test } from 'node:test';
import assert from 'node:assert';
import { computeModelCircles, resolveUnitOverlap, resolveAllOverlaps } from '../app/lib/model-positions.js';

const ds40 = { base: { diameter_mm: 40 } };
const ds80 = { base: { diameter_mm: 80 } };

function makeUnit(modelCount, opts = {}) {
  return {
    name: opts.name ?? 'TestUnit',
    models: [{ submodel: 'A', count: modelCount, wargear: [] }],
    _formation: opts.formation ?? 'cluster',
    _spacingGapIn: opts.spacingGapIn,
    _rotationDeg: opts.rotationDeg,
  };
}

test('computeModelCircles: single 40mm model centered at (10,10)', () => {
  const cs = computeModelCircles(makeUnit(1), ds40, [10, 10]);
  assert.strictEqual(cs.length, 1);
  assert.strictEqual(cs[0].cx, 10);
  assert.strictEqual(cs[0].cy, 10);
  assert.ok(Math.abs(cs[0].r - 40 / 25.4 / 2) < 1e-9);
});

test('computeModelCircles: 5 models in cluster — all radii match base', () => {
  const cs = computeModelCircles(makeUnit(5), ds40, [0, 0]);
  assert.strictEqual(cs.length, 5);
  for (const c of cs) assert.ok(Math.abs(c.r - 40 / 25.4 / 2) < 1e-9);
});

test('computeModelCircles: rotation rotates positions but keeps radii', () => {
  const a = computeModelCircles(makeUnit(5), ds40, [0, 0]);
  const b = computeModelCircles(makeUnit(5, { rotationDeg: 90 }), ds40, [0, 0]);
  assert.strictEqual(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.ok(Math.abs(a[i].r - b[i].r) < 1e-9, 'radius unchanged');
    // distance from origin preserved
    const ra = Math.hypot(a[i].cx, a[i].cy);
    const rb = Math.hypot(b[i].cx, b[i].cy);
    assert.ok(Math.abs(ra - rb) < 1e-6, 'distance from center preserved under rotation');
  }
});

test('computeModelCircles: attached-leader _sourceDatasheet drives mixed bases', () => {
  // 5 Wolf Guard Terminators on 40mm + Logan attached on 80mm.
  const unit = {
    name: 'WGT+Logan',
    models: [
      { submodel: 'WGT', count: 5, wargear: [] },
      { submodel: 'Logan', count: 1, wargear: [], _sourceDatasheet: ds80 },
    ],
  };
  const cs = computeModelCircles(unit, ds40, [0, 0]);
  assert.strictEqual(cs.length, 6);
  const radii = cs.map(c => c.r);
  const small = 40 / 25.4 / 2;
  const large = 80 / 25.4 / 2;
  assert.strictEqual(radii.filter(r => Math.abs(r - small) < 1e-9).length, 5);
  assert.strictEqual(radii.filter(r => Math.abs(r - large) < 1e-9).length, 1);
});

test('resolveUnitOverlap: pulls a stacked target out of an other unit', () => {
  const target = { _instanceId: 't', unit: makeUnit(3), datasheet: ds40, centerIn: [10, 10], role: 'a' };
  const other = { _instanceId: 'o', unit: makeUnit(3), datasheet: ds40, centerIn: [10, 10], role: 'a' };
  const ok = resolveUnitOverlap(target, [other]);
  assert.strictEqual(ok, true, 'should converge');
  // After resolution no target circle should overlap any other circle.
  const tCircles = computeModelCircles(target.unit, target.datasheet, target.centerIn);
  const oCircles = computeModelCircles(other.unit, other.datasheet, other.centerIn);
  for (const t of tCircles) {
    for (const o of oCircles) {
      const d = Math.hypot(t.cx - o.cx, t.cy - o.cy);
      assert.ok(d >= t.r + o.r - 1e-6, `overlap remains: dist ${d} < ${t.r + o.r}`);
    }
  }
});

test('resolveUnitOverlap: leaves a non-overlapping target untouched', () => {
  const target = { _instanceId: 't', unit: makeUnit(1), datasheet: ds40, centerIn: [10, 10], role: 'a' };
  const other = { _instanceId: 'o', unit: makeUnit(1), datasheet: ds40, centerIn: [30, 30], role: 'a' };
  const before = [...target.centerIn];
  const ok = resolveUnitOverlap(target, [other]);
  assert.strictEqual(ok, true);
  assert.deepStrictEqual(target.centerIn, before);
});

test('resolveUnitOverlap: clamps inside default board bounds', () => {
  // Push from a near-corner — resolved centerIn must stay inside [0..60, 0..44].
  const target = { _instanceId: 't', unit: makeUnit(3), datasheet: ds40, centerIn: [1, 1], role: 'a' };
  const other = { _instanceId: 'o', unit: makeUnit(3), datasheet: ds40, centerIn: [1, 1], role: 'a' };
  resolveUnitOverlap(target, [other]);
  assert.ok(target.centerIn[0] >= 0 && target.centerIn[0] <= 60, `cx ${target.centerIn[0]} out of bounds`);
  assert.ok(target.centerIn[1] >= 0 && target.centerIn[1] <= 44, `cy ${target.centerIn[1]} out of bounds`);
});

test('resolveUnitOverlap: every model circle stays on the table (strict bounds)', () => {
  // No others, target dragged way off the left edge. Strict bounds: every
  // model in the cluster must fit on the table. The unit nudges to the
  // closest position where the entire cluster is on the board.
  const target = { _instanceId: 't', unit: makeUnit(10), datasheet: ds40, centerIn: [-10, 22], role: 'a' };
  resolveUnitOverlap(target, []);
  const circles = computeModelCircles(target.unit, target.datasheet, target.centerIn);
  for (const c of circles) {
    assert.ok(c.cx - c.r >= -1e-6, `model edge clipped left: cx=${c.cx} r=${c.r}`);
    assert.ok(c.cx + c.r <= 60 + 1e-6, `model edge clipped right: cx=${c.cx} r=${c.r}`);
    assert.ok(c.cy - c.r >= -1e-6, `model edge clipped top: cy=${c.cy} r=${c.r}`);
    assert.ok(c.cy + c.r <= 44 + 1e-6, `model edge clipped bottom: cy=${c.cy} r=${c.r}`);
  }
});

test('resolveUnitOverlap: drop near edge snaps in just enough to fit', () => {
  // A single 40mm model dropped at (0.1, 22) — should land at the smallest
  // valid x ≈ r40 (~0.79"), not be pushed across the board.
  const target = { _instanceId: 't', unit: makeUnit(1), datasheet: ds40, centerIn: [0.1, 22], role: 'a' };
  resolveUnitOverlap(target, []);
  const r40 = 40 / 25.4 / 2;
  // x should be ≈ r40 ± stepIn (0.25"). Generously 0..r40 + 0.5".
  assert.ok(target.centerIn[0] >= r40 - 1e-6,
    `centerIn left of valid range: cx=${target.centerIn[0]} r=${r40}`);
  assert.ok(target.centerIn[0] < r40 + 0.5,
    `centerIn pushed too far inboard: cx=${target.centerIn[0]} r=${r40}`);
});

test('resolveUnitOverlap: deterministic break angle via instanceId hash', () => {
  // Two perfectly-stacked, equal-mass targets with different ids should
  // squirt in distinguishable directions when sandwiched.
  const a = { _instanceId: 'aaa', unit: makeUnit(1), datasheet: ds40, centerIn: [30, 22], role: 'a' };
  const b = { _instanceId: 'bbb', unit: makeUnit(1), datasheet: ds40, centerIn: [30, 22], role: 'a' };
  // Stack them with a same-position pusher.
  const pusher = { _instanceId: 'p', unit: makeUnit(1), datasheet: ds40, centerIn: [30, 22], role: 'a' };
  resolveUnitOverlap(a, [pusher]);
  resolveUnitOverlap(b, [pusher]);
  // They should land at different points (the break angles are seeded by id).
  const dist = Math.hypot(a.centerIn[0] - b.centerIn[0], a.centerIn[1] - b.centerIn[1]);
  assert.ok(dist > 1e-3, 'different instanceIds should produce different break directions');
});

test('resolveAllOverlaps: cross-side collision is resolved (attacker/defender share the table)', () => {
  const def = { _instanceId: 'd', unit: makeUnit(3), datasheet: ds40, centerIn: [10, 10], role: 'defender' };
  const att = { _instanceId: 'a', unit: makeUnit(3), datasheet: ds40, centerIn: [10, 10], role: 'attacker' };
  resolveAllOverlaps([def, att]);
  // One of them keeps the original spot; the other moves clear of it.
  // Neither should be exactly stacked on the other.
  const moved = (def.centerIn[0] !== 10 || def.centerIn[1] !== 10)
             || (att.centerIn[0] !== 10 || att.centerIn[1] !== 10);
  assert.ok(moved, 'cross-side stack must trigger a nudge');
  // No model circle of either unit overlaps any of the other's circles.
  const defC = computeModelCircles(def.unit, def.datasheet, def.centerIn);
  const attC = computeModelCircles(att.unit, att.datasheet, att.centerIn);
  for (const a of defC) {
    for (const b of attC) {
      const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
      assert.ok(d >= a.r + b.r - 1e-6, `cross-side overlap remains: dist ${d} < ${a.r + b.r}`);
    }
  }
});

test('resolveUnitOverlap: per-model packing kicks in when whole-cluster cannot fit', () => {
  // 6 models, 40mm bases, dropped right at the corner — strict bounds make
  // a hex cluster unable to fit, so the resolver should fall back to
  // per-model independent packing and write _modelPositions.
  const target = { _instanceId: 't', unit: makeUnit(6), datasheet: ds40, centerIn: [1, 1], role: 'a' };
  resolveUnitOverlap(target, []);
  // After resolve, every model must be inside the board.
  const circles = computeModelCircles(target.unit, target.datasheet, target.centerIn);
  for (const c of circles) {
    assert.ok(c.cx - c.r >= -1e-6 && c.cx + c.r <= 60 + 1e-6
      && c.cy - c.r >= -1e-6 && c.cy + c.r <= 44 + 1e-6,
      `model out of bounds after resolve: cx=${c.cx} cy=${c.cy} r=${c.r}`);
  }
  // No model overlaps another.
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const d = Math.hypot(circles[i].cx - circles[j].cx, circles[i].cy - circles[j].cy);
      assert.ok(d >= circles[i].r + circles[j].r - 1e-6,
        `models overlap: i=${i} j=${j} d=${d}`);
    }
  }
});

test('resolveAllOverlaps: largest-first anchoring', () => {
  // Big anchor + 2 small overlapping it. After resolve, big stays put; smalls move.
  const big = { _instanceId: 'big', unit: makeUnit(10), datasheet: ds40, centerIn: [30, 22], role: 'a' };
  const s1 = { _instanceId: 's1', unit: makeUnit(1), datasheet: ds40, centerIn: [30, 22], role: 'a' };
  const s2 = { _instanceId: 's2', unit: makeUnit(1), datasheet: ds40, centerIn: [30, 22], role: 'a' };
  resolveAllOverlaps([big, s1, s2]);
  assert.deepStrictEqual(big.centerIn, [30, 22], 'largest unit anchors');
  assert.notDeepStrictEqual(s1.centerIn, [30, 22], 's1 moved');
  assert.notDeepStrictEqual(s2.centerIn, [30, 22], 's2 moved');
});
