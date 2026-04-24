import { test } from 'node:test';
import assert from 'node:assert';
import { baseDiameterPx, clusterOffsets, INCH_PX, MM_PER_INCH } from '../app/lib/base-geometry.js';

test('baseDiameterPx converts mm to pixels at 10px/inch', () => {
  // 32mm base ≈ 1.260" ≈ 12.60px
  assert.ok(Math.abs(baseDiameterPx(32) - 12.598) < 0.01);
  assert.ok(Math.abs(baseDiameterPx(40) - 15.748) < 0.01);
});

test('clusterOffsets places 1 model at origin', () => {
  const offsets = clusterOffsets(1, 12.6);
  assert.deepStrictEqual(offsets, [[0, 0]]);
});

test('clusterOffsets places 5 models in a hex cluster (1 + 4 around)', () => {
  const offsets = clusterOffsets(5, 12.6);
  assert.strictEqual(offsets.length, 5);
  assert.deepStrictEqual(offsets[0], [0, 0]);
});

test('clusterOffsets places 6 models in hex (1 center + 6 periphery) returning 6', () => {
  const offsets = clusterOffsets(6, 12.6);
  assert.strictEqual(offsets.length, 6);
});
