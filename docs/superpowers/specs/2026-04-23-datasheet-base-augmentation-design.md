# Datasheet Base Augmentation — Design

**Date:** 2026-04-23
**Author:** Venator (on behalf of Captain Hunter)
**Phase:** 1 of a multi-phase Tactical Projection Application effort.

## Purpose

Populate the one missing data field across the existing datasheet archive so downstream phases (mission ingestion → renderer → drag interaction) can draw units at true 1:1 scale with correct footprints.

The tactical projection application being built in subsequent phases requires per-unit base size, base shape (round/oval), and a flight-stem indicator in order to render each model at accurate scale against a mission map. None of this data exists in the current datasheets.

## Scope

**In scope — 44 unit datasheets total:**

- 33 Space Marines unit sheets in `datasheets/space-marines/units/`
- 11 Tyranid unit sheets in `datasheets/tyranids/units/`

**Out of scope:**

- Detachment files, weapon files, faction-rules files.
- Other factions (not currently in the archive).
- Army roster files.
- Any datasheet field other than base data.

## Data Model

A new `## Base` section inserted into each datasheet **after the `## Keywords` section and before the `## Profile` section**. The section uses the following template:

### Round base (standard)

```markdown
## Base

- **Shape:** round
- **Diameter:** 32mm
- **Flight stem:** no
```

### Oval base

```markdown
## Base

- **Shape:** oval
- **Dimensions:** 105mm × 70mm  (length × width)
- **Flight stem:** no
```

### Flight stem

```markdown
## Base

- **Shape:** round
- **Diameter:** 50mm
- **Flight stem:** yes
```

### Optional Notes

A `- **Notes:** <text>` bullet may be appended when the base is ambiguous, when the kit ships with alternate bases, or when a Captain's ruling deviates from Wahapedia. Only present on sheets where it is needed.

## Source of Truth

**Wahapedia** current-edition base sizes. Each unit page lists base size in its header block; this is upstream-sourced from Games Workshop's official Base Size document and the current edition codex.

Captain's actual model-collection bases **may diverge** from Wahapedia for legacy models. This is explicitly accepted as out of scope for Phase 1; Phase 1 records Wahapedia as the canonical value.

## Execution Flow

1. **Reconnaissance pull (first servoskull).** A subagent queries all 44 Wahapedia unit pages, extracts shape + dimensions + flight-stem status for each, and returns a structured report. Any unit for which Wahapedia omits a base size or provides multiple options is **flagged** for Captain confirmation rather than guessed.

2. **Flag resolution.** Captain rules on each flagged entry. Rulings may reference notes in the optional bullet.

3. **Markdown edits.** Venator applies the confirmed base data to each `.md` file by inserting the `## Base` section between `## Keywords` and `## Profile`. Existing content is not otherwise modified.

4. **Verification (second servoskull, per standing order).** An independent agent re-fetches Wahapedia for all 44 units, diffs against the committed markdown, and reports any discrepancies. Captain's final ruling resolves any diff.

5. **Commit.** Two commits:
   - `datasheet: add Base section to Space Marines units (33)`
   - `datasheet: add Base section to Tyranid units (11)`

## Deliverables

- 44 modified `.md` files, each containing a well-formed `## Base` section.
- A flag/discrepancy report retained in the plan artifact or commit body.

## Non-Goals (Explicitly Deferred)

- Compiled JSON/YAML artefact for machine consumption. Phase 2 (renderer) will either parse the markdown directly at load time or emit a compiled artefact at app build time. Phase 1 produces source-of-truth only.
- Per-model base overrides within a unit. None of the 44 current units need them.
- Recording Captain's physical model-collection base sizes where they diverge from Wahapedia.
- Augmenting any field beyond base data.
- Any work on missions, renderers, rosters, or interaction layers.

## Risks & Known Edge Cases

- **Old-pattern Dreadnoughts.** Wahapedia may list current oval (e.g., 80×105mm); older kits shipped on 60mm round. Policy: record Wahapedia value. If Captain's model is on a different base, a `- **Notes:**` bullet captures it — but only on Captain's explicit ruling.
- **Winged vs walking Hive Tyrant.** Single datasheet, two configurations with different bases. Flag on encounter; resolution may require a notes line.
- **Units missing from Wahapedia's base field.** Expect 0–3 edge cases across 44 entries. Flag and escalate.

## Success Criteria

- All 44 sheets contain a well-formed `## Base` section parseable by a simple line scanner.
- Second-servoskull verification reports zero unresolved discrepancies.
- Existing sheet content unchanged outside the new section.
- Commits are clean and faction-split.

## Downstream Consumers

Phase 2 (Mission Ingestion — Purge and Burn) will not consume base data directly, but Phase 5 (Battlefield Renderer) will. The format chosen here must be parseable by a simple line/regex scanner; no hidden structure, no ambiguity in field names. Any change to this format in future phases should be treated as a breaking change against the Phase 5 parser contract.
