// app/lib/scenario.js
// Build, serialise, and parse tactical scenario markdown files.

import { parseFrontmatter } from './yaml-frontmatter.js';

export function buildScenario({ id, name, missionPath, defender, attacker, placements }) {
  const now = new Date().toISOString();
  const state = { defender: [], attacker: [] };

  for (const p of placements) {
    state[p.role].push({
      unit_ref: p.unit_name,
      placement: p.placement ?? 'on_board',
      position: p.centerIn,
      orientation_deg: p.orientation_deg ?? 0,
    });
  }

  return {
    id, name,
    created: now, last_modified: now,
    mission: missionPath,
    defender: { roster: defender.rosterPath, owner: defender.owner },
    attacker: { roster: attacker.rosterPath, owner: attacker.owner },
    board_state: state,
  };
}

export function serializeScenario(s) {
  let out = '---\n';
  out += `id: "${s.id}"\n`;
  out += `name: "${s.name}"\n`;
  out += `created: "${s.created}"\n`;
  out += `last_modified: "${s.last_modified}"\n`;
  out += `mission: "${s.mission}"\n`;
  out += `defender:\n  roster: ${s.defender.roster ? `"${s.defender.roster}"` : 'null'}\n  owner: ${s.defender.owner ? `"${s.defender.owner}"` : 'null'}\n`;
  out += `attacker:\n  roster: ${s.attacker.roster ? `"${s.attacker.roster}"` : 'null'}\n  owner: ${s.attacker.owner ? `"${s.attacker.owner}"` : 'null'}\n`;
  out += `board_state:\n`;
  for (const role of ['defender', 'attacker']) {
    out += `  ${role}:\n`;
    for (const u of s.board_state[role]) {
      out += `    - unit_ref: "${u.unit_ref}"\n`;
      out += `      placement: ${u.placement}\n`;
      out += `      position: [${u.position[0]}, ${u.position[1]}]\n`;
      out += `      orientation_deg: ${u.orientation_deg}\n`;
    }
  }
  out += '---\n\n';
  out += `# ${s.name}\n\nScenario for mission \`${s.mission}\`.\n`;
  return out;
}

export async function parseScenario(text) {
  return parseFrontmatter(text);
}
