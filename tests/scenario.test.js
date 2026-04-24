import { test } from 'node:test';
import assert from 'node:assert';
import { buildScenario, serializeScenario, parseScenario } from '../app/lib/scenario.js';

test('buildScenario assembles a scenario from inputs', () => {
  const s = buildScenario({
    id: 'test',
    name: 'Test',
    missionPath: 'missions/purge-and-burn.md',
    defender: { rosterPath: 'ultramarines/rosters/x.md', owner: 'Tom' },
    attacker: { rosterPath: null, owner: null },
    placements: [],
  });
  assert.strictEqual(s.id, 'test');
  assert.strictEqual(s.mission, 'missions/purge-and-burn.md');
  assert.strictEqual(s.defender.roster, 'ultramarines/rosters/x.md');
});

test('serializeScenario produces valid YAML + markdown', async () => {
  const s = buildScenario({
    id: 'sample', name: 'Sample', missionPath: 'm.md',
    defender: { rosterPath: 'd.md', owner: 'A' },
    attacker: { rosterPath: null, owner: null },
    placements: [
      { unit_name: 'U1', role: 'defender', centerIn: [30.0, 22.5], orientation_deg: 0, placement: 'on_board' },
    ],
  });
  const md = serializeScenario(s);
  assert.match(md, /^---\n/);
  assert.match(md, /mission: "m\.md"/);
  assert.match(md, /U1/);
});

test('round-trip: serialize then parse equals original', async () => {
  const s1 = buildScenario({
    id: 'rt', name: 'Round Trip', missionPath: 'm.md',
    defender: { rosterPath: 'd.md', owner: 'A' },
    attacker: { rosterPath: 'a.md', owner: 'B' },
    placements: [
      { unit_name: 'Alpha', role: 'defender', centerIn: [10, 10], orientation_deg: 0, placement: 'on_board' },
      { unit_name: 'Beta', role: 'attacker', centerIn: [50, 40], orientation_deg: 90, placement: 'on_board' },
    ],
  });
  const md = serializeScenario(s1);
  const s2 = await parseScenario(md);
  assert.strictEqual(s2.id, s1.id);
  assert.strictEqual(s2.mission, s1.mission);
  assert.strictEqual(s2.board_state.defender.length, 1);
  assert.strictEqual(s2.board_state.attacker.length, 1);
});
