# scripts/

Repository tools for Warhammer 40K data management.

## `parse_gw_roster.py`

Parses a Games Workshop Companion App roster export (plain text) into a structured YAML frontmatter + markdown file.

### Usage

```bash
# Save your export from the GW Companion App to a .txt file:
ultramarines/rosters/<slug>.txt

# Parse it (writes <slug>.md beside it):
python3 scripts/parse_gw_roster.py ultramarines/rosters/<slug>.txt
```

Flags:
- `-o, --output <path>` — custom output path (default: `<input>.md`)
- `--stdout` — print to stdout instead of writing a file
- `--datasheets <dir>` — override datasheets directory (default: `datasheets/`)

### What it does

1. **Parses the export** — header block (list name, points, faction, detachment, battle size), section dividers (`CHARACTERS`, `DEDICATED TRANSPORTS`, `OTHER DATASHEETS`, etc.), per-unit blocks with Warlord / Enhancement flags, single-model and multi-model wargear.
2. **Resolves datasheet slugs** — for each unit, tries to find a matching file in `datasheets/<faction>/units/<slug>.md`. Auto-fills the `datasheet:` field. Unresolved units get `null` and are listed at the top of the output body for the Captain to correct.
3. **Preserves the raw export text** — pair the `.txt` (raw) and `.md` (parsed + prose) files in the same folder.

### Schema of the emitted frontmatter

```yaml
list_name: "Purge and Burn"
list_points: 1995
faction: "Space Marines"
subfaction: "Ultramarines"
detachment: "Orbital Assault Force"
battle_size:
  name: "Strike Force"
  max_points: 2000
export:
  app_version: "v1.51.1 (1)"
  data_version: "v767"

units:
  - name: "Aggressor Squad"          # exported name (verbatim)
    datasheet: "space-marines/aggressor-squad"   # resolved slug, or null
    section: "OTHER DATASHEETS"
    points: 190
    warlord: false
    enhancement: null
    total_models: 6
    models:
      - submodel: "Aggressor Sergeant"
        count: 1
        wargear:
          - { count: 1, item: "Auto boltstorm gauntlets" }
          - { count: 1, item: "Fragstorm grenade launcher" }
          - { count: 1, item: "Twin power fists" }
      - submodel: "Aggressor"
        count: 5
        wargear:
          - { count: 5, item: "Auto boltstorm gauntlets" }
          - { count: 5, item: "Fragstorm grenade launcher" }
          - { count: 5, item: "Twin power fists" }
```

### Design principles

- **No stat duplication.** The roster captures *choices* (what wargear, how many models, which enhancement). Stats live in the datasheet file. UI joins them at render time.
- **Format-accurate verbatim names.** The `name:` and `item:` strings are copied from the export without normalisation — preserves the export-as-source-of-truth contract.
- **Auto-resolution best-effort.** Slugification handles the common case; Epic Heroes and custom unit names may need manual correction of the `datasheet:` field.
- **No runtime database.** Datasheets are live-parsed from markdown on demand. Compile to a JSON index only if performance demands it (YAGNI).
