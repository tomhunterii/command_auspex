# Command Auspex

A list-building battle simulator for Warhammer 40,000 (10th Edition). Build rosters, deploy forces on a tactical map, and resolve attack sequences against accurate datasheet rules.

## Download (Windows)

**[⬇ Download the latest Windows installer](https://github.com/tomhunterii/command_auspex/releases/latest)**

The link above always points to the newest release. On the release page, scroll to **Assets** and download the `.exe` file (e.g. `Command.Auspex_X.Y.Z_x64-setup.exe`).

### First launch

The installer is unsigned. Windows SmartScreen will warn *"Windows protected your PC"* — click **More info** → **Run anyway**. This is expected for unsigned binaries.

## What it does

Command Auspex is a desktop tactical hololith for 40k. It bundles three things into one workflow:

### 1. Roster management
Rosters are plain Markdown files with YAML frontmatter — human-readable, editable, version-controllable. Each unit references a datasheet from the local catalogue (datasheets are similarly Markdown-based, parsed on load). Leader attachments, weapon loadouts, enhancements, and detachment rules are all resolved automatically against 10th Ed rules.

### 2. Tactical map deployment
Load a scenario (e.g. *Purge and Burn*) and drop your force onto a measured battlefield. Models render at correct base sizes, with auto-placement helpers for unit cohesion. Pan, zoom, and reposition individual models or whole units.

### 3. Attack-sequence simulator
Pick an attacker unit, pick a defender unit, and resolve the full 10th Ed attack sequence — Hit → Wound → Save → Damage — with all keyword interactions handled correctly:

- Lethal Hits, Sustained Hits, Devastating Wounds, Twin-Linked, Torrent
- Indirect Fire (–1 to hit, no automatic cover)
- Precision (bypasses Look Out, Sir to target leaders)
- Anti-X, Heavy, Rapid Fire, Melta, Blast
- Plasma overcharge / strike-vs-sweep / witchfire profile pickers
- Cover, stealth, benefit-of-cover positional checks
- Leader attachments on both attacker and defender sides

Output is a per-roll breakdown plus aggregate damage expectation, so you can stress-test list interactions before they hit the table.

## Workflow at a glance

```
build roster (.md)  →  pick scenario  →  place models on map  →  select attacker + defender  →  resolve attacks
```

## Tech

Tauri 2 (Rust shell + web frontend). Datasheets and rosters are stored as Markdown. SQLite catalogue is built at packaging time from the datasheet folder.
