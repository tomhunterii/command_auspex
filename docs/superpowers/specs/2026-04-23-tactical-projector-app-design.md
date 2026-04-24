# Tactical Projector App — Design

**Date:** 2026-04-23
**Author:** Venator (on behalf of Captain Hunter)
**Phase:** 5 of the multi-phase Tactical Projection Application effort. Slice **5b — full design**.

## Purpose

A single-page browser application that renders a mission's deployment geometry with both players' armies placed at **1:1 scale** (correct base sizes, correct per-model footprints), supports drag-to-reposition, displays threat ranges and other tactical overlays, and saves the board state to disk as a first-class artefact.

The app is the Captain's tactical planning surface — turn it on, load a mission, load both rosters, see the battle projected. Iterate on deployment by dragging. Save a scenario. Load it next session.

## Scope — Slice 5b

**In scope:**

1. Symmetric mission + roster selection UX (dropdowns + paste).
2. In-browser parsing of pasted GW Companion App exports (JS port of `scripts/parse_gw_roster.py`).
3. Rendering: board, deployment zones, battlefield edges, scoring zones, units at 1:1 with correct base shapes.
4. Auto-placement of both armies in their zones on scenario load.
5. Drag-to-reposition units on the board (Phase 5 — unconstrained; movement-distance constraints are Phase 6, stretch).
6. Layer toggles (deployment, threat ranges, scoring, battlefield edges, coherency debug).
7. Hover tooltips and click-to-detail-panel.
8. Save scenario state as a markdown file with frontmatter.
9. Load a saved scenario back.
10. File I/O via **File System Access API** (`window.showDirectoryPicker`). Write directly to repo folders.

**Out of scope (deferred):**

- Movement-distance constraints on drag (Phase 6, stretch).
- Coherency auto-enforcement; engagement-range enforcement.
- Turn-by-turn simulation or dice resolution.
- Army list generation / list legality checking (Phase 4, deferred).
- Editing datasheets or missions from within the app (those stay authored by hand).
- Opponent-app integration or cloud sync.

## Architecture

**Delivery:** a single file at `app/tactical-projector.html`. No build step. No server. No framework.

**Runtime dependencies loaded from CDNs:**
- `js-yaml` for frontmatter parsing.
- (optional, later) `tweakpane` or similar for dev controls — not in first cut.

**File System Access API:**
- On first load, the app calls `window.showDirectoryPicker()` and stores the returned `FileSystemDirectoryHandle` in memory. No session persistence — user re-grants on reload (browser permission model).
- All subsequent reads/writes traverse from that root handle.
- The user picks the repo root (i.e., `/Users/tomhunterii/Documents/Warhammer 40k/`).

**Code organisation within the HTML:**

One file, three code sections:

1. CSS (inline `<style>`): continues Bank Gothic + JetBrains Mono + phosphor theme.
2. HTML (inline `<body>`): top bar, sidebar, main SVG canvas, modal scaffold.
3. JS (inline `<script type="module">`): the entire app, organised internally into logical modules — parsing, state, rendering, interaction, I/O — all in one file.

The file is expected to grow large (several thousand lines). If it becomes unwieldy, we can split into `app/*.js` modules and `app/index.html` — but starting monolithic.

## Data Model

### Mission
Parsed from `500 Worlds Campaign/missions/*.md` frontmatter (already specified in Phase 2).

### Roster
Parsed from `ultramarines/rosters/*.md` frontmatter (Phase 3). Rosters are mission-agnostic; the scenario (not the roster) binds a roster to a role.

### Datasheet
Live-parsed from `datasheets/<faction>/units/<slug>.md` on demand. The app extracts:
- `## Base` section — base shape + dimensions + flight stem (Phase 1 format).
- `## Profile` — M, T, Sv, W, Ld, OC, and Invulnerable Save if present.
- `## Ranged Weapons` — for threat-range computation (longest range per unit).
- `## Melee Weapons` — for the detail panel.
- `## Abilities` — displayed in the detail panel.
- `## Unit Composition` — reference for max model count.

### Scenario
In-memory structure representing the current board state. Persisted as a markdown file in `500 Worlds Campaign/scenarios/<slug>.md` on Save.

Schema (YAML frontmatter):

```yaml
id: 2026-04-norallus-session-2
name: "Norallus Session 2 vs Spencer"
created: 2026-04-23T21:00:00
last_modified: 2026-04-23T22:30:00
mission: "500 Worlds Campaign/missions/purge-and-burn.md"
defender:
  roster: "ultramarines/rosters/norallus-purge-and-burn.md"
  owner: "Captain Hunter"
attacker:
  roster: "ultramarines/rosters/<file>.md"   # or null if not assigned yet
  owner: "Spencer"

# Board state: per-unit position, orientation, reserve status
board_state:
  defender:
    - unit_ref: "Captain Titus"              # matches a unit in the roster
      placement: on_board                    # on_board | strategic_reserves | deep_strike_reserves | embarked
      position: [30.0, 22.5]                 # center in inches; null if in reserves
      orientation_deg: 0                     # 0 = facing up; clockwise from north
      embarked_in: null                      # unit_ref of transport if placement=embarked
      models: [...]                          # per-model relative offsets for drag-after-placement
    # ...
  attacker:
    - ...

# Transport contents (optional; derived from board_state)
transports:
  - transport_ref: "Impulsor"
    passengers: ["Hellblaster Squad", "Lieutenant"]
```

## UX Flow

### Top bar

```
┌────────────────────────────────────────────────────────────┐
│  TACTICAL PROJECTOR · HOLOLITH-SIGMA                        │
├────────────────────────────────────────────────────────────┤
│  MISSION:  [▾ Purge and Burn          ▾]                    │
│  DEFENDER: [▾ Pick roster             ▾]  [+ Paste export]  │
│  ATTACKER: [▾ Pick roster             ▾]  [+ Paste export]  │
│                                                             │
│                     [LOAD SCENARIO]    [SAVE]    [OPEN]     │
└────────────────────────────────────────────────────────────┘
```

- **Mission dropdown** — populated from `500 Worlds Campaign/missions/*.md`.
- **Defender / Attacker roster dropdowns** — populated from `ultramarines/rosters/*.md` and (future) any `opponents/*.md`. Both dropdowns show the same list; role is assigned per-scenario.
- **+ Paste export** — opens a modal with a textarea. User pastes a GW Companion App export. JS parses, prompts for slug, writes `<slug>.txt` + `<slug>.md` pair, reloads dropdown.
- **LOAD SCENARIO** — uses the selected mission + both rosters to instantiate the initial board. Auto-places units.
- **SAVE** — writes the current board state to a scenario `.md` file.
- **OPEN** — loads a previously-saved scenario file back into the app.

### Main canvas

An SVG covering ~80% of the viewport width. Scaled 10 px = 1", continuing the established convention.

- Board rectangle rendered from mission's `board.width_in × board.height_in`.
- Deployment zone polygons rendered in faction-appropriate fills.
- Battlefield edges drawn as thick coloured lines (per the geometry visual convention).
- Breakthrough / scoring zones drawn as amber dashed regions.
- Unit bases placed on top.

### Side panel

Right-hand panel. Three states:
- **Default** — mission summary + rule IDs + current scenario stats (total points on-board, in reserves, etc.)
- **Hover-tooltip** — compact summary for the unit under the cursor.
- **Detail (clicked)** — full datasheet read: profile, weapons, abilities, led-by list, wargear selected by the roster.

## Rendering Details

### Unit bases

Each model is rendered as an SVG `<circle>` (round) or `<ellipse>` (oval), scaled from the datasheet's `## Base` mm values:

- `1 mm = 10/25.4 px ≈ 0.394 px` (so a 32mm base → ~12.6 px diameter at 10px/in)
- Computed: `diameter_px = diameter_mm × (10 / 25.4)`

Per-model layout within a unit:
- **Single-model units:** one base at the unit's center.
- **Multi-model squads with uniform bases:** bases arranged in a tight hexagonal cluster respecting coherency (models within 2" of another model in the unit).
- **Named-model squads (e.g., Wardens of Ultramar):** each named model is placed individually per roster's `models[].submodel` — cluster layout accounting for mixed 40mm/28.5mm bases.
- **Flight-stem units:** draw a smaller hover indicator below the base (a dashed 3-px ring).

### Sergeant distinction

The first model listed in a unit's `models` array is the sergeant. Visual: bolder outline (2 px stroke vs 1 px for others) and a small chevron dot at the top of the base.

### Leader attachment

Displayed via a dashed **grouping halo** — a rounded-rectangle outline enclosing the character + the led unit's bases. Label on the halo with the character name + "→ [led unit name]".

### Zone fills

- Attacker zone: `rgba(255,93,108,0.22)` (hostile red at 22% opacity).
- Defender zone: `rgba(111,255,142,0.22)` (friendly phosphor at 22%).
- Scoring zones: `rgba(255,179,71,0.08)` with dashed amber border.
- Battlefield edges: thick solid lines at 4-6px.

## Auto-Placement Algorithm

For each player on scenario load:

1. Compute the union polygon of all deployment zones for that player.
2. Inset the polygon by 0.5" (bases sit inside, not straddling the edge).
3. Sort units by base footprint area descending (largest first).
4. For each unit:
   a. Compute the cluster footprint (bounding box of all models at standard coherency spacing).
   b. Scan the zone's inscribed grid (1" resolution) for the first position where the cluster fits without overlapping a previously-placed unit or crossing the zone boundary.
   c. Place the unit; record its center.
5. If any unit cannot fit (very rare), log a warning and place it at the zone centroid with overlap allowed. The Captain drags it into place.

**Coherency spacing** within a unit cluster: models arranged in a hex grid with inter-model gap of 0.5" (pure-sight spacing; less than the 2" coherency limit to leave room for manual spread).

## Interaction

### Drag

- Click-and-hold on any model of a unit initiates a unit drag.
- All models of the unit move together, preserving their relative offsets.
- Snap to 0.25" grid while dragging (toggle in options).
- No movement-distance constraint in Phase 5 — user is trusted.

### Hover tooltip

- Shown after 200ms hover.
- Contents: unit name, model count, base spec, leader (if attached), point cost, wargear summary (top-3 items by salience).

### Click → detail panel

Slides in from the right. Shows:
- Profile table (M/T/Sv/W/Ld/OC + Invul).
- Ranged weapons table.
- Melee weapons table.
- Abilities (Core, Faction, Unique).
- Led-by list (from datasheet).
- Wargear chosen by roster (from roster frontmatter).

### Layer toggles

Top-right button row, same pattern as the existing `dylan-alex-tactical-projection.html`:

- **Deployment** (on by default) — zone fills.
- **Edges** (on by default) — thick lines for battlefield edges.
- **Scoring** (on by default) — breakthrough scoring zone.
- **Threat ranges** — circles around each unit showing longest-ranged weapon.
- **Charge arcs** — dashed 14" arcs from each non-vehicle unit (advance + avg 2D6).
- **Coherency** (debug) — 2" halos around each model.

## Wargear → Datasheet Weapon Matching

The roster captures wargear as free-text strings verbatim from the GW export (e.g., `Master-crafted bolter`). Each datasheet's `## Ranged Weapons` / `## Melee Weapons` tables use canonical weapon names from Wahapedia (e.g., `Master-crafted bolter`).

The app matches roster wargear to datasheet weapon rows by **case-insensitive exact string match** after stripping leading/trailing whitespace. Matches that fail fall back to a fuzzy string match (edit distance ≤ 2) and, if still no match, surface a `WARNING: weapon not found` in the unit's detail panel for the Captain to reconcile. Examples of known-safe matches: all Sternguard weapons, all Aggressor weapons, all Hellblaster weapons.

Known gotchas:
- Roster may say `Bolt Pistol` (capital P); datasheet says `bolt pistol` (lowercase). Case-insensitive match handles this.
- Wardens of Ultramar: `Astropathic Blast` / `Force stave` — these are unique per-model weapons; all must match exactly.

## Threat Range Computation

For each unit:
- Gather all ranged weapons from the roster's wargear list.
- For each wargear item, look up its weapon row in the unit's datasheet.
- Take the maximum `Range` value across all resolved weapons (items that fail to resolve are skipped, with a warning logged).
- Draw a circle at that range from the unit's centerpoint (or nearest model base edge — implementation detail deferred to the plan).
- Colour: match the unit's faction (hostile red for attacker, phosphor green for defender).

Torrent weapons use their listed range (which is the max distance the torrent can reach — `12" Torrent` = 12" circle).
Melee-only units have no threat-range circle (they have a charge arc instead, if that layer is on).

## Scenario Save

On **SAVE**:
1. Serialize the in-memory board state to YAML per the scenario schema.
2. Prompt user for a name (default: `<YYYY-MM-DD>-<mission-slug>-<slug>`).
3. Write to `500 Worlds Campaign/scenarios/<filename>.md` via the File System Access API.
4. Confirmation toast.

The `scenarios/` folder is created on first save if absent.

## Scenario Load

On **OPEN**:
1. Show a file picker scoped to `500 Worlds Campaign/scenarios/*.md`.
2. Parse frontmatter.
3. Resolve the mission and roster files by the paths in the scenario.
4. Rebuild board state from `board_state[]`. Skip auto-placement.
5. Render.

## Visual Style

- **Display type:** Bank Gothic (per memory standard, committed 2026-04-23).
- **Data type:** JetBrains Mono (via Google Fonts).
- **Theme:** continuation of the phosphor / amber / hostile-red / friendly-green palette established in the geometry visual and the Dylan/Alex projection.
- **Scan-line overlay + subtle grain + vignette:** same CSS tricks as the Dylan/Alex projection.

## File Locations

- App file: `app/tactical-projector.html`
- New folder for saved scenarios: `500 Worlds Campaign/scenarios/`
- Rosters folder (paste target): `ultramarines/rosters/` (existing; also add `opponents/` when we have opponent rosters)

## Non-Goals (Explicitly Deferred)

- **Phase 6 (stretch):** movement-distance constraints, coherency auto-enforcement, engagement-range enforcement.
- **Phase 4 (deferred indefinitely):** army-list generation / legality checking.
- Opponent-app integration, cloud sync, multi-user.
- Editing datasheets / missions in-app.
- Rendering full mission art / terrain features.
- Simulating turns, rolling dice, computing expected damage.

## Success Criteria

- Load Norallus + Purge and Burn: board renders with zones, units auto-placed at 1:1, tooltips and click-to-detail work, layers toggle cleanly.
- Paste a new export in the sidebar modal, see it parsed and appear in the dropdown.
- Drag any unit, see all models move together.
- Save the scenario; reload the app; load the scenario back; board state is identical.
- All type is Bank Gothic (display) / JetBrains Mono (data).
- No console errors.

## Open Questions

None at spec approval. Implementation plan (writing-plans skill) will sequence the build and identify tactical decisions.

## Risks

- **File System Access API browser support.** Chrome and Edge ship it. Safari and Firefox do not. The Captain uses macOS; Chrome is the assumed primary browser. Falling back to manual download/upload is doable but adds friction — we build for Chrome first and fall back only if the Captain switches browsers.
- **Auto-placement algorithm quality.** First-iteration packing may produce ugly layouts with mixed base sizes. The drag-to-refine interaction is the mitigation — the Captain is expected to fine-tune.
- **File size of `tactical-projector.html`.** Likely 2–5k lines monolithic. If it becomes painful to edit, we split into modules. Initial monolithic approach optimises for zero-build iteration.
- **Datasheet parsing brittleness.** The custom datasheet parser is non-trivial — sections, tables, abilities with variable structure. Testing on all 44 datasheets is a plan task.

## Provenance

- Phase decisions: Q1A (static HTML + FSA API), Q2C (files on disk), Q3 original answer C superseded by symmetric paste/select UX, Phase 5 placement D (auto+drag), slice 5b.
- Mission data: `500 Worlds Campaign/missions/purge-and-burn.md`.
- Defender roster: `ultramarines/rosters/norallus-purge-and-burn.md`.
- Datasheet schema: Phase 1 base additions + existing fields.
- Parser reference: `scripts/parse_gw_roster.py` (Python; to be ported to JS).
- Geometry reference: `500 Worlds Campaign/campaign/purge-and-burn-geometry.html`.
- Original projection reference: `500 Worlds Campaign/campaign/dylan-alex-tactical-projection.html`.
