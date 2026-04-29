import { test } from 'node:test';
import assert from 'node:assert';
import { buildScenario, serializeScenario, parseScenario } from '../app/lib/scenario.js';

test('buildScenario assembles a scenario from inputs', () => {
  const s = buildScenario({
    id: 'test',
    name: 'Test',
    missionPath: 'missions/purge-and-burn.md',
    defender: { rosterPath: 'rosters/x.md', owner: 'Tom' },
    attacker: { rosterPath: null, owner: null },
    placements: [],
  });
  assert.strictEqual(s.id, 'test');
  assert.strictEqual(s.mission, 'missions/purge-and-burn.md');
  assert.strictEqual(s.defender.roster, 'rosters/x.md');
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

test('serializeScenario escapes double quotes in string scalars', async () => {
  const s = buildScenario({
    id: 'quote-test',
    name: 'Battle of "Fort Glory"',
    missionPath: 'm.md',
    defender: { rosterPath: 'd.md', owner: 'Sgt. "Ironhand" Valerius' },
    attacker: { rosterPath: 'a.md', owner: 'B' },
    placements: [
      { unit_name: 'Brother "Cassius"', role: 'defender', centerIn: [10, 10], orientation_deg: 0, placement: 'on_board' },
    ],
  });
  const md = serializeScenario(s);
  // Must be parseable despite the quotes in the input
  const parsed = await parseScenario(md);
  assert.strictEqual(parsed.name, 'Battle of "Fort Glory"');
  assert.strictEqual(parsed.defender.owner, 'Sgt. "Ironhand" Valerius');
  assert.strictEqual(parsed.board_state.defender[0].unit_ref, 'Brother "Cassius"');
});

test('serializeScenario escapes backslashes in string scalars', async () => {
  const s = buildScenario({
    id: 'bs-test',
    name: 'C:\\path\\battle',
    missionPath: 'm.md',
    defender: { rosterPath: 'd.md', owner: 'A' },
    attacker: { rosterPath: 'a.md', owner: 'B' },
    placements: [],
  });
  const md = serializeScenario(s);
  const parsed = await parseScenario(md);
  assert.strictEqual(parsed.name, 'C:\\path\\battle');
});

test('serializeScenario emits null for missing roster/owner rather than ""', async () => {
  const s = buildScenario({
    id: 'null-test', name: 'Null Test', missionPath: 'm.md',
    defender: { rosterPath: 'd.md', owner: 'A' },
    attacker: { rosterPath: null, owner: null },
    placements: [],
  });
  const md = serializeScenario(s);
  const parsed = await parseScenario(md);
  assert.strictEqual(parsed.attacker.roster, null);
  assert.strictEqual(parsed.attacker.owner, null);
});

test('attachments round-trip from Map and from plain object', async () => {
  const defenderMap = new Map([['intercessor-squad:0', ['captain-titus:0']]]);
  const attackerObj = { 'aggressor-squad:0': ['captain:0', 'lieutenant:0'] };
  const s = buildScenario({
    id: 'att', name: 'Att', missionPath: 'm.md',
    defender: { rosterPath: 'd.md', owner: 'A' },
    attacker: { rosterPath: 'a.md', owner: 'B' },
    placements: [],
    attachments: { defender: defenderMap, attacker: attackerObj },
  });
  const md = serializeScenario(s);
  const parsed = await parseScenario(md);
  assert.deepStrictEqual(parsed.attachments.defender, { 'intercessor-squad:0': ['captain-titus:0'] });
  assert.deepStrictEqual(parsed.attachments.attacker, { 'aggressor-squad:0': ['captain:0', 'lieutenant:0'] });
});

test('placements carry instance_id through round-trip', async () => {
  const s = buildScenario({
    id: 'iid', name: 'IID', missionPath: 'm.md',
    defender: { rosterPath: 'd.md', owner: 'A' },
    attacker: { rosterPath: 'a.md', owner: 'B' },
    placements: [
      { unit_name: 'Hormagaunts', _instanceId: 'hormagaunts:0', role: 'defender', centerIn: [10, 10], orientation_deg: 0, placement: 'on_board', formation: 'cluster' },
      { unit_name: 'Hormagaunts', _instanceId: 'hormagaunts:1', role: 'defender', centerIn: [20, 10], orientation_deg: 0, placement: 'on_board', formation: 'cluster' },
    ],
  });
  const md = serializeScenario(s);
  const parsed = await parseScenario(md);
  assert.strictEqual(parsed.board_state.defender[0].instance_id, 'hormagaunts:0');
  assert.strictEqual(parsed.board_state.defender[1].instance_id, 'hormagaunts:1');
});

test('empty attachments serialise as empty maps', async () => {
  const s = buildScenario({
    id: 'empty', name: 'Empty', missionPath: 'm.md',
    defender: { rosterPath: 'd.md', owner: 'A' },
    attacker: { rosterPath: 'a.md', owner: 'B' },
    placements: [],
  });
  const md = serializeScenario(s);
  const parsed = await parseScenario(md);
  assert.deepStrictEqual(parsed.attachments.defender, {});
  assert.deepStrictEqual(parsed.attachments.attacker, {});
});
