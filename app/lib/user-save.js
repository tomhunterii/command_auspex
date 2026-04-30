// app/lib/user-save.js
//
// Single-file roster persistence at <app_data>/user-save.md (Phase 2A).
// Replaces the per-roster files at <app_data>/rosters/<slug>.md.
//
// File format — pure YAML (NOT frontmatter-delimited markdown). Despite
// the .md extension the body is a YAML document so a roster's body_md
// can contain arbitrary markdown (including '---' separators) without
// breaking the outer parser. The Captain confirmed humans don't edit
// this file directly; it's an app-managed save.
//
// Top-level shape:
//   schema_version: 1
//   rosters:
//     - slug: <unique slug>
//       name: <display name>
//       faction_slug: <slug>            # may be null
//       detachment_slug: <slug>         # may be null
//       points_cap: <int>               # may be null
//       units:                          # may be null; VOX-SCRIBE rosters
//         - name: ...                   # carry a structured unit array
//           ...                         # parsed from the import frontmatter
//       body_md: |                      # original roster markdown body
//         ## CAPTAIN (×1) [80]
//         - ...
//
// Each roster's body_md holds ONLY the markdown body, never the source
// file's frontmatter — metadata is promoted to top-level fields. The
// structured unit list (used by VOX-SCRIBE-imported rosters) is also
// promoted out of frontmatter into the dedicated `units` field; storing
// it inside body_md would round-trip-strip it. On load we synthesize a
// virtual `frontmatter` object (including `units` when present) so
// callers that expect the legacy { frontmatter: {...}, body_md: ... }
// shape keep working.
//
// Migration (one-shot, idempotent): if user-save.md is missing AND
// <app_data>/rosters/*.md exists, read each old roster, fold its
// frontmatter+body into a user-save entry, write user-save.md. The old
// rosters/ directory is left in place as a defensive backup — Phase 2A.2
// will offer a UI affordance to clean it up.

import { parseFrontmatter } from './yaml-frontmatter.js';
import { slugify } from './roster-parser.js';

const USER_SAVE_PATH = 'user-save.md';
const ROSTER_DIR = 'rosters';
const SCHEMA_VERSION = 1;

function ipc() {
  if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) {
    throw new Error('Tauri runtime not detected — user-save is desktop-only');
  }
  return window.__TAURI_INTERNALS__.invoke;
}

let yamlPromise = null;
async function loadYaml() {
  if (globalThis.jsyaml) return globalThis.jsyaml;
  if (!yamlPromise) yamlPromise = import('js-yaml').then(m => m.default ?? m);
  return yamlPromise;
}

async function readText(relPath) {
  return ipc()('user_read_text', { path: relPath });
}

async function writeText(relPath, contents) {
  return ipc()('user_write_text', { path: relPath, contents });
}

async function exists(relPath) {
  try {
    return await ipc()('user_file_exists', { path: relPath });
  } catch {
    return false;
  }
}

async function listDir(relPath) {
  try {
    return await ipc()('user_list_dir', { path: relPath });
  } catch {
    return [];
  }
}

function emptySave() {
  return { schema_version: SCHEMA_VERSION, rosters: [] };
}

function normalizeRoster(entry) {
  return {
    slug: String(entry?.slug ?? '').trim(),
    name: String(entry?.name ?? entry?.slug ?? ''),
    faction_slug: entry?.faction_slug ?? null,
    detachment_slug: entry?.detachment_slug ?? null,
    points_cap: entry?.points_cap ?? null,
    // Structured unit list from VOX-SCRIBE-shaped rosters. Stored as a
    // first-class field so the round-trip through user-save.md preserves
    // it — the body-stripped frontmatter approach used to discard it.
    units: Array.isArray(entry?.units) ? entry.units : null,
    body_md: entry?.body_md ?? '',
  };
}

/// Read user-save.md from app-data. Missing file returns an empty
/// schema-1 save (NOT an error) so callers can treat first-launch the
/// same as "no rosters yet."
export async function loadUserSave() {
  if (!(await exists(USER_SAVE_PATH))) return emptySave();
  let text;
  try {
    text = await readText(USER_SAVE_PATH);
  } catch {
    return emptySave();
  }
  const yaml = await loadYaml();
  let parsed;
  try {
    parsed = yaml.load(text);
  } catch {
    return emptySave();
  }
  if (!parsed || typeof parsed !== 'object') return emptySave();
  const rosters = Array.isArray(parsed.rosters) ? parsed.rosters.map(normalizeRoster) : [];
  return {
    schema_version: parsed.schema_version ?? SCHEMA_VERSION,
    rosters: rosters.filter(r => r.slug.length > 0),
  };
}

/// Serialize a save object back to user-save.md. Caller is responsible
/// for preserving slugs unique; this function does NOT dedupe.
export async function saveUserSave(save) {
  const yaml = await loadYaml();
  const out = {
    schema_version: save?.schema_version ?? SCHEMA_VERSION,
    rosters: (save?.rosters ?? []).map(normalizeRoster),
  };
  // lineWidth: -1 disables wrapping (keeps long ability text on one line);
  // noCompatMode lets js-yaml use literal block style for multi-line
  // body_md fields, which is what we want for readability if the user
  // ever opens the file.
  const text = yaml.dump(out, {
    lineWidth: -1,
    noCompatMode: true,
    quotingType: '"',
  });
  await writeText(USER_SAVE_PATH, text);
}

/// Read all <app_data>/rosters/*.md files, parse their frontmatter, and
/// fold them into a user-save shape. Used by the migration path.
async function readLegacyRosters() {
  const names = await listDir(ROSTER_DIR);
  const rosters = [];
  for (const name of names) {
    if (!name.endsWith('.md')) continue;
    const slug = name.slice(0, -3);
    let text;
    try {
      text = await readText(`${ROSTER_DIR}/${name}`);
    } catch {
      continue;
    }
    const fm = await parseFrontmatter(text);
    const body = stripFrontmatter(text);
    rosters.push({
      slug,
      name: fm?.list_name ?? slug,
      faction_slug: fm?.faction ? slugify(fm.faction) : null,
      detachment_slug: fm?.detachment ? slugify(fm.detachment) : null,
      points_cap: fm?.list_points ?? null,
      units: Array.isArray(fm?.units) ? fm.units : null,
      body_md: body,
    });
  }
  return rosters;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
function stripFrontmatter(text) {
  return text.replace(FRONTMATTER_RE, '').replace(/^\s*\n/, '');
}

/// One-shot migration: if user-save.md is absent but legacy roster
/// files exist, fold them. Idempotent — once user-save.md exists this
/// is a no-op. Returns the number of legacy rosters migrated (0 if
/// nothing to do).
export async function migrateLegacyRostersIfNeeded() {
  if (await exists(USER_SAVE_PATH)) return 0;
  const legacy = await readLegacyRosters();
  if (legacy.length === 0) {
    // Still write an empty save so subsequent loads short-circuit and
    // we never re-run migration on a roster-less app.
    await saveUserSave(emptySave());
    return 0;
  }
  await saveUserSave({ schema_version: SCHEMA_VERSION, rosters: legacy });
  return legacy.length;
}

/// Render a user-save entry back to the standard roster-markdown form
/// (YAML frontmatter + body) so the editor UI can present a single
/// editable text blob. The reverse of upsertRosterInUserSave's parse.
export function entryToRosterMarkdown(entry) {
  const e = normalizeRoster(entry);
  const fmLines = ['---'];
  fmLines.push(`list_name: ${yamlScalar(e.name)}`);
  if (e.faction_slug) fmLines.push(`faction: ${yamlScalar(e.faction_slug)}`);
  if (e.detachment_slug) fmLines.push(`detachment: ${yamlScalar(e.detachment_slug)}`);
  if (e.points_cap != null) fmLines.push(`list_points: ${e.points_cap}`);
  fmLines.push('---');
  return `${fmLines.join('\n')}\n\n${e.body_md}`;
}

// Wrap a string in double quotes when it would otherwise be ambiguous to
// YAML (leading/trailing space, contains : # @ etc.). Plain alphanum and
// slug-style strings emit without quotes for readability.
function yamlScalar(s) {
  const str = String(s ?? '');
  if (/^[A-Za-z0-9][A-Za-z0-9 _\-./]*$/.test(str)) return str;
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/// Reconstruct a roster in the legacy { frontmatter, body_md, ... }
/// shape that getRoster() callers expect. Re-emits a virtual frontmatter
/// from the entry's promoted fields so downstream code doesn't need to
/// know the user-save format exists.
export function rosterToLegacyShape(entry) {
  const e = normalizeRoster(entry);
  const frontmatter = {
    list_name: e.name,
    faction: e.faction_slug,
    detachment: e.detachment_slug,
    list_points: e.points_cap,
  };
  // VOX-SCRIBE rosters carry a structured units array. Surface it on the
  // synthetic frontmatter so loadRosterFile() finds it without needing to
  // re-parse body_md (which never held it — units lives on the entry).
  if (Array.isArray(e.units)) frontmatter.units = e.units;
  return {
    slug: e.slug,
    name: e.name,
    source_path: `user-save.md#${e.slug}`,
    body_md: e.body_md,
    frontmatter,
    faction_slug: e.faction_slug,
    detachment_slug: e.detachment_slug,
    points_cap: e.points_cap,
  };
}

/// Convenience: list all rosters from user-save in the same row shape
/// as the legacy listRosters(). Triggers migration on first call.
export async function listUserSaveRosters() {
  await migrateLegacyRostersIfNeeded();
  const save = await loadUserSave();
  return save.rosters.map(r => ({
    slug: r.slug,
    name: r.name,
    source_path: `user-save.md#${r.slug}`,
    faction_slug: r.faction_slug,
    points_cap: r.points_cap,
    origin: 'user-save',
  }));
}

/// Lookup a roster by slug. Returns null if not found.
export async function getUserSaveRoster(slug) {
  const save = await loadUserSave();
  const entry = save.rosters.find(r => r.slug === slug);
  return entry ? rosterToLegacyShape(entry) : null;
}

/// Insert-or-update a roster in user-save.md from raw markdown text.
/// Parses the markdown's frontmatter to populate metadata fields and
/// stores the body separately. Replaces any existing entry with the
/// same slug.
export async function upsertRosterInUserSave(slug, md) {
  const fm = await parseFrontmatter(md);
  const body = stripFrontmatter(md);
  await migrateLegacyRostersIfNeeded();
  const save = await loadUserSave();
  const idx = save.rosters.findIndex(r => r.slug === slug);
  // Preserve previously-stored structured units when the new markdown's
  // frontmatter doesn't carry a units: block. The editor-roster flow
  // re-emits frontmatter via entryToRosterMarkdown which (deliberately)
  // omits units; without this merge a hand-edit would silently strip the
  // VOX-SCRIBE-imported unit list.
  //
  // Precedence: incoming wins when present (so a fresh VOX-SCRIBE paste
  // updates the unit list); null/omitted preserves the prior. To CLEAR
  // a units list (e.g. converting a structured roster to a hand-edited
  // shell), the caller must pass an explicit empty array `units: []` —
  // null/omitted is "leave alone."
  const incomingUnits = Array.isArray(fm?.units) ? fm.units : null;
  const priorUnits = idx >= 0 && Array.isArray(save.rosters[idx]?.units)
    ? save.rosters[idx].units
    : null;
  const entry = {
    slug,
    name: fm?.list_name ?? slug,
    faction_slug: fm?.faction ? slugify(fm.faction) : null,
    detachment_slug: fm?.detachment ? slugify(fm.detachment) : null,
    points_cap: fm?.list_points ?? null,
    units: incomingUnits ?? priorUnits,
    body_md: body,
  };
  if (idx >= 0) save.rosters[idx] = entry;
  else save.rosters.push(entry);
  await saveUserSave(save);
}

/// Remove a roster from user-save.md by slug. Idempotent — a missing
/// slug is not an error.
export async function deleteRosterFromUserSave(slug) {
  await migrateLegacyRostersIfNeeded();
  const save = await loadUserSave();
  const next = save.rosters.filter(r => r.slug !== slug);
  if (next.length === save.rosters.length) return;
  await saveUserSave({ ...save, rosters: next });
}
