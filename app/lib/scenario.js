// app/lib/scenario.js
// Build, serialise, and parse tactical scenario markdown files.

import { parseFrontmatter } from './yaml-frontmatter.js';

// Escape a string for a YAML double-quoted scalar. Mirrors the Python
// _yaml_str in scripts/parse_gw_roster.py: backslash first, then quote.
function yamlString(s) {
  if (s === null || s === undefined) return 'null';
  const escaped = String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function buildScenario({ id, name, missionPath, defender, attacker, placements, attachments }) {
  const now = new Date().toISOString();
  const state = { defender: [], attacker: [] };

  for (const p of placements) {
    state[p.role].push({
      unit_ref: p.unit_name,
      instance_id: p._instanceId ?? null,
      placement: p.placement ?? 'on_board',
      position: p.centerIn,
      orientation_deg: p.orientation_deg ?? 0,
      formation: p.formation ?? 'cluster',
    });
  }

  // attachments: { defender: Map|object<squadInstanceId, leaderInstanceId[]>, ... }
  // Normalise to plain objects with array values for serialization.
  const norm = (m) => {
    const out = {};
    if (!m) return out;
    if (m instanceof Map) {
      for (const [k, v] of m) out[k] = Array.isArray(v) ? v : [v];
    } else {
      for (const [k, v] of Object.entries(m)) out[k] = Array.isArray(v) ? v : [v];
    }
    return out;
  };

  return {
    id, name,
    created: now, last_modified: now,
    mission: missionPath,
    defender: { roster: defender.rosterPath, owner: defender.owner },
    attacker: { roster: attacker.rosterPath, owner: attacker.owner },
    attachments: {
      defender: norm(attachments?.defender),
      attacker: norm(attachments?.attacker),
    },
    board_state: state,
  };
}

export function serializeScenario(s) {
  let out = '---\n';
  out += `id: ${yamlString(s.id)}\n`;
  out += `name: ${yamlString(s.name)}\n`;
  out += `created: ${yamlString(s.created)}\n`;
  out += `last_modified: ${yamlString(s.last_modified)}\n`;
  out += `mission: ${yamlString(s.mission)}\n`;
  out += `defender:\n  roster: ${yamlString(s.defender.roster)}\n  owner: ${yamlString(s.defender.owner)}\n`;
  out += `attacker:\n  roster: ${yamlString(s.attacker.roster)}\n  owner: ${yamlString(s.attacker.owner)}\n`;
  out += `attachments:\n`;
  for (const role of ['defender', 'attacker']) {
    const map = s.attachments?.[role] ?? {};
    const keys = Object.keys(map);
    if (keys.length === 0) {
      out += `  ${role}: {}\n`;
      continue;
    }
    out += `  ${role}:\n`;
    for (const k of keys) {
      const leaders = (map[k] ?? []).map(l => yamlString(l)).join(', ');
      out += `    ${yamlString(k)}: [${leaders}]\n`;
    }
  }
  out += `board_state:\n`;
  for (const role of ['defender', 'attacker']) {
    out += `  ${role}:\n`;
    for (const u of s.board_state[role]) {
      out += `    - unit_ref: ${yamlString(u.unit_ref)}\n`;
      out += `      instance_id: ${yamlString(u.instance_id)}\n`;
      out += `      placement: ${yamlString(u.placement)}\n`;
      out += `      position: [${u.position[0]}, ${u.position[1]}]\n`;
      out += `      orientation_deg: ${u.orientation_deg}\n`;
      out += `      formation: ${yamlString(u.formation ?? 'cluster')}\n`;
    }
  }
  out += '---\n\n';
  out += `# ${s.name}\n\nScenario for mission \`${s.mission}\`.\n`;
  return out;
}

export async function parseScenario(text) {
  return parseFrontmatter(text);
}
