import { test } from 'node:test';
import assert from 'node:assert';
import { pointInPolygon, polygonBounds } from '../app/lib/geometry.js';

test('pointInPolygon: point inside a square', () => {
  const square = [[0,0],[10,0],[10,10],[0,10]];
  assert.strictEqual(pointInPolygon([5, 5], square), true);
});

test('pointInPolygon: point outside a square', () => {
  const square = [[0,0],[10,0],[10,10],[0,10]];
  assert.strictEqual(pointInPolygon([15, 5], square), false);
});

test('pointInPolygon: handles chevron band (Purge and Burn defender zone)', () => {
  const band = [[60,25],[30,12],[0,25],[0,34],[30,21],[60,34]];
  assert.strictEqual(pointInPolygon([30, 20], band), true);    // between apexes
  assert.strictEqual(pointInPolygon([0.5, 29], band), true);   // near left edge
  assert.strictEqual(pointInPolygon([30, 5], band), false);    // above the top apex
  assert.strictEqual(pointInPolygon([30, 40], band), false);   // below the bottom apex
});

test('polygonBounds returns min/max x and y', () => {
  const band = [[60,25],[30,12],[0,25],[0,34],[30,21],[60,34]];
  const b = polygonBounds(band);
  assert.deepStrictEqual(b, { minX: 0, minY: 12, maxX: 60, maxY: 34 });
});
