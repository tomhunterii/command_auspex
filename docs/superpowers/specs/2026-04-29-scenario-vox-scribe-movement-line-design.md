---
title: Scenarios, Vox-Scribe Parsing, and Movement-Distance Line
date: 2026-04-29
status: draft
---

# Scenarios, Vox-Scribe Parsing, and Movement-Distance Line

Three independent feature additions to Command Auspex, bundled into one spec
because they share no data paths and can be implemented in any order.

## Feature 1 — Scenario save/load

A scenario is a named, file-backed snapshot of an in-progress engagement. It
captures the mission, both rosters, and all per-unit game state (attached
leaders, formations, current map placements) in a single human-readable
markdown file. Loading a scenario restores everything in one shot.

Roster files stay clean — pure list data, no mutation. Mission files stay
clean. Mutating game state lives only in scenario files.

### Storage

- **Location:** `scenarios/<user-name-slug>.md`, written via Tauri fs plugin.
- **Format:** YAML frontmatter + a thin markdown body. Mirrors the existing
  mission and roster file conventions.
- **Naming:** user types a name in the save dialog; slug derived via
  `slugify()` from `app/lib/roster-parser.js`.

### Schema

Extends the existing `buildScenario` / `serializeScenario` shape in
`app/lib/scenario.js`. Current schema already covers `mission`, both rosters,
and `board_state` (positions + formations). Missing piece is leader
attachments.

```yaml
---
id: <slug>
name: <user-supplied name>
created: <ISO 8601>
last_modified: <ISO 8601>
mission: <repo-relative path to mission .md>
defender:
  roster: <repo-relative path>
  owner: <string>
attacker:
  roster: <repo-relative path>
  owner: <string>
attachments:
  defender:
    <squad-instanceId>: [<leader-instanceId>, ...]
  attacker:
    <squad-instanceId>: [<leader-instanceId>, ...]
board_state:
  defender:
    - unit_ref: <name>
      _instanceId: <stable per-instance id>
      placement: on_board
      position: [<x_in>, <y_in>]
      orientation_deg: 0
      formation: cluster | line | wedge | ...
  attacker: [...]
---

# <name>

Scenario for mission `<mission path>`.
```

`_instanceId` already exists in the runtime — it's the key used by the
duplicate-units fix (commit a647286). Persisting it here lets us re-resolve
attachments and formations to specific instances on load, even when the same
unit appears multiple times in a list.

### UI

- **Save Scenario button** (existing `#save-scenario`) — replaces the
  migration-stub handler with: prompt for name → slugify → serialize → write.
  The prompt reuses the existing modal style (`paste-modal` CSS class) but
  with a single-line text input.
- **Open Scenario button** (existing `#open-scenario`) — replaces the
  migration stub with: list `scenarios/` → user picks from a dropdown
  (modal-style chooser) → parse → restore.
- **Auto-save** — out of scope for this spec. The existing `scheduleAutoSave`
  no-op stays a no-op; explicit Save covers the use case.

### Files touched

- `app/lib/scenario.js` — add `attachments` to `buildScenario` /
  `serializeScenario` / `parseScenario`. Add `_instanceId` to each placement
  entry.
- `app/lib/fs-tauri.js` (**new**) — thin wrapper over `tauri-plugin-fs`:
  - `listScenarios()` → `Array<{ slug, name }>` (reads `scenarios/*.md`,
    parses frontmatter for display name).
  - `readScenario(slug)` → markdown text.
  - `writeScenario(slug, md)` → void.
  - Mirrors what `app/lib/fs.js` does for the browser FSA path. The browser
    dev path keeps using FSA via the existing `connectRepoHandle` flow.
- `app/command-auspex.html`:
  - Replace `handlePasteConfirm` and the two migration stubs at lines 1723
    and 1732 (`save-scenario` / `open-scenario` click handlers).
  - Add a name-prompt modal (HTML + CSS reuses `.paste-modal` styling).
  - Add a scenario-picker modal (lists scenarios with name + last-modified).
  - On Load: hydrate `formations.defender`, `formations.attacker`,
    `attachments.defender`, `attachments.attacker`, `lastPlacements` from the
    scenario, then call the existing render path. The existing
    `applyAttachmentsToPlacements`, `unitFormation`, and render code already
    consume these maps — they just need to be populated before the render.

### Behaviour

- Saving a scenario with an existing slug overwrites (the user named it; they
  own the namespace). No prompt-to-confirm — the user invoked Save.
- Loading a scenario replaces all current state. Any unsaved drag positions
  are lost. (Out of scope: a "save before loading" warning. Captain can add
  later if it bites.)
- Slug collisions across user-typed names: silent overwrite. Captain controls
  the names.
- Parsing failures (missing mission file, missing roster, unknown unit slug):
  status bar shows `MACHINE-SPIRIT OBJECTS: <reason>`; partial state is not
  applied — load is all-or-nothing.

### Out of scope

- Auto-save during drag.
- Scenario diff / merge.
- Undo / redo across scenario loads.
- Migrating to user.db (the runtime.js comment about user.db is a future
  milestone; this spec keeps everything filesystem-backed per Captain's
  ruling).

---

## Feature 2 — Vox-scribe parser fix

The vox-scribe paste flow exists end-to-end in the UI but the parse step is
stubbed: `handlePasteConfirm` (line 1762 of command-auspex.html) just prints
a migration message and closes the modal. The parser
(`app/lib/roster-parser.js`) is fully implemented and tested.

This feature wires the existing parser into the existing UI flow, persists
the resulting roster as a filesystem-backed `.md` file, and surfaces it in
the dropdowns alongside catalogue rosters.

### Flow

1. User clicks `+ VOX-SCRIBE DEFENDER` or `+ VOX-SCRIBE ATTACKER`, pastes a
   GW Companion App or New Recruit export, hits Confirm.
2. `parseRoster(text)` produces the structured roster object. Both export
   formats already supported (header detection by `+++` divider line).
3. `slugify(roster.list_name)` → roster slug.
4. `buildRosterMarkdown(roster, '<pasted>')` (already exists at line 1772 of
   command-auspex.html) → roster markdown.
5. Write to `rosters/<slug>.md` via Tauri fs.
6. Refresh defender/attacker dropdowns from the **union** of catalogue
   rosters (`listRosters()`) and filesystem rosters
   (`listFilesystemRosters()`).
7. Auto-select the new roster into the side that opened the modal
   (`pasteTarget`).
8. Status bar: `VOX-SCRIBE INTERCEPTED · <list_name> · <list_points>PT`.

### Dropdown union and roster resolution

The existing dropdown is fed by `listRosters()` against the read-only SQLite
catalogue. After this feature, two roster sources coexist:

- **Catalogue rosters** — bundled with the app, canonical/canonised,
  read-only.
- **Filesystem rosters** — user-pasted, written to `rosters/*.md`.

The union surfaces both. To avoid changes rippling through every consumer of
`getRoster(slug)`:

- `getRoster(slug)` (catalogue.js) gets a fall-through path: if the slug
  isn't in the catalogue, read `rosters/<slug>.md` from the filesystem and
  parse via the existing `parseFrontmatter` flow. Returns the same shape as
  the catalogue path. The shape compatibility is real — `buildRosterMarkdown`
  was written specifically to produce roster markdown that the existing
  `parseFrontmatter`-based flow already consumes (see line 1043 of
  command-auspex.html, the `body_md` path).
- `listRosters()` returns its existing rows plus filesystem rosters merged
  in. Slug collisions: catalogue wins (canonical data takes precedence over
  user paste).

### Files touched

- `app/lib/fs-tauri.js` (same module added in Feature 1):
  - `listFilesystemRosters()` → `Array<{ slug, name, faction_slug, points_cap }>`
    matching the row shape of `listRosters()`.
  - `readFilesystemRoster(slug)` → markdown text.
  - `writeFilesystemRoster(slug, md)` → void.
- `app/lib/catalogue.js`:
  - `listRosters()` — union with filesystem rosters.
  - `getRoster(slug)` — fall-through to filesystem when not in catalogue.
- `app/command-auspex.html`:
  - Rewrite `handlePasteConfirm` to parse → write → refresh → select.
  - Refresh roster dropdowns after a successful paste.

### Error handling

- Malformed paste — `parseRoster` throws. Catch, show
  `MACHINE-SPIRIT OBJECTS: <parser error>`, leave modal open with text
  preserved so Captain can edit and retry.
- Filesystem write failure — same handler, modal stays open.
- Slug collision with a catalogue roster — write succeeds (filesystem
  rosters live alongside, slug just gets shadowed by catalogue when both
  resolve). Status warns: `VOX-SCRIBE STORED · CATALOGUE ROSTER WITH SAME
  SLUG TAKES PRECEDENCE`.

### Out of scope

- Editing existing pasted rosters in-app (open the .md in a text editor).
- Validating that referenced datasheets exist in the catalogue (the
  existing `resolveSlug` path handles unknown units gracefully).
- Browser-dev-mode (FSA) parity — vox-scribe is desktop-only for this
  milestone, matching how scenarios already gate on Tauri.

---

## Feature 3 — Movement-distance line during drag

When the user click-drags a unit, draw a live SVG line from the unit's
pre-drag cluster center to the cursor, with the distance in inches labeled at
the cursor end. Color the line based on the unit's `M` characteristic:

- **Fixed M** (e.g. `6"`): green up to M, red past M.
- **Variable M** (e.g. `D6+2"`): green up to the *minimum* possible roll,
  amber from minimum to maximum, red past maximum.
- **Unparseable M** (`*`, missing): always green; distance label still shown,
  no color flip.

### Movement parsing

`app/lib/movement.js` (**new**) — pure function `parseMovement(mStr)` →
`{ min, max } | null`.

Inputs are the M string from the datasheet profile (e.g. `6"`, `10"`,
`D6+2"`, `2D6"`, `D3+1"`). Strip the `"` suffix and parse:

- Bare integer `N` → `{ min: N, max: N }`.
- `D6+X` → `{ min: 1 + X, max: 6 + X }` (X may be 0 if absent).
- `2D6+X` → `{ min: 2 + X, max: 12 + X }`.
- `D3+X` → `{ min: 1 + X, max: 3 + X }`.
- `D6-X` / `D3-X` — same shape, X may be negative.
- Unparseable / missing → `null` (line stays green).

Tests in `tests/movement.test.js` cover each case plus `*`, empty string,
`undefined`.

### Rendering

`app/lib/render.js` — extend `makeUnitDraggable`:

- On `mousedown`: capture origin (group's pre-drag translate, in SVG inches)
  and read `M` from `group.dataset.movementM`. Compute thresholds via
  `parseMovement(M)`.
- On `mousemove` (when dragging):
  - Compute `dist = hypot(cursor.x - origin.x, cursor.y - origin.y)` in SVG
    inches (the SVG viewBox is in inches per `INCH_PX = 1`).
  - Lazy-create a `<line>` and a `<text>` inside `#layer-movement-ruler`
    (a top-level group on the SVG, created once at board init alongside
    `#layer-units`). Reuse the same elements across drags — just update
    coords, text, and color.
  - Color rules:
    - `thresholds === null` → green (`#6fff8e`).
    - `dist <= min` → green.
    - `min < dist && (max === min || dist <= max)` → for fixed M
      (`max === min`), this branch is unreachable, so red. For variable M,
      amber (`#ffb347`).
    - `dist > max` → red (`#ff5d6c`).
  - Label format: `<dist.toFixed(1)>"` (e.g. `4.2"`). Same color as line.
- On `mouseup`: hide the line and label (set `display:none` rather than
  removing — keeps DOM stable across rapid re-drags).

### M data flow

`renderUnit` in `app/lib/render.js` already receives `datasheet` per
placement. Add `group.dataset.movementM = datasheet?.profile?.M ?? ''` when
the unit group is created. The drag handler reads it back when the drag
starts.

### Files touched

- `app/lib/movement.js` (**new**) — `parseMovement` pure function.
- `app/lib/render.js` — `renderUnit` sets `dataset.movementM`;
  `makeUnitDraggable` draws + updates the ruler line; `renderBoard` (or
  `renderUnits` first invocation) creates the `#layer-movement-ruler` group.
- `tests/movement.test.js` (**new**) — unit tests for `parseMovement`.

### Behaviour

- Dragging from a unit with no datasheet (shouldn't happen, but defensive) —
  line stays green throughout.
- Drag-cancel (mouseup with `__dragged === false`, i.e. a click) — line
  never gets shown because `mousemove` never fired.
- Re-dragging the same unit twice — origin re-anchors to the unit's CURRENT
  position each time, not the original deployment position. (The line
  measures *this* drag, not cumulative movement.)

### Out of scope

- Cumulative movement tracking across turns (a "moved this turn" buffer).
- Charge / Advance distance (M+D6 etc.) — Captain ruled this out; this is a
  movement ruler, not a turn-phase tool.
- Snap-to-grid or measurement helpers beyond the live readout.
- Path-aware measurement (around terrain). Straight-line only.

---

## Implementation order

The three features are independent. Recommended order based on incremental
value:

1. **Vox-scribe** (smallest blast radius, Captain blocked from importing
   lists today).
2. **Movement line** (pure visual, no persistence).
3. **Scenario save/load** (largest, depends on no other work).

Each ships as its own commit / PR.

## Provenance

- Designed 2026-04-29 with Captain Hunter.
- Replaces the dormant scenario-save flow in `app/lib/scenario.js` (already
  partially built — adds `attachments`, wires the stubbed handlers).
- Replaces the stub at `app/command-auspex.html:1762` (vox-scribe).
- Builds on existing per-unit-instance state machinery (commit a647286).
