#!/usr/bin/env node
// scripts/build-catalogue.js
//
// Walks every datasheet markdown file under datasheets/<faction>/units/,
// parses frontmatter (when present) and body sections, and emits a single
// SQLite catalogue.db at src-tauri/resources/catalogue.db. The Tauri build
// bundles that database; the runtime queries it via tauri-plugin-sql.
//
// Uses Node's built-in node:sqlite (Node 22+). No native compile step,
// no extra dependencies.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { parseFrontmatter } from '../app/lib/yaml-frontmatter.js';
import { parseDatasheet } from '../app/lib/datasheet-parser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const DATASHEETS = join(REPO, 'datasheets');
const OUT_DIR = join(REPO, 'src-tauri', 'resources');
const OUT_DB = join(OUT_DIR, 'catalogue.db');

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE factions (
  id   INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE units (
  id                  INTEGER PRIMARY KEY,
  faction_id          INTEGER NOT NULL REFERENCES factions(id),
  slug                TEXT NOT NULL,
  name                TEXT NOT NULL,
  epic_hero           INTEGER NOT NULL DEFAULT 0,
  battleline          INTEGER NOT NULL DEFAULT 0,
  is_character        INTEGER NOT NULL DEFAULT 0,
  base_shape          TEXT,
  base_diameter_mm    REAL,
  base_length_mm      REAL,
  base_width_mm       REAL,
  per_model_bases_json TEXT,
  movement            TEXT,
  toughness           INTEGER,
  save                TEXT,
  invulnerable_save   TEXT,
  wounds              INTEGER,
  leadership          TEXT,
  oc                  INTEGER,
  max_range_in        INTEGER,
  ranges_in_json      TEXT,
  grants_json         TEXT,
  source_path         TEXT NOT NULL,
  enriched            INTEGER NOT NULL DEFAULT 0,
  UNIQUE(faction_id, slug)
);
CREATE INDEX idx_units_faction ON units(faction_id);

CREATE TABLE unit_loadouts (
  id          INTEGER PRIMARY KEY,
  unit_id     INTEGER NOT NULL REFERENCES units(id),
  model_count INTEGER NOT NULL,
  points      INTEGER NOT NULL,
  is_default  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_loadouts_points ON unit_loadouts(points);
CREATE INDEX idx_loadouts_unit   ON unit_loadouts(unit_id);

CREATE TABLE unit_keywords (
  unit_id    INTEGER NOT NULL REFERENCES units(id),
  keyword    TEXT NOT NULL,
  is_faction INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (unit_id, keyword)
);
CREATE INDEX idx_keywords_keyword ON unit_keywords(keyword);

CREATE TABLE unit_led_by (
  unit_id        INTEGER NOT NULL REFERENCES units(id),
  leader_slug    TEXT NOT NULL,
  PRIMARY KEY (unit_id, leader_slug)
);
CREATE INDEX idx_led_by_leader ON unit_led_by(leader_slug);

CREATE TABLE weapons (
  id        INTEGER PRIMARY KEY,
  unit_id   INTEGER NOT NULL REFERENCES units(id),
  kind      TEXT NOT NULL,
  name      TEXT NOT NULL,
  range_in  INTEGER NOT NULL DEFAULT 0,
  attacks   TEXT NOT NULL,
  skill     TEXT NOT NULL,
  strength  INTEGER NOT NULL,
  ap        INTEGER NOT NULL,
  damage    TEXT NOT NULL,
  keywords  TEXT
);
CREATE INDEX idx_weapons_unit ON weapons(unit_id);

CREATE TABLE missions (
  id            INTEGER PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  source_path   TEXT NOT NULL,
  body_md       TEXT NOT NULL,
  frontmatter_json TEXT
);

CREATE TABLE rosters (
  id              INTEGER PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  source_path     TEXT NOT NULL,
  body_md         TEXT NOT NULL,
  frontmatter_json TEXT,
  faction_slug    TEXT,
  detachment_slug TEXT,
  points_cap      INTEGER
);

CREATE TABLE catalogue_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function listMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isFile() && name.endsWith('.md')) out.push(path);
  }
  return out;
}

function listSubdirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map(n => join(dir, n))
    .filter(p => statSync(p).isDirectory());
}

function extractSection(text, heading) {
  const parts = text.split(/^## /m);
  for (const p of parts) {
    if (p.startsWith(heading + '\n') || p.startsWith(heading + '\r')) {
      const nl = p.indexOf('\n');
      return p.slice(nl + 1).trim();
    }
  }
  return null;
}

function parseWeaponsTable(body, kind) {
  const section = extractSection(body, kind === 'ranged' ? 'Ranged Weapons' : 'Melee Weapons');
  if (!section) return [];
  const rows = [];
  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (trimmed.includes('---')) continue;
    const cells = trimmed.split('|').map(s => s.trim()).filter(Boolean);
    if (cells.length < 7) continue;
    if (/^Weapon$/i.test(cells[0])) continue; // header
    const [name, rangeRaw, attacks, skill, strRaw, apRaw, damage, ...rest] = cells;
    const keywords = rest.join(' | ').replace(/^—\s*$/, '').trim() || null;
    const range_in = kind === 'melee' ? 0 : parseInt(String(rangeRaw).replace(/[^0-9]/g, ''), 10) || 0;
    rows.push({
      name,
      range_in,
      attacks,
      skill,
      strength: parseInt(strRaw, 10) || 0,
      ap: parseInt(apRaw, 10) || 0,
      damage,
      keywords,
    });
  }
  return rows;
}

function ensureFaction(db, slug) {
  const FACTION_NAMES = {
    'space-marines': 'Space Marines',
    'tyranids':      'Tyranids',
    'astra-militarum': 'Astra Militarum',
  };
  const name = FACTION_NAMES[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const sel = db.prepare('SELECT id FROM factions WHERE slug = ?');
  const existing = sel.get(slug);
  if (existing) return existing.id;
  const ins = db.prepare('INSERT INTO factions (slug, name) VALUES (?, ?)');
  return Number(ins.run(slug, name).lastInsertRowid);
}

function slugFromPath(path) {
  return path.split('/').pop().replace(/\.md$/, '');
}

async function processDatasheet(db, factionSlug, factionId, mdPath) {
  const text = readFileSync(mdPath, 'utf8');
  const fm = await parseFrontmatter(text);
  const ds = parseDatasheet(text);
  const slug = (fm && fm.slug) || slugFromPath(mdPath);

  const sourcePath = mdPath.replace(REPO + '/', '');
  const enriched = fm && fm.loadouts && Array.isArray(fm.loadouts) ? 1 : 0;

  const insUnit = db.prepare(`
    INSERT INTO units
      (faction_id, slug, name, epic_hero, battleline, is_character,
       base_shape, base_diameter_mm, base_length_mm, base_width_mm, per_model_bases_json,
       movement, toughness, save, invulnerable_save, wounds, leadership, oc,
       max_range_in, ranges_in_json, grants_json, source_path, enriched)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const base = ds.base ?? {};
  const profile = ds.profile ?? {};
  const grants = fm?.grants_to_attached_unit ?? null;
  const grantsJson = grants ? JSON.stringify(grants) : null;
  const result = insUnit.run(
    factionId,
    slug,
    ds.name ?? slug,
    fm?.epic_hero ? 1 : 0,
    fm?.battleline ? 1 : 0,
    fm?.is_character ? 1 : 0,
    base.shape ?? null,
    base.diameter_mm ?? null,
    base.length_mm ?? null,
    base.width_mm ?? null,
    base.per_model ? JSON.stringify(base.per_model) : null,
    profile.M ?? null,
    profile.T ?? null,
    profile.Sv ?? null,
    profile.InvSv ?? fm?.invulnerable_save ?? null,
    profile.W ?? null,
    profile.Ld ?? null,
    profile.OC ?? null,
    ds.max_range_in ?? null,
    ds.ranges_in?.length ? JSON.stringify(ds.ranges_in) : null,
    grantsJson,
    sourcePath,
    enriched,
  );
  const unitId = Number(result.lastInsertRowid);

  // Loadouts (frontmatter only)
  if (fm?.loadouts && Array.isArray(fm.loadouts)) {
    const insLoadout = db.prepare(
      'INSERT INTO unit_loadouts (unit_id, model_count, points, is_default) VALUES (?, ?, ?, ?)'
    );
    for (const lo of fm.loadouts) {
      insLoadout.run(unitId, lo.models, lo.points, lo.default ? 1 : 0);
    }
  }

  // Keywords (frontmatter and/or body fallback)
  const kwSet = new Map(); // keyword → is_faction
  if (fm?.keywords) {
    for (const k of fm.keywords.faction ?? []) kwSet.set(String(k).toUpperCase(), 1);
    for (const k of fm.keywords.unit ?? []) kwSet.set(String(k).toUpperCase(), 0);
  } else {
    // Body parse — `**Faction Keywords:** A, B` and `**Unit Keywords:** X, Y`
    const factionKw = /\*\*Faction Keywords:\*\*\s*(.+?)$/im.exec(text);
    const unitKw    = /\*\*Unit Keywords:\*\*\s*(.+?)$/im.exec(text);
    if (factionKw) for (const k of factionKw[1].split(',')) kwSet.set(k.trim().toUpperCase(), 1);
    if (unitKw)    for (const k of unitKw[1].split(','))    kwSet.set(k.trim().toUpperCase(), 0);
  }
  if (kwSet.size > 0) {
    const insKw = db.prepare('INSERT OR IGNORE INTO unit_keywords (unit_id, keyword, is_faction) VALUES (?, ?, ?)');
    for (const [kw, isFaction] of kwSet) insKw.run(unitId, kw, isFaction);
  }

  // Led-by (frontmatter only — body has no canonical machine-readable list)
  if (fm?.led_by && Array.isArray(fm.led_by)) {
    const insLedBy = db.prepare('INSERT OR IGNORE INTO unit_led_by (unit_id, leader_slug) VALUES (?, ?)');
    for (const slug of fm.led_by) insLedBy.run(unitId, String(slug));
  }

  // Weapons (body)
  const insWeapon = db.prepare(`
    INSERT INTO weapons (unit_id, kind, name, range_in, attacks, skill, strength, ap, damage, keywords)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const w of parseWeaponsTable(text, 'ranged')) {
    insWeapon.run(unitId, 'ranged', w.name, w.range_in, w.attacks, w.skill, w.strength, w.ap, w.damage, w.keywords);
  }
  for (const w of parseWeaponsTable(text, 'melee')) {
    insWeapon.run(unitId, 'melee', w.name, w.range_in, w.attacks, w.skill, w.strength, w.ap, w.damage, w.keywords);
  }

  return { slug, enriched, weapons: 0 };
}

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function processMission(db, mdPath) {
  const text = readFileSync(mdPath, 'utf8');
  const fm = await parseFrontmatter(text);
  const slug = (fm && fm.slug) || slugFromPath(mdPath);
  const titleMatch = /^#\s+(.+)$/m.exec(text);
  const name = (fm && fm.name) || (titleMatch ? titleMatch[1].trim() : slug);
  const sourcePath = mdPath.replace(REPO + '/', '');
  db.prepare(`
    INSERT INTO missions (slug, name, source_path, body_md, frontmatter_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(slug, name, sourcePath, text, fm ? JSON.stringify(fm) : null);
}

async function processRoster(db, mdPath) {
  const text = readFileSync(mdPath, 'utf8');
  const fm = await parseFrontmatter(text);
  // Skip rosters without a units array — these are hand-written tables, not
  // structured for runtime use (matches the existing dropdown filter behavior).
  if (!fm || !Array.isArray(fm.units)) return false;
  const slug = fm.slug || slugFromPath(mdPath);
  const titleMatch = /^#\s+(.+)$/m.exec(text);
  const name = fm.name || (titleMatch ? titleMatch[1].trim() : slug);
  const sourcePath = mdPath.replace(REPO + '/', '');
  db.prepare(`
    INSERT INTO rosters (slug, name, source_path, body_md, frontmatter_json,
                         faction_slug, detachment_slug, points_cap)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    slug, name, sourcePath, text, JSON.stringify(fm),
    fm.faction || null,
    fm.detachment || null,
    fm.points_cap || null,
  );
  return true;
}

async function build() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (existsSync(OUT_DB)) unlinkSync(OUT_DB);

  const db = new DatabaseSync(OUT_DB);
  db.exec(SCHEMA);

  // Datasheets
  const factionDirs = listSubdirs(DATASHEETS);
  let unitCount = 0;
  let enrichedCount = 0;
  for (const factionDir of factionDirs) {
    const slug = factionDir.split('/').pop();
    const unitsDir = join(factionDir, 'units');
    const files = listMarkdownFiles(unitsDir);
    if (files.length === 0) continue;
    const factionId = ensureFaction(db, slug);
    for (const file of files) {
      const r = await processDatasheet(db, slug, factionId, file);
      unitCount++;
      if (r.enriched) enrichedCount++;
    }
  }

  // Scenarios (formerly "missions" — renamed to faction-agnostic terminology)
  const scenariosDir = join(REPO, 'scenarios');
  let missionCount = 0;
  for (const file of listMarkdownFiles(scenariosDir)) {
    await processMission(db, file);
    missionCount++;
  }

  // Rosters (only structured ones — hand-written tables are skipped)
  const rostersDir = join(REPO, 'rosters');
  let rosterCount = 0;
  for (const file of listMarkdownFiles(rostersDir)) {
    const ok = await processRoster(db, file);
    if (ok) rosterCount++;
  }

  const insMeta = db.prepare('INSERT INTO catalogue_meta (key, value) VALUES (?, ?)');
  insMeta.run('built_at', new Date().toISOString());
  insMeta.run('built_from_sha', gitSha());
  insMeta.run('catalogue_version', '1');
  insMeta.run('unit_count', String(unitCount));
  insMeta.run('enriched_count', String(enrichedCount));
  insMeta.run('mission_count', String(missionCount));
  insMeta.run('roster_count', String(rosterCount));

  db.close();

  console.log(`catalogue.db built: ${unitCount} units (${enrichedCount} enriched), ${missionCount} missions, ${rosterCount} rosters → ${OUT_DB}`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
