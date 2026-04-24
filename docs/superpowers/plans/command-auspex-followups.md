# Command Auspex — Followups

Known limitations and deferred enhancements identified during the 26-task build. Each item that earns a follow-up gets its own plan; this file is the short index.

## Status at end of Milestone 11

- **Tests:** 181/181 passing (`npm test`)
  - yaml-frontmatter: 6
  - fs: 3
  - roster-parser: 9
  - datasheet-parser: 7
  - base-geometry: 4
  - geometry: 4
  - auto-placement: 2
  - scenario: 3
  - e2e-smoke: 8
  - all-datasheets sweep: 135 (3 × 45 files)
- **Live-browser smoke** passed via Playwright MCP — all controls render, liturgy applied, reticles visible. Screenshot: `docs/screenshots/command-auspex-boot.png`.
- **Captain's workflow** (CONNECT REPO → select mission + rosters → ENGAGE → drag → COMMIT TO ARCHIVE → RECALL SCENARIO) requires manual verification in Chrome with repo access granted — not automatable via headless browser.

## Deferred

### ~~Paste-to-resolve datasheet slugs (Task 20 follow-up)~~ ✅ Done `f2d80e8`
~~Browser `buildRosterMarkdown` emits `datasheet: null` for every unit.~~
Shipped: `slugify` + `resolveSlug` in `app/lib/roster-parser.js`; `listDatasheetCandidates` in `app/command-auspex.html` walks `datasheets/*/units/*.md` via FSA; invoked in `handlePasteConfirm`. 15/16 Norallus units auto-resolve.

### Per-model base mixed-size rendering (Task 9 follow-up)
`renderUnit` reads `datasheet.base.diameter_mm` once and applies it to every model in the unit. Wardens of Ultramar has 6 named models with mixed 40mm / 28.5mm bases. They currently render all at a single base size.

**Scope:** Extend the datasheet parser to emit `base.per_model: [{ submodel, shape, diameter_mm }]` when a `## Base` section contains a table; have `renderUnit` look up each model's specific base.

### Post-drag save captures SVG transform delta — but not zoom/pan
Task 19 adds drag-delta capture to SAVE. If we later add board zoom or pan, the transform math needs to account for viewport scale. Not an issue today.

### Coherency layer is empty
Task 15 reserved `#layer-coherency` as a debug layer. Nothing populates it. Future task: draw 2" coherency bubbles around each unit when toggled on.

### Threat ranges use longest weapon only
`datasheet.max_range_in` is the single longest-ranged weapon. Units with both a 24" and a 48" weapon only show the 48" ring. A future enhancement could draw concentric rings per weapon range.

### ~~Scenario save is write-through, no confirmation on overwrite~~ ✅ Done `7fc73e2`
Shipped: `fileExists(root, path)` in `app/lib/fs.js`; explicit save handler calls `confirm()` before overwriting. Auto-save (see below) deliberately bypasses the confirm — it writes to a known, user-sanctioned path.

### Attacker split across multiple deployment polygons is random
Purge and Burn's attacker has two corner triangles. The current logic shuffles the unit list and halves it. A smarter split (e.g., balance by points, or keep units with shared transport together) would be a real enhancement.

### ~~No auto-persistence~~ ✅ Done `1c766a1` (+ `01e751f` name-preservation fix)
Shipped: once a scenario is explicitly saved or recalled, every drag-end schedules a 500ms debounced silent re-write to the same file. `currentScenarioPath` + `currentScenarioName` track the target; `buildCurrentScenarioMarkdown` shared between explicit and auto paths. Status flashes "AUTO-SCRIBED" for 1500ms. Auto-save is a no-op before the first explicit save.

### YAML injection in scenario serialization (surfaced by auto-save review)
`app/lib/scenario.js` `serializeScenario` wraps `name`, `id`, paths, and `owner` fields in double quotes but does NOT escape `"` or `\` in the values. A scenario name containing a double quote (reachable via the explicit save `prompt()`) produces invalid YAML. Auto-save re-writes the same bad payload on every drag, so the file stays broken.

**Scope:** Add a `yamlString(s)` helper in `scenario.js` that escapes `\` then `"`; use it for every string scalar (mirrors the Python `_yaml_str` in `scripts/parse_gw_roster.py`). Apply to `id`, `name`, `mission`, `defender.roster`, `attacker.roster`, `defender.owner`, `attacker.owner`, and each placement's `unit_name`.

### Auto-save race on tab close within 500ms (working as designed)
If the Captain drags and immediately closes the tab within 500ms, the debounced write never fires. Trade-off for a local single-user tool — not worth a `beforeunload` handler unless it bites in practice.

## Known non-issues (flagged but working as designed)

- `@playwright/test` not installed. The Milestone 11 plan called for it; I substituted a lightweight `tests/e2e-smoke.test.js` that runs via `node --test` and a live-browser verification via Playwright MCP. Rationale: 250MB install for two smoke tests against a static HTML file is overkill.
- `app/lib/bootstrap.js` is unreferenced (the Task 1 scaffold ES-module loader was superseded by the full script block in Task 3). Leaving it in place for now; can be deleted in a cleanup pass.
- `parseRoster` was imported from Task 9 onward but only consumed starting Task 20. That's intentional — the plan intended the import to be present early.
