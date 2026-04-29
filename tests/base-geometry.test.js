import { test } from 'node:test';
import assert from 'node:assert';
import {
  baseDiameterPx, clusterOffsets, lineOffsets, columnOffsets, standardOffsets,
  formationOffsets, FORMATIONS, INCH_PX, MM_PER_INCH,
} from '../app/lib/base-geometry.js';

test('baseDiameterPx converts mm to inches (INCH_PX=1)', () => {
  // 32mm base = 32/25.4 ≈ 1.2598"
  assert.ok(Math.abs(baseDiameterPx(32) - 1.2598) < 0.001);
  // 40mm base = 40/25.4 ≈ 1.5748"
  assert.ok(Math.abs(baseDiameterPx(40) - 1.5748) < 0.001);
});

test('clusterOffsets places 1 model at origin', () => {
  const offsets = clusterOffsets(1, 1.26); // 32mm ≈ 1.26"
  assert.deepStrictEqual(offsets, [[0, 0]]);
});

test('clusterOffsets places 5 models in a hex cluster (1 + 4 around)', () => {
  const offsets = clusterOffsets(5, 1.26);
  assert.strictEqual(offsets.length, 5);
  assert.deepStrictEqual(offsets[0], [0, 0]);
});

test('clusterOffsets places 6 models in hex (1 center + 6 periphery) returning 6', () => {
  const offsets = clusterOffsets(6, 1.26);
  assert.strictEqual(offsets.length, 6);
});

test('lineOffsets horizontal: all y=0, x evenly spaced, centred on origin', () => {
  const offsets = lineOffsets(5, 1.26, 'horizontal');
  assert.strictEqual(offsets.length, 5);
  for (const [, y] of offsets) assert.strictEqual(y, 0);
  // First x should mirror last x around 0.
  assert.ok(Math.abs(offsets[0][0] + offsets[4][0]) < 1e-9);
  // Spacing = base + 0.5" gap.
  assert.ok(Math.abs((offsets[1][0] - offsets[0][0]) - (1.26 + 0.5)) < 1e-9);
});

test('lineOffsets vertical: all x=0, y evenly spaced', () => {
  const offsets = lineOffsets(4, 1.26, 'vertical');
  assert.strictEqual(offsets.length, 4);
  for (const [x] of offsets) assert.strictEqual(x, 0);
  assert.ok(Math.abs((offsets[1][1] - offsets[0][1]) - (1.26 + 0.5)) < 1e-9);
});

test('columnOffsets default 2-wide: 5 models -> 2 cols × 3 rows, partially filled', () => {
  const offsets = columnOffsets(5, 1.26);
  assert.strictEqual(offsets.length, 5);
  // First two share y (same row); 2 distinct x values (2 cols), 3 distinct y values.
  assert.strictEqual(offsets[0][1], offsets[1][1]);
  const xs = new Set(offsets.map(o => o[0]));
  const ys = new Set(offsets.map(o => o[1]));
  assert.strictEqual(xs.size, 2);
  assert.strictEqual(ys.size, 3);
});

test('standardOffsets: 10 models, max 4 rows -> 3 cols × 4 rows (last row partial)', () => {
  const offsets = standardOffsets(10, 1.26, 4);
  assert.strictEqual(offsets.length, 10);
  // Distinct y values should be ≤ 4 (max rows).
  const ys = new Set(offsets.map(o => o[1]));
  assert.ok(ys.size <= 4, `expected ≤4 rows, got ${ys.size}`);
});

test('standardOffsets: 20 models, max 4 rows -> 5 cols × 4 rows', () => {
  const offsets = standardOffsets(20, 1.26, 4);
  assert.strictEqual(offsets.length, 20);
  const ys = new Set(offsets.map(o => o[1]));
  const xs = new Set(offsets.map(o => o[0]));
  assert.strictEqual(ys.size, 4);
  assert.strictEqual(xs.size, 5);
});

test('formationOffsets dispatches to the right backend', () => {
  assert.strictEqual(formationOffsets('cluster', 1, 1.26).length, 1);
  assert.strictEqual(formationOffsets('line_horizontal', 4, 1.26).length, 4);
  assert.strictEqual(formationOffsets('line_vertical', 4, 1.26).length, 4);
  assert.strictEqual(formationOffsets('column', 7, 1.26).length, 7);
  assert.strictEqual(formationOffsets('standard', 10, 1.26).length, 10);
});

test('formationOffsets unknown formation falls back to cluster', () => {
  const a = formationOffsets('not_real', 6, 1.26);
  const b = formationOffsets('cluster', 6, 1.26);
  assert.deepStrictEqual(a, b);
});

test('FORMATIONS contains the five expected ids in order', () => {
  assert.deepStrictEqual(
    FORMATIONS.map(f => f.id),
    ['cluster', 'line_vertical', 'line_horizontal', 'column', 'standard'],
  );
});

test('formationOffsets handles n=0 gracefully', () => {
  assert.deepStrictEqual(formationOffsets('cluster', 0, 1.26), []);
  assert.deepStrictEqual(formationOffsets('line_horizontal', 0, 1.26), []);
  assert.deepStrictEqual(formationOffsets('column', 0, 1.26), []);
  assert.deepStrictEqual(formationOffsets('standard', 0, 1.26), []);
});
