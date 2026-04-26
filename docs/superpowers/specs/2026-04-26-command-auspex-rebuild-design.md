# Command Auspex Rebuild — Design Spec

**Date:** 2026-04-26
**Captain:** Tom Hunter, Ultramarines Second Company
**Servoskull:** Venator
**Predecessor:** `app/command-auspex.html` (static FSA-based prototype, ~206 tests passing)

---

## Mission Statement

Command Auspex is a list-building battle simulator. It helps a Captain assess whether each unit in his list earns its points: can it reach what it is good against, and how reliably will it kill or survive? Battlefield placement and threat geometry inform the math; the math informs the list.

The tool is for Captains preparing for tabletop play, not a live-game tracker. Its outputs are probability distributions, threat coverage maps, and list-validity checks — not phase prompts or wound counters.

---

## Goals

- **Packageable** — desktop app installable on macOS and Windows, distributable to other Captains as a single download. No code signing required (free distribution).
- **Local-first** — no server, no cloud dependency, no recurring cost. App and data live on the device.
- **Catalogue-driven** — every datasheet, mission, and rule is queryable via SQL. Filtering by faction, points, keywords is instant.
- **Combat-aware** — Monte Carlo combat simulator computes kill probability, expected damage, and survival odds for any attacker/defender pairing.
- **List-validating** — drag-and-drop list builder enforces 10th edition rules (leader attachments, enhancement eligibility, point caps, detachment-specific rules).
- **Threat-aware** — overlays each unit's reachable enemy targets given the mission deployment and N turns of movement, then flags units that are wasted (chaff with no useful target) or over-tasked (elites unable to reach what they hurt).

---

## Non-Goals

The following are explicitly out of scope. They appear here so future scope-creep arguments have a counter-citation.

- **Live in-game tracker** — no wound counters, no CP tracker, no phase prompts during play.
- **Dice rolling for actual play** — the simulator computes probabilities; the Captain rolls real dice on the table.
- **GW Companion App scraping or rules ingestion automation** — Captain authors datasheets in markdown using the existing repo workflow. Auto-pulled rules would require maintaining a scraper against a moving target.
- **Multi-player network coordination** — each Captain runs his own copy. The 500 Worlds Campaign coordination remains markdown-and-conversation.
- **Mobile (iOS / Android)** — desktop only. Architecture does not preclude a future mobile client, but it is not v1.
- **Code signing / App Store distribution** — free unsigned distribution. Testers accept Gatekeeper / SmartScreen warnings.
- **Editing markdown from inside the app** — markdown remains the authoring surface in a text editor. The app reads `catalogue.db`, derived from markdown at build time.
- **Stratagem reference card / rules wiki** — out for v1. The simulator applies stratagem effects when computing distributions, but the app does not double as a rules lookup tool.

---

## Architecture Overview

### Three-pillar system

```
┌─────────────────────────────────────────────────────────────┐
│  Tauri Shell (Rust + WebView)                                │
│  • Window, native menus, file dialogs                        │
│  • Tauri filesystem API (replaces File System Access API)    │
│  • tauri-plugin-sql exposes SQLite to frontend               │
│  • Bundles read-only catalogue.db as resource                │
│  • Manages user.db in OS app-data directory                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend (HTML/JS, lifted from existing app/)               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │  Catalogue Layer │  │  Sim Engine      │  │  Renderer  │  │
│  │  app/lib/        │  │  app/lib/sim/    │  │  app/lib/  │  │
│  │    catalogue.js  │  │    combat.js     │  │    render.js│ │
│  │  Query API       │  │  Monte Carlo     │  │  SVG       │  │
│  │  (no raw SQL     │  │  combat resolver │  │  battlemap │  │
│  │  in UI code)     │  │                  │  │            │  │
│  └──────────────────┘  └──────────────────┘  └────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │  Threat Layer    │  │  List Builder    │  │  Scenario  │  │
│  │  app/lib/threat/ │  │  app/lib/        │  │  app/lib/  │  │
│  │    coverage.js   │  │    list.js       │  │    scenario│  │
│  │  Geometry +      │  │  Validation,     │  │  Save/load │  │
│  │  combat join     │  │  point caps      │  │            │  │
│  └──────────────────┘  └──────────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Data Tier                                                   │
│  ┌─────────────────────────────┐  ┌──────────────────────┐   │
│  │  catalogue.db (read-only)   │  │  user.db (read-write)│   │
│  │  Bundled in app resources   │  │  OS app-data dir     │   │
│  │  Rebuilt every release from │  │  Survives upgrades   │   │
│  │  markdown source repo       │  │  Migrations versioned│   │
│  └─────────────────────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Build pipeline

```
Markdown source (datasheets/, ultramarines/, 500 Worlds Campaign/)
  │
  ▼
scripts/build-catalogue.js (Node, reuses app/lib/datasheet-parser.js)
  │
  ▼
catalogue.db (SQLite)
  │
  ▼
Tauri resource bundle  ─►  cargo tauri build  ─►  .dmg / .msi / .AppImage
                                                        │
                                                        ▼
                                              GitHub Releases (free)
                                                        │
                                                        ▼
                                              Tester downloads installer
```

### Why this shape

**Markdown stays canonical.** The Captain edits `.md` files in his text editor. The build script re-derives `catalogue.db` from those files. The app reads the DB. There is no path where the app writes back to markdown — the authoring workflow is unchanged.

**Two databases, one purpose each.** `catalogue.db` is wholesale replaced on every app release; `user.db` accumulates the Captain's mutable state (rosters, scenarios, paint progress). Mixing them creates migration nightmares; splitting them does not.

**Pure functional sim engine.** The combat simulator takes structured input (attacker, defender, modifiers) and returns a distribution. No side effects, no DB access, fully testable. This is the only way to keep a probability engine maintainable as 10th edition keywords expand.

**No backend.** A Captain on a train, in a basement game, or at a tournament hall has no network expectation. Every feature works offline. A future sync server is a Phase 2 enhancement that does not require rewriting the data model.

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Desktop shell | **Tauri 2.x** | ~10MB binary, reuses existing HTML/JS frontend, cross-platform from one codebase, MIT licensed |
| Database (runtime) | **SQLite** via `tauri-plugin-sql` | Built into every OS, no extra runtime, JSON1 extension for keyword arrays |
| Database (build) | **better-sqlite3** (Node, build-time only) | Synchronous SQLite for the build script; not bundled with the app |
| Frontend | **Vanilla HTML + ES modules** (lifted from current `app/`) | Already exists, already tested, no framework cost |
| Tests | **Node `--test`** built-in runner | Already adopted, no test framework cost |
| Combat sim | **Pure JS, Monte Carlo** | TDD-friendly, handles arbitrary keyword stacking |
| Build/CI | **GitHub Actions** + **GitHub Releases** | Free for public repos, produces all three desktop installers per tag |
| Markdown parsing | **js-yaml** (already a devDep) + existing `datasheet-parser.js` | Reuses work already done and tested |

**Versions:**
- Tauri 2.x (current LTS at time of writing)
- Rust stable (whatever Tauri 2.x requires)
- Node 20+ (for build scripts and tests)
- SQLite 3.38+ (for native JSON support; bundled by tauri-plugin-sql)

**Dependencies added to package.json:**
- `better-sqlite3` (dev) — build-time only, not in app bundle
- No runtime JS deps beyond what already exists

**Dependencies added to Cargo.toml (Tauri side):**
- `tauri` 2.x
- `tauri-plugin-sql` with `sqlite` feature
- `tauri-plugin-fs` (for app-data directory access)
- `tauri-plugin-dialog` (for native file dialogs)

---

## Data Model

### catalogue.db schema (read-only, bundled)

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- =============================================================
-- Identity & taxonomy
-- =============================================================

CREATE TABLE factions (
  id        INTEGER PRIMARY KEY,
  slug      TEXT UNIQUE NOT NULL,           -- 'space-marines', 'tyranids'
  name      TEXT NOT NULL
);

CREATE TABLE sub_factions (
  id          INTEGER PRIMARY KEY,
  faction_id  INTEGER NOT NULL REFERENCES factions(id),
  slug        TEXT NOT NULL,                -- 'ultramarines'
  name        TEXT NOT NULL,
  UNIQUE(faction_id, slug)
);

-- =============================================================
-- Detachments (army-builder anchor)
-- =============================================================

CREATE TABLE detachments (
  id          INTEGER PRIMARY KEY,
  faction_id  INTEGER NOT NULL REFERENCES factions(id),
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  body_md     TEXT NOT NULL,                -- full description
  UNIQUE(faction_id, slug)
);

CREATE TABLE detachment_abilities (
  id              INTEGER PRIMARY KEY,
  detachment_id   INTEGER NOT NULL REFERENCES detachments(id),
  slug            TEXT NOT NULL,
  name            TEXT NOT NULL,
  body_md         TEXT NOT NULL,
  effect_json     TEXT,                     -- structured modifiers (NULL if not yet structured)
  UNIQUE(detachment_id, slug)
);

CREATE TABLE stratagems (
  id              INTEGER PRIMARY KEY,
  detachment_id   INTEGER REFERENCES detachments(id),  -- NULL = core stratagem
  slug            TEXT NOT NULL,
  name            TEXT NOT NULL,
  cp_cost         INTEGER NOT NULL,
  phase           TEXT NOT NULL,            -- 'command' | 'movement' | 'shooting' | 'charge' | 'fight' | 'any'
  body_md         TEXT NOT NULL,
  trigger_json    TEXT,                     -- when it can fire
  effect_json     TEXT,                     -- structured modifiers (NULL if not yet structured)
  UNIQUE(detachment_id, slug)
);

CREATE TABLE enhancements (
  id              INTEGER PRIMARY KEY,
  detachment_id   INTEGER NOT NULL REFERENCES detachments(id),
  slug            TEXT NOT NULL,
  name            TEXT NOT NULL,
  points          INTEGER NOT NULL,
  body_md         TEXT NOT NULL,
  effect_json     TEXT,                     -- structured modifiers
  UNIQUE(detachment_id, slug)
);

CREATE TABLE enhancement_eligibility (
  enhancement_id      INTEGER NOT NULL REFERENCES enhancements(id),
  required_keyword    TEXT,                 -- e.g. 'INFANTRY', 'CHARACTER'
  forbidden_keyword   TEXT                  -- e.g. 'EPIC HERO'
);

-- =============================================================
-- Units
-- =============================================================

CREATE TABLE units (
  id                  INTEGER PRIMARY KEY,
  faction_id          INTEGER NOT NULL REFERENCES factions(id),
  slug                TEXT NOT NULL,
  name                TEXT NOT NULL,
  epic_hero           INTEGER NOT NULL DEFAULT 0,    -- boolean
  battleline          INTEGER NOT NULL DEFAULT 0,
  is_character        INTEGER NOT NULL DEFAULT 0,
  is_dedicated_transport INTEGER NOT NULL DEFAULT 0,
  base_shape          TEXT,                          -- 'round' | 'oval'
  base_diameter_mm    REAL,
  base_length_mm      REAL,
  base_width_mm       REAL,
  per_model_bases_json TEXT,                         -- mixed-base units
  movement            TEXT,                          -- '6"'
  toughness           INTEGER,
  save                TEXT,                          -- '3+'
  invulnerable_save   TEXT,                          -- '4++' or NULL
  wounds              INTEGER,
  leadership          TEXT,                          -- '6+'
  oc                  INTEGER,
  max_range_in        INTEGER,
  ranges_in_json      TEXT,                          -- sorted unique array
  source_path         TEXT NOT NULL,                 -- back-ref to markdown
  UNIQUE(faction_id, slug)
);
CREATE INDEX idx_units_faction ON units(faction_id);

CREATE TABLE unit_loadouts (
  id              INTEGER PRIMARY KEY,
  unit_id         INTEGER NOT NULL REFERENCES units(id),
  model_count     INTEGER NOT NULL,                  -- 5, 10
  points          INTEGER NOT NULL,
  is_default      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_loadouts_points ON unit_loadouts(points);
CREATE INDEX idx_loadouts_unit ON unit_loadouts(unit_id);

CREATE TABLE unit_keywords (
  unit_id     INTEGER NOT NULL REFERENCES units(id),
  keyword     TEXT NOT NULL,
  is_faction  INTEGER NOT NULL DEFAULT 0,             -- faction kw vs unit kw
  PRIMARY KEY (unit_id, keyword)
);
CREATE INDEX idx_keywords_keyword ON unit_keywords(keyword);

CREATE TABLE unit_models (
  id            INTEGER PRIMARY KEY,
  unit_id       INTEGER NOT NULL REFERENCES units(id),
  submodel_name TEXT NOT NULL,                       -- 'Ancient Gadriel', 'Sergeant'
  default_count INTEGER NOT NULL DEFAULT 1,
  base_diameter_mm REAL                              -- override of unit default
);

CREATE TABLE unit_abilities (
  id            INTEGER PRIMARY KEY,
  unit_id       INTEGER NOT NULL REFERENCES units(id),
  scope         TEXT NOT NULL,                       -- 'unit' | 'faction' | 'core'
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,
  body_md       TEXT NOT NULL,
  trigger       TEXT,                                -- 'always' | 'shooting' | 'fight' | 'command' | etc.
  effect_json   TEXT                                 -- structured (NULL until parsed)
);

-- =============================================================
-- Weapons
-- =============================================================

CREATE TABLE weapons (
  id            INTEGER PRIMARY KEY,
  unit_id       INTEGER NOT NULL REFERENCES units(id),
  kind          TEXT NOT NULL,                       -- 'ranged' | 'melee'
  name          TEXT NOT NULL,
  range_in      INTEGER NOT NULL DEFAULT 0,          -- 0 for melee
  attacks       TEXT NOT NULL,                       -- '2', 'D6', '2D6+1'
  skill         TEXT NOT NULL,                       -- '3+', 'N/A' (Torrent)
  strength      INTEGER NOT NULL,
  ap            INTEGER NOT NULL,                    -- stored as negative magnitude (-1, -2)
  damage        TEXT NOT NULL,                       -- '1', 'D3', 'D6+2'
  variant       TEXT                                 -- 'standard' | 'supercharge' for plasma
);
CREATE INDEX idx_weapons_unit ON weapons(unit_id);

CREATE TABLE weapon_abilities (
  weapon_id   INTEGER NOT NULL REFERENCES weapons(id),
  key         TEXT NOT NULL,                         -- 'lethal_hits', 'sustained_hits', 'anti'
  value       TEXT,                                  -- numeric/parametric value as needed
  PRIMARY KEY (weapon_id, key, value)
);
CREATE INDEX idx_weapon_abilities_key ON weapon_abilities(key);

-- =============================================================
-- Leader attachments
-- =============================================================

CREATE TABLE leader_eligibility (
  leader_unit_id  INTEGER NOT NULL REFERENCES units(id),
  target_unit_id  INTEGER NOT NULL REFERENCES units(id),
  PRIMARY KEY (leader_unit_id, target_unit_id)
);
CREATE INDEX idx_leader_target ON leader_eligibility(target_unit_id);

-- =============================================================
-- Missions
-- =============================================================

CREATE TABLE missions (
  id                    INTEGER PRIMARY KEY,
  slug                  TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  pack                  TEXT NOT NULL,               -- '500-worlds', 'leviathan', etc.
  body_md               TEXT NOT NULL,
  deployment_map_json   TEXT NOT NULL,               -- polygons keyed by side
  primary_objective_md  TEXT,
  secondary_options_md  TEXT
);

-- =============================================================
-- Build metadata
-- =============================================================

CREATE TABLE catalogue_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Populated at build time:
-- key='built_at'  value='2026-04-26T14:32:00Z'
-- key='built_from_sha' value='<git rev-parse HEAD>'
-- key='catalogue_version' value='1'
```

### user.db schema (read-write, app-data)

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE schema_version (
  version INTEGER NOT NULL
);
INSERT INTO schema_version VALUES (1);

CREATE TABLE rosters (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  points_cap      INTEGER NOT NULL,                  -- 1000, 2000, 3000
  faction_slug    TEXT NOT NULL,
  detachment_slug TEXT,
  warlord_unit_slug TEXT,
  notes_md        TEXT,
  created_at      TEXT NOT NULL,                     -- ISO 8601
  updated_at      TEXT NOT NULL
);

CREATE TABLE roster_units (
  id                      INTEGER PRIMARY KEY,
  roster_id               INTEGER NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
  unit_slug               TEXT NOT NULL,             -- catalogue ref
  loadout_id              INTEGER NOT NULL,          -- catalogue ref
  enhancement_slug        TEXT,                       -- catalogue ref or NULL
  attached_to_unit_id     INTEGER REFERENCES roster_units(id),  -- leader → squad
  display_name            TEXT,                       -- 'Captain Hunter' override
  notes                   TEXT
);

CREATE TABLE scenarios (
  id                      INTEGER PRIMARY KEY,
  name                    TEXT NOT NULL,
  mission_slug            TEXT NOT NULL,
  attacker_roster_id      INTEGER REFERENCES rosters(id),
  defender_roster_id      INTEGER REFERENCES rosters(id),
  body_md                 TEXT NOT NULL,             -- full state for round-trip
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE TABLE paint_progress (
  id              INTEGER PRIMARY KEY,
  unit_slug       TEXT NOT NULL,
  submodel        TEXT,                              -- NULL = whole unit
  status          TEXT NOT NULL,                     -- 'unbuilt' | 'built' | 'primed' | 'painted' | 'based'
  log_md          TEXT,
  updated_at      TEXT NOT NULL,
  UNIQUE(unit_slug, submodel)
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### Datasheet markdown enrichment

Existing datasheets (45 of them in `datasheets/space-marines/units/`) currently lack the structured fields the build script needs. They will be enriched with YAML frontmatter:

```yaml
---
slug: intercessor-squad
faction: space-marines
sub_factions: [adeptus-astartes]
epic_hero: false
battleline: true
is_character: false
is_dedicated_transport: false
loadouts:
  - models: 5
    points: 80
    default: true
  - models: 10
    points: 160
keywords:
  faction: [Adeptus Astartes]
  unit: [Infantry, Battleline, Grenades, Imperium, Tacticus, Intercessor Squad]
led_by:
  - captain
  - lieutenant
  - apothecary-biologis
  - judiciar
---

# Intercessor Squad

[existing body content unchanged]
```

The body sections (Base, Profile, Weapons, Abilities) remain as today. The build script reads frontmatter for what is now structured, falls back to body parsing for what is still in body text (via the existing `datasheet-parser.js`), and combines both into catalogue.db rows.

**Backfill approach:** Servoskull-driven pass over all 45 datasheets, with Captain spot-check for ambiguous cases (per Captain directive). The Captain's existing memory directive — "pull datasheets by default when uncertain" — applies: where the servoskull is not confident about points, keywords, or led-by lists, it surfaces the conflict to the Captain rather than guessing.

**The enrichment pass is its own milestone (0.3) and runs in parallel with milestone 0.2 (catalogue.db schema + build script).** The build script is written and tested first against a few hand-enriched datasheets; the bulk backfill happens once the schema is locked.

---

## Combat Simulation Engine

### Approach: Monte Carlo

For each attacker/defender pairing, simulate the full attack sequence N times (default 5000) and report the resulting distribution.

**Why Monte Carlo over closed-form:** 10th edition's keyword interactions (Lethal Hits + Sustained Hits + Re-roll 1s + Twin-linked + Anti-INFANTRY 4+ + Devastating Wounds, all stackable) make closed-form math combinatorially complex. MC handles arbitrary modifier composition trivially. Performance is fine — ~50ms per pairing on a modern machine, well under any UI threshold.

### Engine inputs

```javascript
simulate({
  attacker: {
    weapons: [{
      name, kind, range_in, attacks, skill, strength, ap, damage,
      abilities: { lethal_hits: true, sustained_hits: 1, anti: { kw: 'INFANTRY', threshold: 4 } },
      modifiers: { hit: +1, wound: 0, attacks: 0 }
    }],
    unit_modifiers: { reroll_hits: '1', reroll_wounds: false, ... },
    model_count: 5
  },
  defender: {
    toughness: 4,
    save: 3,                       // base AP-modifiable save
    invulnerable: 4,               // best-case save
    fnp: null,                     // 5+ FNP, 6+ FNP, or null
    wounds_per_model: 2,
    model_count: 5,
    keywords: ['INFANTRY', 'TACTICUS'],
    modifiers: { incoming_hit: -1, incoming_wound: 0, ... }
  },
  context: {
    cover: false,
    half_range: false,             // for Rapid Fire
    stationary: true,              // for Heavy
    target_oath_of_moment: false,
    trials: 5000
  }
}) → {
  trials: 5000,
  expected_wounds_dealt: 4.2,
  expected_models_lost: 1.8,
  p_target_destroyed: 0.34,
  p_attacker_kills_one_or_more: 0.92,
  histogram_models_lost: [...],
  histogram_wounds_dealt: [...],
  unmodelled_abilities: ['Adamantine Mantle (FNP-like)']  // surfaces gaps
}
```

### Resolution chain (per trial)

```
For each weapon:
  1. Roll attacks count (handle dice expressions: D3, D6, 2D6, A+1, Rapid Fire, Blast)
  2. For each attack:
     a. Roll hit die (skip if Torrent: auto-hit)
        • Apply hit modifier (+1, -1, capped per rules)
        • Re-rolls: 1s, full, vs target keyword
        • Sustained Hits: nat 6 → +N hits (which then proceed to wound)
        • Lethal Hits: nat 6 → auto-wound (skips wound roll)
     b. Wound roll (if not auto-wound)
        • S vs T table + wound modifier
        • Re-rolls (1s, full, vs target keyword)
        • Anti-X N+: vs unit with keyword X, wound on N+
        • Devastating Wounds: nat 6 wound roll → mortal wound (skips save)
        • Twin-linked: re-roll wound rolls
     c. Save roll
        • max(armor save − AP, invulnerable save)
        • Cover: +1 to save (capped at base+1, never exceeds 3+ for infantry)
        • Devastating Wounds bypass entirely
     d. FNP roll (if defender has FNP, including Devastating Wounds in some cases)
     e. Damage application
        • Roll damage (D3, D6, etc.)
        • Apply to current model; spillover within target unit; FNP per wound
        • Damage cannot exceed model's remaining wounds (no spill between models for most weapons)
3. Track: wounds dealt, models slain (when wounds equal model wound count)
```

### Coverage staircase

The engine ships in stages. Each stage adds keywords; the simulator marks any input it cannot handle and surfaces it in the result so the Captain knows where the math is approximate.

**Stage 1 (milestone 0.6) — Core chain + 10 weapon keywords:**
- A, BS/WS, S, T, Sv, AP, D, FNP
- Lethal Hits, Sustained Hits N, Devastating Wounds, Twin-linked, Anti-X N+
- Heavy, Rapid Fire, Blast, Hazardous, Torrent
- Re-roll 1s and Re-roll full on hits and wounds (passed in as modifiers)

**Stage 2 (milestone 0.7) — Unit-level abilities:**
- Cover, +1 to hit/wound, Stealth (incoming -1 to hit), Lone Operative
- Oath of Moment (re-roll hit + conditional +1 wound)
- Mortal wounds resolution

**Stage 3 (milestone 0.8) — Stratagem and detachment ability layer:**
- Stratagem one-shots applied as one-phase modifiers
- Detachment passives applied as army-wide modifiers
- Captain selects active stratagems for a "what if I use this stratagem?" preview

**Stage 4 (later) — Edge cases:**
- Indirect Fire (-1 to hit + cover always applies)
- Precision (allocate to characters)
- Pistol (can shoot in melee)
- Devastating Wounds variants (some bypass FNP, some don't, depending on edition)

Anything not yet structured falls back to "ability not modeled" warning. The simulator never silently ignores; it always reports what it skipped.

### File structure

```
app/lib/sim/
  combat.js          # Main entry: simulate(attacker, defender, ctx)
  dice.js            # Dice expression parser: parseRoll('2D6+1') → ()=>number
  attack.js          # Single-attack resolution chain
  modifiers.js       # Modifier stacking, cap rules ('cannot have +/- more than 1 to a roll')
  keywords/
    lethal-hits.js
    sustained-hits.js
    devastating-wounds.js
    twin-linked.js
    anti.js
    heavy.js
    rapid-fire.js
    blast.js
    torrent.js
    hazardous.js
  index.js           # Re-exports
```

Each keyword module is a pure function that takes the current attack state and returns a transformed state. New keywords plug in without touching the core resolver.

### Testing

Each keyword module has unit tests with known-good distributions sourced from manual probability calculations or UnitCrunch reference values. Example:

```javascript
test('Lethal Hits: 5 attacks, 3+ to hit, vs T8 (impossible to wound)', () => {
  // 5 attacks × 1/3 chance of nat 6 = expected 0.833 auto-wounds
  const result = simulate({
    attacker: { weapons: [oneWeapon({ A: 5, BS: 3, S: 4, abilities: { lethal_hits: true } })] },
    defender: defender({ T: 8, Sv: 3, W: 2, models: 5 }),
    context: { trials: 50000 }
  });
  assertWithinTolerance(result.expected_wounds_dealt, 0.833, 0.05);
});
```

5000-trial runs are the default; high-precision unit tests use 50000 trials with tighter tolerances.

---

## Threat Assessment Layer

The threat layer joins geometry (where can this unit be in N turns?) with combat math (against what can it productively attack?) to answer: **is this unit earning its points in this matchup?**

### Inputs

```javascript
assessUnit({
  unit: rosterUnit,                   // attacker we're evaluating
  opposing_list: rosterUnit[],        // every unit in opponent's list
  mission: missionFromCatalogue,
  deployment_zone: 'attacker' | 'defender',
  turns_to_consider: 2,               // movement reach over T turns
}) → {
  reach_radius_in: 26,                // M + Advance × T + max_range
  reachable_targets: [
    { unit: hiveTyrant, distance_in: 22, can_reach_turn: 2 },
    { unit: termagants, distance_in: 14, can_reach_turn: 1 },
    ...
  ],
  productive_targets: [
    { unit: termagants, p_kill: 0.82, expected_value: 240 },
    ...
  ],
  productivity_score: 0.42,           // expected_value_sum / unit_points
  verdict: 'efficient' | 'wasted' | 'over-tasked' | 'underpowered',
  rationale: 'Cannot reach any target with p_kill > 0.2 within 2 turns'
}
```

### Verdict definitions

- **efficient** — productivity_score ≥ 0.8: this unit pays its points in expected damage value.
- **wasted** — no reachable targets with p_kill > 0.2: the unit is chaff that achieves nothing.
- **over-tasked** — reachable but p_kill < 0.3 against best target: the unit cannot finish what it engages.
- **underpowered** — productive against trivial targets only (low-points enemies): you're using a hammer to hit a mouse.

These thresholds are tunable; the Captain may want to override `wasted` for objective-holders that don't need to kill.

### File structure

```
app/lib/threat/
  coverage.js        # Geometry: where can this unit be in N turns
  productivity.js    # Run combat sim against each reachable target
  verdict.js         # Apply thresholds to produce a verdict
  index.js
```

### Integration with battlemap

The existing battlemap renders deployment zones and threat ranges. The threat layer adds:

- A toggleable "verdict" overlay: each unit's verdict shown as a chip on its anchor
- Hover details: top three productive targets with p_kill values
- A "wasted units" sidebar listing every unit with verdict ≠ efficient

This is milestone 0.9 — it depends on the catalogue, the simulator, and the geometry layer all being in place.

---

## List Builder

A drag-and-drop UI for constructing rosters with live validation.

### Capabilities

- **Faction picker** → loads detachment list for that faction
- **Detachment picker** → unlocks that detachment's enhancements and stratagems
- **Unit grid**, filtered by points cap, keywords, character/battleline/transport role
- **Drag a unit** → adds default loadout to roster; loadout pickable per unit
- **Attach leader** → only Characters with leader_eligibility for the target appear in the dropdown
- **Assign enhancement** → only enhancements with enhancement_eligibility matching the target appear
- **Warlord designation** — exactly one Character marked
- **Live point sum** — green when under cap, red when over
- **Validation panel:**
  - Detachment composition rules
  - Battleline minimum (if mission requires)
  - Epic Hero / Enhancement conflicts (Captain memory: Epic Heroes cannot take enhancements)
  - Unique unit caps (most units in 10th cap at 1× per army)
- **Save** → writes to `user.db.rosters` + `user.db.roster_units`
- **Export to markdown** → round-trips a roster back to `ultramarines/rosters/<name>.md` for git tracking

### File structure

```
app/lib/list/
  builder.js         # State management for current list under construction
  validator.js       # Run all the rules; returns array of violations
  rules/
    detachment-composition.js
    enhancement-eligibility.js
    leader-attachment.js
    point-cap.js
    battleline-min.js
    unique-cap.js
  exporter.js        # roster → markdown
  importer.js        # markdown → roster (for editing existing files)
```

Each rule is a pure function `(roster) → violation[]`. New rules plug in without modifying the core.

---

## Distribution

### GitHub Actions release pipeline

`.github/workflows/release.yml` triggers on `git tag v*`:

```yaml
- macOS runner   → cargo tauri build --target universal-apple-darwin → .dmg
- Windows runner → cargo tauri build --target x86_64-pc-windows-msvc → .msi
- Linux runner   → cargo tauri build → .AppImage
```

All three artifacts uploaded to GitHub Releases automatically. Free for public repos.

### Tester install flow

**macOS:**
- Download `.dmg` from Releases page
- Open, drag app to Applications
- First launch: right-click → Open → "Open Anyway" (Gatekeeper warning, one-time)
- App launches normally thereafter

**Windows:**
- Download `.msi` or `.exe` from Releases page
- Run installer
- First launch: SmartScreen warns "Don't run this" → "More info" → "Run anyway"
- App launches normally thereafter

**Linux:**
- Download `.AppImage`, `chmod +x`, double-click

These warnings are the cost of free distribution. They go away the moment we spend $99 (Apple) or ~$200 (Windows EV cert), but we are not paying that until value is proven.

### App data location

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/com.ultramarines.command-auspex/` |
| Windows | `%APPDATA%\com.ultramarines.command-auspex\` |
| Linux | `~/.local/share/com.ultramarines.command-auspex/` |

Contains: `user.db`, optional photo blobs for paint progress, settings cache.

`catalogue.db` is read-only inside the app bundle — never written by the app.

---

## Milestone Staircase

Each milestone produces a working, shippable build with new value. Captain may release any milestone to testers.

### Milestone 0.1 — Tauri Shell + Existing Tool (3-5 days)

**Deliverable:** existing Command Auspex behavior, packaged as a desktop app.

- Create `tauri/` directory with `Cargo.toml`, `tauri.conf.json`, Rust entry point
- Move `app/command-auspex.html` and `app/lib/` into Tauri's frontend resources
- Replace File System Access API in `app/lib/fs.js` with Tauri filesystem API behind the existing abstraction (no changes to call sites)
- Bundle `datasheets/`, `ultramarines/`, `500 Worlds Campaign/` as read-only app resources; existing code reads them via the same `readTextFile` calls
- Add native menus: File → Open Repo (no-op, bundled), File → Save Scenario, File → Recall Scenario
- GitHub Actions workflow that builds for all three platforms on tag push
- First tagged release: `v0.1.0`

**No DB yet. No new features. Just packageable.**

### Milestone 0.2 — catalogue.db (5-7 days)

**Deliverable:** SQLite catalogue with faction, points, keyword filtering UI.

- Create `scripts/build-catalogue.js`: walks markdown, builds `catalogue.db`
- Extend `app/lib/datasheet-parser.js` to read frontmatter (`points`, `keywords`, `led_by`, etc.); fall back to body parsing for legacy fields
- Hand-enrich 5 representative datasheets (Intercessor Squad, Captain, Ballistus Dreadnought, Hellblaster Squad, Wardens of Ultramar) to validate the schema
- Integrate `tauri-plugin-sql`; load `catalogue.db` from app resources
- New `app/lib/catalogue.js`: query API (`findUnits`, `getUnit`, `listFactions`, `listDetachments`, `getMission`)
- Replace existing markdown-walk code paths with catalogue queries (renderer, scenario loader)
- Add filter UI: faction picker, points slider, keyword multi-select
- Test: 5 enriched datasheets round-trip through the build script and produce expected DB rows

### Milestone 0.3 — Datasheet Enrichment Pass (parallel with 0.2-0.4, ~2 weeks elapsed)

**Deliverable:** all 45 SM datasheets carry `points`, `keywords`, `led_by` frontmatter.

- Servoskull-driven backfill, one datasheet at a time
- Each batch validated by re-running `build-catalogue.js` and inspecting catalogue.db
- Captain spot-check on ambiguous cases per his directive
- Tyranid datasheets follow once SM are complete

### Milestone 0.4 — List Builder UI (7-10 days)

**Deliverable:** drag-and-drop list construction with validation.

- `app/lib/list/builder.js` + validator + rules
- New screen: list-builder mode (toggle from battlemap)
- Save to `user.db.rosters`, export to markdown
- Validation panel surfaces detachment composition, leader, enhancement, point-cap rules
- `user.db` schema migration system in place (`schema_version` table)

### Milestone 0.5 — Paint Progress Tracker (3-5 days)

**Deliverable:** per-submodel paint status with army-wide aggregation.

- New screen: paint tracker
- Per-submodel checkbox grid by status (unbuilt → built → primed → painted → based)
- Optional photo attachment per submodel (stored as blobs in app-data dir)
- "X% painted" rollup per unit, per detachment, per army

### Milestone 0.6 — Combat Simulator v1 (10-14 days)

**Deliverable:** core combat math with 10 weapon keywords.

- `app/lib/sim/combat.js` + dice + attack + modifiers + 10 keyword modules
- Test suite with 50000-trial reference values for each keyword
- New panel on battlemap: select attacker unit + click defender unit → see `p_kill`, `expected_wounds`, histogram
- Engine flags `unmodelled_abilities` so the Captain knows where the math is approximate

### Milestone 0.7 — Unit Abilities Structured (7-10 days)

**Deliverable:** common unit-level modifiers applied in the simulator.

- Extend `unit_abilities.effect_json` with structured forms for the most common patterns: re-roll 1s, +1 to wound, FNP, Cover/Stealth modifiers
- Datasheet enrichment pass to populate `effect_json` for known abilities (Oath of Moment, Bolter Drill, Lethal Hits granted by ability, etc.)
- Simulator consumes effect_json from the catalogue automatically when a unit is involved

### Milestone 0.8 — Stratagem & Detachment Layer (7-10 days)

**Deliverable:** "what if I use this stratagem?" preview.

- `stratagems` and `detachment_abilities` tables populated for Captain's primary detachments (Gladius, 1st Company Task Force, Ironstorm, Stormlance — start with whichever is in current play)
- UI: stratagem picker on the simulator panel; toggle one or more, see new distribution
- Detachment passives applied automatically when a roster's detachment is selected

### Milestone 0.9 — Threat Assessment Overlay (5-7 days)

**Deliverable:** per-unit verdict on the battlemap.

- `app/lib/threat/` modules (coverage, productivity, verdict)
- Toggleable overlay: chip on each unit anchor showing efficient/wasted/over-tasked/underpowered
- "Wasted units" sidebar listing problematic units with rationale
- Hover detail panel showing top three productive targets per unit

### Milestone 1.0 — Polish & Public Release Candidate (5-7 days)

**Deliverable:** tester-ready release.

- Onboarding flow: first-launch tutorial, sample roster + scenario
- Error handling pass: every code path has user-friendly status messages
- Accessibility pass: keyboard navigation for all primary actions
- Docs: README explaining install + usage, troubleshooting common Gatekeeper/SmartScreen issues
- v1.0.0 tagged release; tester invites sent

**Total elapsed estimate:** 3-4 months of focused work. Each milestone independently shippable; the Captain may stop at any point and have a useful tool.

---

## Testing Strategy

### Existing test suite (preserved)

The current 206 Node `--test` cases cover parsers, geometry, scenario serialization, FS abstraction, and end-to-end smoke. All preserved verbatim. New code follows the same pattern: one test file per source file, TDD red-green-refactor, no mocks of internal modules.

### New test categories

| Layer | Test approach |
|---|---|
| `scripts/build-catalogue.js` | Hand-built fixture: a tiny `fixtures/datasheets-mini/` tree → assert catalogue.db rows match expected snapshot |
| `app/lib/catalogue.js` | Run queries against a test catalogue.db, assert returned shapes |
| `app/lib/sim/keywords/*.js` | Each keyword: 50000-trial Monte Carlo, assert distribution within 1% of analytic reference |
| `app/lib/sim/combat.js` | Composition tests: stack 3 keywords, verify they interact correctly |
| `app/lib/list/validator.js` + rules | Per-rule unit tests with crafted rosters that violate or comply |
| `app/lib/threat/*.js` | Synthetic mission + minimal lists, assert verdicts |
| Tauri integration | End-to-end smoke via Playwright MCP, similar to current `e2e-smoke.test.js` |

### Coverage target

- Every keyword module: 1+ test
- Every list-builder rule: 1+ violating + 1+ compliant test
- Every catalogue query function: 1 happy-path test
- Sim engine: a "regression suite" of canonical pairings (Hellblasters vs Hive Tyrant, Aggressors vs Termagants, etc.) with reference distributions

---

## Migration & Backward Compatibility

### Existing scenarios

The current Command Auspex saves scenarios as markdown files in `scenarios/` (per the Captain's prior auto-save work). The Tauri port keeps reading these files in milestone 0.1; in milestone 0.4 they migrate into `user.db.scenarios` on first import (one-time, surfaced to the Captain).

### Existing rosters

`ultramarines/rosters/*.md` remain authoritative. The list-builder imports from these via `app/lib/list/importer.js` (markdown → builder state) and exports back via `exporter.js` (builder state → markdown). The DB is a working cache; the markdown is the canonical record.

### Existing datasheets

The enrichment pass adds frontmatter without removing existing body content. Old datasheets without frontmatter still parse (the build script falls back to body parsing for un-enriched fields). Backfill is incremental.

### Existing CLAUDE.md memory directives

All existing user/feedback/project memory remains valid. Two specific directives are load-bearing for this work:

- **"Pull datasheets by default when uncertain"** — the enrichment pass relies on this. Servoskulls verify rules before claiming, surfacing conflicts to the Captain.
- **"MFM points skepticism"** — when the build script encounters a roster file with points that disagree with the datasheet's frontmatter, it logs a warning. Captain decides which side wins.

---

## Risks & Mitigations

### Risk: Tauri 2.x's filesystem API has different semantics than File System Access API

**Mitigation:** existing code is already abstracted behind `app/lib/fs.js`. The port is a single file change. If Tauri's API can't satisfy a current call site, that call site is examined individually rather than rewriting the abstraction.

### Risk: Combat simulator coverage gaps lead to misleading list-building advice

**Mitigation:** every result includes `unmodelled_abilities` listing what the engine couldn't apply. The verdict layer downgrades confidence when un-modelled abilities are present. The Captain sees explicit "this is approximate" markers.

### Risk: Datasheet enrichment is more work than estimated

**Mitigation:** the build script falls back to body parsing for un-enriched datasheets. Milestone 0.2 only requires 5 datasheets enriched to validate the schema; the bulk backfill (0.3) runs in parallel with 0.4-0.5 work and doesn't gate them.

### Risk: SQLite migrations on user.db break on app upgrade

**Mitigation:** `schema_version` table + numbered migrations. Each migration is one-way, idempotent, and tested with a "pre-migration → post-migration" snapshot fixture. The `catalogue.db` is wholesale-replaced on every release so it has no migration burden.

### Risk: GitHub Actions free tier limits hit on a busy release week

**Mitigation:** CI builds only on tag push, not every commit. Free tier (2000 minutes/month) covers ~50 tagged releases per month. Well above realistic frequency.

### Risk: Unsigned binaries scare off testers

**Mitigation:** README includes platform-specific "first launch" instructions with screenshots. If a tester refuses to bypass Gatekeeper, that is data: it tells the Captain whether to invest in code signing.

---

## Open Questions

These do not block writing the implementation plan but should be revisited at the appropriate milestone:

1. **Photo storage for paint progress (milestone 0.5):** SQLite blobs vs. flat files in app-data dir? Decision deferred to 0.5.
2. **Markdown round-tripping fidelity (milestone 0.4):** when a list is exported back to markdown, do we preserve hand-written notes between unit entries? Probably yes via a notes-blob field. Decision deferred to 0.4.
3. **Detachment-specific stratagem coverage (milestone 0.8):** start with which detachment? Likely Captain's currently-played detachment at the time. Decision deferred to 0.8.
4. **Mobile (post-1.0):** if a Phase 2 mobile client is ever built, which platform first? iOS likely (Apple ecosystem), but cost is $99/yr.

---

## Summary

Command Auspex evolves from a battlemap visualizer into a list-building battle simulator. The architecture rests on three pillars: Tauri shell for free desktop distribution, SQLite catalogue derived from canonical markdown, and a pure-functional Monte Carlo combat engine that joins with battlefield geometry to produce per-unit verdicts on roster efficiency.

The work ships in ten milestones (0.1 through 1.0), each independently valuable. Milestone 0.1 (Tauri port of existing tool) ships in days; the full feature set reaches release-candidate at milestone 1.0 in roughly 3-4 months. Markdown remains the authoring source of truth throughout.

Free distribution via GitHub Releases, no recurring cost, no server, no mobile, no in-game wound tracking. The tool is for planning, not playing.

## Implementation Plan Scope

This spec is the architectural blueprint covering the entire roadmap. Each milestone gets its own focused implementation plan written separately at the time we are ready to execute it. The immediate next step is the implementation plan for **milestone 0.1 (Tauri shell + existing tool, packaged)** — that plan stands alone, ships in days, and produces a tagged release. Subsequent milestones (0.2 through 1.0) get their own plans drafted as the prior milestone closes, allowing the design to absorb learnings from each release.
