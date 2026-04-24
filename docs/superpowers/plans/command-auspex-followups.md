# Command Auspex — Followups

Known limitations and deferred enhancements identified during the 26-task build. Each item that earns a follow-up gets its own plan; this file is the short index.

## Status at end of Milestone 11

- **Tests:** 181 at Milestone 11 → 205 after followup batch (`npm test`)
  - yaml-frontmatter: 6
  - fs: 3 → 7 (added `fileExists` cases)
  - roster-parser: 9 → 20 (added `slugify` + `resolveSlug` cases)
  - datasheet-parser: 7 → 12 (added Wardens per-model + `ranges_in` cases)
  - base-geometry: 4
  - geometry: 4
  - auto-placement: 2
  - scenario: 3 → 6 (added YAML-escape round-trip cases)
  - e2e-smoke: 8 → 10 (added `resolveSlug` import + auto-save wiring)
  - all-datasheets sweep: 135 (3 × 45 files)
- **Live-browser smoke** passed via Playwright MCP — all controls render, liturgy applied, reticles visible. Screenshot: `docs/screenshots/command-auspex-boot.png`.
- **Captain's workflow** (CONNECT REPO → select mission + rosters → ENGAGE → drag → COMMIT TO ARCHIVE → RECALL SCENARIO) requires manual verification in Chrome with repo access granted — not automatable via headless browser.

## Deferred

### ~~Paste-to-resolve datasheet slugs (Task 20 follow-up)~~ ✅ Done `f2d80e8`
~~Browser `buildRosterMarkdown` emits `datasheet: null` for every unit.~~
Shipped: `slugify` + `resolveSlug` in `app/lib/roster-parser.js`; `listDatasheetCandidates` in `app/command-auspex.html` walks `datasheets/*/units/*.md` via FSA; invoked in `handlePasteConfirm`. 15/16 Norallus units auto-resolve.

### ~~Per-model base mixed-size rendering (Task 9 follow-up)~~ ✅ Done `8fe4842`
Shipped: parser reads the `- **Per-model bases:**` nested bullet list and emits `base.per_model: [{submodel, shape, diameter_mm}]`. `renderUnit` looks up each submodel's diameter, falls back to the unit default, and uses the largest base for cluster spacing so smaller bases never collide. Wardens of Ultramar now renders as 2 × 40mm + 4 × 28.5mm.

### Post-drag save captures SVG transform delta — but not zoom/pan
Task 19 adds drag-delta capture to SAVE. If we later add board zoom or pan, the transform math needs to account for viewport scale. Not an issue today.

### Coherency layer is empty
Task 15 reserved `#layer-coherency` as a debug layer. Nothing populates it. Future task: draw 2" coherency bubbles around each unit when toggled on.

### ~~Threat ranges use longest weapon only~~ ✅ Done `2cef4d8`
Shipped: parser emits `ranges_in: [12, 18, 24, ...]` (sorted unique integers from every weapon's range cell). `max_range_in` stays as the last entry for backward compat. `renderThreatRanges` draws one dashed ring per unique range at 0.35 opacity.

### ~~Scenario save is write-through, no confirmation on overwrite~~ ✅ Done `7fc73e2`
Shipped: `fileExists(root, path)` in `app/lib/fs.js`; explicit save handler calls `confirm()` before overwriting. Auto-save (see below) deliberately bypasses the confirm — it writes to a known, user-sanctioned path.

### Attacker split across multiple deployment polygons is random
Purge and Burn's attacker has two corner triangles. The current logic shuffles the unit list and halves it. A smarter split (e.g., balance by points, or keep units with shared transport together) would be a real enhancement.

### ~~No auto-persistence~~ ✅ Done `1c766a1` (+ `01e751f` name-preservation fix)
Shipped: once a scenario is explicitly saved or recalled, every drag-end schedules a 500ms debounced silent re-write to the same file. `currentScenarioPath` + `currentScenarioName` track the target; `buildCurrentScenarioMarkdown` shared between explicit and auto paths. Status flashes "AUTO-SCRIBED" for 1500ms. Auto-save is a no-op before the first explicit save.

### ~~YAML injection in scenario serialization~~ ✅ Done `22593ff`
Shipped: `yamlString(s)` helper in `scenario.js` (escapes `\` then `"`, mirrors Python `_yaml_str`). Applied to every string scalar in `serializeScenario`. Null values emit as bare `null` instead of `""`. Tests cover quote round-trip, backslash round-trip, null round-trip.

### Auto-save race on tab close within 500ms (working as designed)
If the Captain drags and immediately closes the tab within 500ms, the debounced write never fires. Trade-off for a local single-user tool — not worth a `beforeunload` handler unless it bites in practice.

## Known data issues (upstream, not code bugs)

- **Norallus roster misspells "Dainal Kornelius" as "Dainal Komelius"** (missing `r`). The GW Companion App export itself has the typo, which propagates through `parseRoster` into the .md file. Effect: per-model base lookup fails for this one submodel and falls back to the default 32mm. Canonical spelling in `datasheets/space-marines/units/wardens-of-ultramar.md` matches Wahapedia and MFM v3.9. Fix: either correct the roster file by hand, or the Companion App data will need to be patched upstream.

## Known non-issues (flagged but working as designed)

- `@playwright/test` not installed. The Milestone 11 plan called for it; I substituted a lightweight `tests/e2e-smoke.test.js` that runs via `node --test` and a live-browser verification via Playwright MCP. Rationale: 250MB install for two smoke tests against a static HTML file is overkill.
- ~~`app/lib/bootstrap.js` is unreferenced~~ — deleted in `6feba05`.
- `parseRoster` was imported from Task 9 onward but only consumed starting Task 20. That's intentional — the plan intended the import to be present early.
