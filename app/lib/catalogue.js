// app/lib/catalogue.js
//
// Query API over the bundled SQLite catalogue.db. Calls
// window.__TAURI_INTERNALS__.invoke directly so we don't need to import
// any @tauri-apps/* JS packages from a no-bundler frontend.
//
// Conceptually this replaces the FSA-walking patterns in command-auspex.html.
// What was `listDir(repo, 'ultramarines/rosters').filter(*.md)` is now
// `listRosters()`. What was `readTextFile(repo, 'datasheets/.../foo.md')`
// followed by `parseDatasheet(text)` is now `getUnit('foo')`.

import { parseKeywords } from './sim/keywords.js';

const BASE_DIRECTORY_RESOURCE = 11; // matches @tauri-apps/api/path BaseDirectory.Resource

let dbHandle = null;

function ipc() {
  if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) {
    throw new Error('Tauri runtime not detected — catalogue is desktop-only for milestone 0.1');
  }
  return window.__TAURI_INTERNALS__.invoke;
}

// Opens the bundled catalogue. The Rust side (src-tauri/src/main.rs setup())
// copies the read-only bundled catalogue.db into BaseDirectory::App on every
// launch; plugin-sql then resolves the simple relative path itself.
export async function openCatalogue() {
  const invoke = ipc();
  dbHandle = await invoke('plugin:sql|load', { db: 'sqlite:catalogue.db' });
  const meta = await catalogueMeta();
  return { handle: dbHandle, name: 'command-auspex', meta };
}

async function select(query, values = []) {
  if (!dbHandle) throw new Error('catalogue not loaded — call openCatalogue() first');
  return ipc()('plugin:sql|select', { db: dbHandle, query, values });
}

export async function catalogueMeta() {
  const rows = await select('SELECT key, value FROM catalogue_meta');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export async function listFactions() {
  return select('SELECT id, slug, name FROM factions ORDER BY name');
}

// Filtered unit list. All filter params optional.
//   factionSlug — limit to one faction
//   maxPoints   — only units with at least one loadout ≤ this value
//   keyword     — uppercase keyword the unit must carry
export async function listUnits({ factionSlug = null, maxPoints = null, keyword = null } = {}) {
  let q = `
    SELECT u.id, u.slug, u.name, u.epic_hero, u.battleline, u.is_character,
           u.base_shape, u.base_diameter_mm, u.base_length_mm, u.base_width_mm,
           u.movement, u.toughness, u.save, u.invulnerable_save, u.wounds,
           u.leadership, u.oc, u.max_range_in, u.enriched,
           f.slug AS faction_slug
    FROM units u
    JOIN factions f ON f.id = u.faction_id
  `;
  const conds = [];
  const vals = [];
  if (factionSlug) {
    vals.push(factionSlug);
    conds.push(`f.slug = $${vals.length}`);
  }
  if (maxPoints !== null) {
    vals.push(maxPoints);
    conds.push(`u.id IN (SELECT unit_id FROM unit_loadouts WHERE points <= $${vals.length})`);
  }
  if (keyword) {
    vals.push(String(keyword).toUpperCase());
    conds.push(`u.id IN (SELECT unit_id FROM unit_keywords WHERE keyword = $${vals.length})`);
  }
  if (conds.length) q += ' WHERE ' + conds.join(' AND ');
  q += ' ORDER BY u.name';
  return select(q, vals);
}

// Full unit row + nested loadouts, keywords, weapons, led_by list. Returns
// null if the slug isn't in the catalogue.
export async function getUnit(slug) {
  const rows = await select(
    `SELECT u.*, f.slug AS faction_slug
     FROM units u JOIN factions f ON f.id = u.faction_id
     WHERE u.slug = $1 LIMIT 1`,
    [slug],
  );
  if (!rows[0]) return null;
  const u = rows[0];
  const [loadouts, keywords, weapons, ledBy] = await Promise.all([
    select('SELECT model_count, points, is_default FROM unit_loadouts WHERE unit_id = $1 ORDER BY model_count', [u.id]),
    select('SELECT keyword, is_faction FROM unit_keywords WHERE unit_id = $1', [u.id]),
    select('SELECT kind, name, range_in, attacks, skill, strength, ap, damage, keywords FROM weapons WHERE unit_id = $1', [u.id]),
    select('SELECT leader_slug FROM unit_led_by WHERE unit_id = $1', [u.id]),
  ]);
  // Reshape per_model_bases_json back into the structure the existing
  // renderer expects on `base.per_model`.
  const base = {
    shape: u.base_shape,
    diameter_mm: u.base_diameter_mm,
    length_mm: u.base_length_mm,
    width_mm: u.base_width_mm,
    flight_stem: false,
  };
  if (u.per_model_bases_json) {
    try { base.per_model = JSON.parse(u.per_model_bases_json); } catch {}
  }
  return {
    slug: u.slug,
    name: u.name,
    faction_slug: u.faction_slug,
    epic_hero: !!u.epic_hero,
    battleline: !!u.battleline,
    is_character: !!u.is_character,
    profile: {
      M: u.movement, T: u.toughness, Sv: u.save, InvSv: u.invulnerable_save,
      W: u.wounds, Ld: u.leadership, OC: u.oc,
    },
    base,
    max_range_in: u.max_range_in,
    ranges_in: u.ranges_in_json ? JSON.parse(u.ranges_in_json) : [],
    loadouts,
    keywords,
    weapons,
    led_by: ledBy.map(r => r.leader_slug),
  };
}

// Reshape a getUnit() result into the structured input shapes the sim
// engine (app/lib/sim/combat.js) expects. `kind` filters the weapons
// list ('ranged' | 'melee' | 'all').
// `attachedLeader` (optional) is a full getUnit() result for a leader that
// has been attached to this unit on the map. Their weapons are appended to
// the attacker's weapon pool (1 copy each, representing the leader's single
// model). The defender model count is not affected by the leader attachment
// (the squad's own model count is passed in separately).
export function buildSimInputs(unit, opts = {}) {
  if (!unit) return null;
  const { kind = 'ranged', model_count = 1, attacker_model_count = 1, attachedLeader = null } = opts;
  const filteredWeapons = (unit.weapons ?? []).filter(w =>
    kind === 'all' ? true : w.kind === kind
  );
  // Each weapon's stat row represents ONE model's allocation. To simulate
  // a squad of N models, multiply each weapon's attack count by N. We do
  // this by wrapping the original attacks expression in `(N)*(...)`. The
  // dice parser doesn't support multiplication; instead emit a synthetic
  // expression that runs N copies of the same weapon (preserves dice
  // variance).
  // For now we keep it simple: split each weapon into N copies. The sim
  // engine doesn't care if there are repeated weapon entries.
  const weapons = [];
  for (const w of filteredWeapons) {
    for (let i = 0; i < attacker_model_count; i++) {
      weapons.push({
        name: w.name,
        kind: w.kind,
        range_in: w.range_in,
        attacks: w.attacks,
        skill: w.skill,
        strength: w.strength,
        ap: w.ap,
        damage: w.damage,
        abilities: parseKeywords(w.keywords),
      });
    }
  }
  // Append leader weapons — 1 copy per leader model (leaders are typically
  // single-model; use model_count_default from loadouts if available, else 1).
  if (attachedLeader) {
    const leaderModelCount = attachedLeader.loadouts?.[0]?.model_count ?? 1;
    const leaderWeapons = (attachedLeader.weapons ?? []).filter(w =>
      kind === 'all' ? true : w.kind === kind
    );
    for (const w of leaderWeapons) {
      for (let i = 0; i < leaderModelCount; i++) {
        weapons.push({
          name: w.name,
          kind: w.kind,
          range_in: w.range_in,
          attacks: w.attacks,
          skill: w.skill,
          strength: w.strength,
          ap: w.ap,
          damage: w.damage,
          abilities: parseKeywords(w.keywords),
        });
      }
    }
  }
  const attacker = { weapons, model_count: attacker_model_count };
  const defenderKeywords = (unit.keywords ?? []).map(k => String(k.keyword).toUpperCase());
  const defender = {
    toughness: unit.profile?.T ?? 4,
    save: unit.profile?.Sv ?? '3+',
    invulnerable: unit.profile?.InvSv ?? null,
    wounds_per_model: unit.profile?.W ?? 1,
    model_count,
    keywords: defenderKeywords,
  };
  return { attacker, defender };
}

export async function listMissions() {
  return select('SELECT slug, name FROM missions ORDER BY name');
}

export async function getMission(slug) {
  const rows = await select(
    'SELECT slug, name, source_path, body_md, frontmatter_json FROM missions WHERE slug = $1 LIMIT 1',
    [slug],
  );
  if (!rows[0]) return null;
  const m = rows[0];
  return {
    slug: m.slug,
    name: m.name,
    source_path: m.source_path,
    body_md: m.body_md,
    frontmatter: m.frontmatter_json ? JSON.parse(m.frontmatter_json) : null,
  };
}

export async function listRosters() {
  return select('SELECT slug, name, faction_slug, points_cap FROM rosters ORDER BY name');
}

export async function getRoster(slug) {
  const rows = await select(
    'SELECT slug, name, source_path, body_md, frontmatter_json, faction_slug, detachment_slug, points_cap FROM rosters WHERE slug = $1 LIMIT 1',
    [slug],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    slug: r.slug,
    name: r.name,
    source_path: r.source_path,
    body_md: r.body_md,
    frontmatter: r.frontmatter_json ? JSON.parse(r.frontmatter_json) : null,
    faction_slug: r.faction_slug,
    detachment_slug: r.detachment_slug,
    points_cap: r.points_cap,
  };
}
