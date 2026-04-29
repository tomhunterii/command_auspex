// app/lib/catalogue.js
//
// Query API over the bundled SQLite catalogue.db. Calls
// window.__TAURI_INTERNALS__.invoke directly so we don't need to import
// any @tauri-apps/* JS packages from a no-bundler frontend.
//
// Conceptually this replaces the FSA-walking patterns in command-auspex.html.
// What was `listDir(repo, 'rosters').filter(*.md)` is now
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
  let grants = null;
  if (u.grants_json) {
    try { grants = JSON.parse(u.grants_json); } catch {}
  }
  let canJoin = [];
  if (u.can_join_json) {
    try { canJoin = JSON.parse(u.can_join_json); } catch {}
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
    grants,
    can_join: canJoin,
    enables_co_leader: u.enables_co_leader ?? null,
  };
}

// Reshape a getUnit() result into the structured input shapes the sim
// engine (app/lib/sim/combat.js) expects. `kind` filters the weapons
// list ('ranged' | 'melee' | 'all').
//
// REPLICATION POLICY:
//   • If `equippedCounts` is provided (Map<weapon-name-lowercase-trim, count>),
//     each weapon row is replicated by that count. Drives faithful per-submodel
//     allocation for fixed-loadout heroes (Wardens of Ultramar) where every
//     character carries DIFFERENT gear — only the characters who carry that
//     weapon contribute attacks.
//   • Otherwise each weapon row is replicated by `attacker_model_count`,
//     suitable for uniform squads where every model carries the same loadout.
//
// ATTACKER-SIDE LEADERS:
//   `attachedLeader` (optional) is a single getUnit() result for a leader.
//   `attachedLeaders` (optional) accepts either bare getUnit() results
//   (legacy — uses leader's loadouts[0].model_count) OR
//   `{ unit, equippedCounts }` wrappers (new — uses per-submodel allocation
//   for the leader). Mix is fine. Each leader's weapons are appended to the
//   attacker's weapon pool. If both `attachedLeader` and `attachedLeaders`
//   are supplied, `attachedLeaders` takes precedence.
//
// DEFENDER-SIDE LEADER:
//   `defenderLeader` (optional) — `{ unit: getUnit-result }`. When
//   supplied, the returned defender shape carries a populated `leader`
//   sub-object so the combat engine can route PRECISION attacks past
//   the bodyguard pool (Look Out, Sir bypass). The defender's keyword
//   list becomes the UNION of bodyguard + leader keywords so Anti-X
//   keywords like ANTI-CHARACTER fire correctly against the unit.
export function buildSimInputs(unit, opts = {}) {
  if (!unit) return null;
  const {
    kind = 'ranged',
    model_count = 1,
    attacker_model_count = 1,
    attachedLeader = null,
    attachedLeaders = null,
    equippedCounts = null,
    defenderLeader = null,
  } = opts;
  const rawLeaders = Array.isArray(attachedLeaders) && attachedLeaders.length
    ? attachedLeaders.filter(Boolean)
    : (attachedLeader ? [attachedLeader] : []);
  // Normalise legacy bare-unit entries into the wrapped shape.
  const leadersList = rawLeaders.map(entry =>
    entry && typeof entry === 'object' && 'unit' in entry
      ? entry
      : { unit: entry, equippedCounts: null });

  // Equipped-count lookup with two fallback layers, applied to handle the
  // two ways a catalogue weapon name can diverge from the roster wargear
  // name for the same physical weapon:
  //
  //   1. Profile suffix — catalogue stores multi-profile weapons as
  //      separate rows ("Foo – strike", "Foo – sweep"); rosters list the
  //      base weapon ("Foo"). Stripping the suffix surfaces the base name.
  //
  //   2. Parenthetical — catalogue annotates weapons with characteristics
  //      like "Monstrous bonesword and lash whip (twin-linked)"; rosters
  //      drop the annotation. Stripping " (...)" surfaces the base name.
  //
  // Order: exact match wins; then strip parens; then strip profile; then
  // strip both. Equipping "Foo" once on the roster makes every catalogue
  // row whose canonical-base equals "foo" eligible (with the melee /
  // overcharge filters narrowing to a single profile per turn).
  const PROFILE_SUFFIX_RE = /\s+[–—-]\s+\w+(?:\s+\w+)?\s*$/;
  const PAREN_SUFFIX_RE   = /\s*\([^)]*\)\s*$/;
  function lookupCount(ec, fullKey) {
    if (ec.has(fullKey)) return ec.get(fullKey);
    const noParens = fullKey.replace(PAREN_SUFFIX_RE, '').trim();
    if (noParens !== fullKey && ec.has(noParens)) return ec.get(noParens);
    const noProfile = noParens.replace(PROFILE_SUFFIX_RE, '').trim();
    if (noProfile !== noParens && ec.has(noProfile)) return ec.get(noProfile);
    return 0;
  }

  function replicate(weapons, ec, fallbackCount) {
    const out = [];
    for (const w of weapons) {
      const key = String(w.name).toLowerCase().trim();
      const count = ec ? lookupCount(ec, key) : fallbackCount;
      for (let i = 0; i < count; i++) {
        out.push({
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
    return out;
  }

  const filteredWeapons = (unit.weapons ?? []).filter(w =>
    kind === 'all' ? true : w.kind === kind
  );
  const weapons = replicate(filteredWeapons, equippedCounts, attacker_model_count);

  for (const { unit: leader, equippedCounts: lec } of leadersList) {
    if (!leader) continue;
    const leaderWeapons = (leader.weapons ?? []).filter(w =>
      kind === 'all' ? true : w.kind === kind
    );
    const fallbackCount = leader.loadouts?.[0]?.model_count ?? 1;
    weapons.push(...replicate(leaderWeapons, lec, fallbackCount));
  }

  const attacker = { weapons, model_count: attacker_model_count };
  const bodyguardKeywords = (unit.keywords ?? []).map(k => String(k.keyword).toUpperCase());

  // Defender-side leader: build the optional `leader` sub-object the combat
  // engine looks at for Look Out, Sir / PRECISION routing. Stats default to
  // the bodyguard's where the leader unit doesn't override (toughness most
  // commonly matches; wounds and invuln usually differ).
  let leaderSubObject;
  let leaderKeywords = [];
  if (defenderLeader && defenderLeader.unit) {
    const L = defenderLeader.unit;
    leaderKeywords = (L.keywords ?? []).map(k => String(k.keyword).toUpperCase());
    leaderSubObject = {
      toughness:        L.profile?.T  ?? unit.profile?.T,
      save:             L.profile?.Sv ?? unit.profile?.Sv,
      invulnerable:     L.profile?.InvSv ?? null,
      wounds_per_model: L.profile?.W  ?? 1,
      keywords:         leaderKeywords,
    };
  }

  const defender = {
    toughness: unit.profile?.T ?? 4,
    save: unit.profile?.Sv ?? '3+',
    invulnerable: unit.profile?.InvSv ?? null,
    wounds_per_model: unit.profile?.W ?? 1,
    model_count,
    // Anti-X consults the unit's keyword list as a whole; merge in the
    // leader's keywords so e.g. ANTI-CHARACTER fires against an Attached
    // Unit even when the precision routing has not yet reached the leader.
    keywords: leaderSubObject
      ? [...new Set([...bodyguardKeywords, ...leaderKeywords])]
      : bodyguardKeywords,
    leader: leaderSubObject,
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
