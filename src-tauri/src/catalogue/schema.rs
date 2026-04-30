// Catalogue DB schema — kept byte-for-byte equivalent to the SCHEMA constant
// in scripts/build-catalogue.js so the Rust and JS builders produce
// identical databases during the migration window. Any change here MUST
// be mirrored to the JS side until the JS builder is retired.
//
// Roster table is NO LONGER seeded by the catalogue builder — rosters are
// user-specific data and live in <app_data>/user-save.md, validated against
// the catalogue at load time but never compiled into it. The table itself
// remains for transitional compatibility with app/lib/catalogue.js until
// the user-save loader replaces listRosters() entirely.

pub const SCHEMA: &str = r#"
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
  can_join_json       TEXT,
  enables_co_leader   TEXT,
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
"#;
