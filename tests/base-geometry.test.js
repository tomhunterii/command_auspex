import { test } from 'node:test';
import assert from 'node:assert';
import { baseDiameterPx, clusterOffsets, INCH_PX, MM_PER_INCH } from '../app/lib/base-geometry.js';

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
