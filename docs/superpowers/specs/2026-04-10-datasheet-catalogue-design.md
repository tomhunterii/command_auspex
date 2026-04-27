# Datasheet Catalogue — Design Spec

## Overview

A local reference catalogue of Warhammer 40,000 10th Edition datasheets, structured as Markdown files. The catalogue stores complete rules data — stat lines, weapon profiles, abilities, keywords, detachment rules, stratagems, enhancements, and faction-wide rules — for units the Captain fields or faces on the tabletop. It serves as a full rules reference and eliminates the need to web-search datasheets for damage calculations or rules lookups.

This is separate from the Chapter Roster (`ultramarines/`), which tracks hobby progress and organisational structure without game mechanics.

## Format

All files are Markdown. All tables use consistent column padding so content aligns cleanly under headers when viewed as raw text. This matches the convention established in the Chapter Roster spec.

## Directory Structure

```
datasheets/
  space-marines/
    faction-rules.md
    detachments/
      blade-of-ultramar.md
    weapons/
      common-ranged.md
      common-melee.md
    captain-titus.md
    cato-sicarius.md
    lieutenant.md
    marneus-calgar.md
    roboute-guilliman.md
    intercessor-squad.md
    ballistus-dreadnought.md
    redemptor-dreadnought.md
    reiver-squad.md
    repulsor-executioner.md
    sternguard-veteran-squad.md
    victrix-honour-guard.md
    wardens-of-ultramar.md
    index.md
  tyranids/
    faction-rules.md
    detachments/
    weapons/
      common-ranged.md
      common-melee.md
    trygon.md
    tyrannofex.md
    index.md
```

New factions and units are added incrementally as the Captain requests them. Each faction directory follows the same structure.

## File Descriptions

### Faction Index (index.md)

A reference table listing all catalogued units in the faction with points and a file link. One per faction.

```markdown
# Space Marines — Datasheet Index

| Unit                      | Role       | Points | File                          |
|---------------------------|------------|--------|-------------------------------|
| Captain Titus             | Character  | 90     | captain-titus.md              |
| Sternguard Veteran Squad  | Other      | 200    | sternguard-veteran-squad.md   |
```

### Faction Rules (faction-rules.md)

Army-wide rules that apply to every unit in the faction. One per faction.

```markdown
# Space Marines — Faction Rules

## Oath of Moment

At the start of your Command phase, select one unit from your opponent's army. Until the start of your next Command phase, each time a model from your army with this ability makes an attack that targets that unit, you can re-roll the Hit roll.
```

For Tyranids, this would include Synapse, Shadow in the Warp, and similar army-wide rules.

### Detachment Files (detachments/*.md)

One file per detachment. Contains the detachment rule, all stratagems, and all enhancements.

#### Detachment Rule Section

```markdown
# Blade of Ultramar

## Detachment Rule: [Rule Name]

[Full rules text]
```

#### Stratagems Section

```markdown
## Stratagems

| Name           | CP | Phase     | Target                            |
|----------------|----|-----------|-----------------------------------|
| [Strat Name]   | 1  | Shooting  | One Adeptus Astartes unit...      |

### [Stratagem Name]

**Cost:** 1 CP | **Phase:** [Phase] | **When:** [Timing]
**Target:** [Target restrictions]
**Effect:** [Full rules text]
```

Each stratagem gets a heading with full text below the summary table, so the table provides a quick-reference overview and the headings provide full detail.

#### Enhancements Section

```markdown
## Enhancements

| Name                   | Points | Restriction                    |
|------------------------|--------|--------------------------------|
| Armour of Antoninus    | 15     | Adeptus Astartes model only    |

### Armour of Antoninus

**Points:** 15
**Restriction:** [Restriction text]
**Effect:** [Full rules text]
```

Same pattern: summary table plus full detail per entry.

### Common Weapons (weapons/*.md)

Shared weapon profiles that appear identically across multiple unit datasheets. Avoids duplicating the same profile (e.g., bolt rifle, power fist, storm bolter) in every unit file.

Two files per faction:
- `common-ranged.md` — shared ranged weapon profiles
- `common-melee.md` — shared melee weapon profiles

```markdown
# Space Marines — Common Ranged Weapons

| Weapon               | Range | A | BS | S | AP | D | Keywords              |
|----------------------|-------|---|----|---|----|---|-----------------------|
| Bolt pistol          | 12"   | 1 | 3+ | 4 | 0  | 1 | Pistol                |
| Bolt rifle           | 24"   | 2 | 3+ | 4 | -1 | 1 | Assault, Heavy         |
| Heavy bolt pistol    | 18"   | 1 | 3+ | 4 | -1 | 1 | Pistol                |
| Storm bolter         | 24"   | 2 | 3+ | 4 | 0  | 1 | Rapid Fire 2          |
| Twin storm bolter    | 24"   | 4 | 3+ | 4 | 0  | 1 | Rapid Fire 4, Twin-linked |
```

**BS/WS convention:** Common weapons use the most typical BS/WS for the faction (3+ for Space Marine troops). Unit datasheets that differ (e.g., Characters at BS 2+) note the override in their own weapon tables. The unit datasheet is always authoritative; the common weapons file is a convenience reference.

Unit datasheets always include the full weapon profile in their own tables for self-containment — each datasheet is readable without cross-referencing other files. The common weapons file is a convenience index for quickly looking up standard profiles, not a replacement for per-unit data. Unit-specific weapon variants (e.g., Sternguard bolt rifle vs standard bolt rifle) are always listed in full on the unit datasheet.

### Unit Datasheets (*.md)

Each unit gets its own file. The file contains every piece of rules information on the official datasheet.

#### Template Structure

```markdown
# [Unit Name]

**Points:** [N] | **Role:** [Battlefield Role]

**Keywords:** [Unit keywords, comma-separated]
**Faction Keywords:** [Faction keywords]

## Stat Line

| Model          | M   | T | Sv  | W | Ld  | OC | Inv | FNP |
|----------------|-----|---|-----|---|-----|----|-----|-----|
| [Model name]   | 6"  | 4 | 3+  | 4 | 6+  | 1  | —   | —   |

Single-profile units use one row without the Model column. Multi-profile units (e.g., Wardens of Ultramar with Marines and humans) use one row per profile with the Model column identifying which models use that line.

Inv and FNP columns use a dash (—) when the unit has no invulnerable save or feel no pain.

## Ranged Weapons

| Weapon                  | Range | A  | BS | S | AP | D | Keywords                                     |
|-------------------------|-------|----|----|---|----|---|----------------------------------------------|
| [Weapon name]           | 24"   | 2  | 3+ | 4 | -1 | 1 | Assault, Devastating Wounds, Heavy, Rapid Fire 1 |

For weapons that match the common weapons file exactly, include the profile here anyway for self-containment — each datasheet should be readable without cross-referencing other files. The common weapons file exists as a deduplication reference, not as a replacement for per-unit data.

## Melee Weapons

| Weapon                  | A  | WS | S | AP | D | Keywords         |
|-------------------------|----|----|---|----|---|------------------|
| [Weapon name]           | 4  | 3+ | 4 | 0  | 1 |                  |

## Abilities

**Core:** [Core abilities, comma-separated]
**Faction:** [Faction ability name]

### [Ability Name]

[Full rules text of each unique ability, as a separate heading.]

## Damaged (if applicable)

**Threshold:** 1-[N] wounds remaining
**Effect:** [Effect text, e.g., "subtract 1 from Hit rolls"]

## Leader (if Character)

This model can be attached to the following units:
- [Unit name]
- [Unit name]

## Wargear Options

- [Option text as written on the datasheet]

## Unit Composition

- [N]x [Model name] — equipped with: [default wargear list]
```

#### Multi-Profile Units

Units where different models have different stat lines (e.g., Wardens of Ultramar) use a Model column in the stat line table:

```markdown
## Stat Line

| Model                     | M   | T | Sv  | W | Ld  | OC | Inv | FNP |
|---------------------------|-----|---|-----|---|-----|----|-----|-----|
| Ancient Gadriel           | 6"  | 4 | 3+  | 4 | 6+  | 1  | —   | —   |
| Veteran Sergeant Metaurus | 6"  | 4 | 3+  | 4 | 6+  | 1  | 4+  | —   |
| Gaius Silva               | 6"  | 3 | 4+  | 3 | 6+  | 1  | 5+  | —   |
| Aemelia Minervas          | 6"  | 3 | 4+  | 3 | 6+  | 1  | —   | —   |
| Dainal Kornelius          | 6"  | 3 | 4+  | 3 | 6+  | 1  | —   | —   |
| Lucia Vestha              | 6"  | 3 | 4+  | 3 | 6+  | 1  | —   | —   |
```

Weapon tables include all weapons across all models. Where a weapon is specific to one model, note the model name in a parenthetical after the weapon name.

#### Variable Attacks / Damage

Weapons with variable characteristics use the notation as printed: D6, D3, D6+1, etc. These are not averaged — they are recorded exactly as on the datasheet.

#### Degrading Profiles

Units with degrading stats use the Damaged section rather than multiple stat line rows. The stat line shows full-health values.

## Initial Catalogue Scope

### Space Marines (Ultramarines)

Seeded from the Captain's 2,000-point Blade of Ultramar Strike Force:

**Characters:**
- Captain Titus (90 pts)
- Cato Sicarius (95 pts)
- Lieutenant (65 pts)
- Marneus Calgar in Armour of Antilochus (140 pts)
- Roboute Guilliman (340 pts)

**Battleline:**
- Intercessor Squad (80 pts)

**Other:**
- Ballistus Dreadnought (150 pts)
- Redemptor Dreadnought (205 pts)
- Reiver Squad (80 pts)
- Repulsor Executioner (230 pts)
- Sternguard Veteran Squad (200 pts)
- Victrix Honour Guard (220 pts)
- Wardens of Ultramar (105 pts)

**Detachment:**
- Blade of Ultramar (detachment rule, stratagems, enhancements)

**Faction Rules:**
- Oath of Moment

**Common Weapons:**
- Bolt pistol, bolt rifle, heavy bolt pistol, close combat weapon, power weapon, storm bolter, twin storm bolter, and other profiles shared across multiple units

### Tyranids

Seeded from damage calculations performed in this session:

**Units:**
- Trygon (140 pts)
- Tyrannofex (200 pts)

**Faction Rules:**
- Synapse

**Common Weapons:**
- Any shared bio-weapon profiles across Trygon and Tyrannofex

## Data Sourcing

Datasheet data is sourced from the official Warhammer 40,000 10th Edition rules via web lookup at the time of creation. Sources include Wahapedia, NewRecruit, Games Workshop official datasheets, and community review articles. Each file records the date it was last verified in a footer comment.

```markdown
<!-- Last verified: 2026-04-10 -->
```

## Table Formatting

All Markdown tables use consistent column padding matching the Chapter Roster convention. Column widths are set so all entries align cleanly under their respective headers when viewed as raw Markdown.
