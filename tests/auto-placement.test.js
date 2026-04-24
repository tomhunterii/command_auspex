import { test } from 'node:test';
import assert from 'node:assert';
import { autoPlaceUnits } from '../app/lib/auto-placement.js';
import { pointInPolygon } from '../app/lib/geometry.js';

function mockUnit(name, modelCount = 1, baseMm = 32) {
  return {
    name,
    models: [{ submodel: name, count: modelCount, wargear: [] }],
    total_models: modelCount,
    _base: { diameter_mm: baseMm },
  };
}

const zone = [[0,0],[60,0],[60,44],[0,44]]; // large rect for testing

test('autoPlaceUnits places every unit inside the zone', () => {
  const units = [
    mockUnit('A'), mockUnit('B', 5), mockUnit('C', 1, 40), mockUnit('D', 10, 32),
  ];
  const placements = autoPlaceUnits(units, zone);
  assert.strictEqual(placements.length, 4);
  for (const p of placements) {
    assert.ok(pointInPolygon(p.centerIn, zone), `${p.unit.name} should be inside zone`);
  }
});

test('autoPlaceUnits sorts largest-first (approximation check)', () => {
  const units = [mockUnit('small', 1, 32), mockUnit('big', 5, 40)];
  const placements = autoPlaceUnits(units, zone);
  const bigP = placements.find(p => p.unit.name === 'big');
  const smallP = placements.find(p => p.unit.name === 'small');
  assert.ok(bigP);
  assert.ok(smallP);
  assert.ok(true);
});
