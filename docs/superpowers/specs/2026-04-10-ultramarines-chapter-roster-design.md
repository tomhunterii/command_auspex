# Ultramarines Chapter Roster — Design Spec

## Overview

A complete organisational roster for the Ultramarines Chapter, structured per the Codex Astartes as interpreted in Warhammer 40,000 10th Edition. The roster captures the full Chapter — all 10 companies, Chapter Command, and specialist corps — with named lore characters populated regardless of model ownership. The timeline is set immediately after the events of *Space Marine 2*, with Demetrian Titus assuming command of the 2nd Company.

This is a hobby-tracking and organisational document. No points values or game-mechanical data are included. Strike force construction and points evaluation will be handled separately.

## Format

All files are Markdown. All tables use consistent column padding so that content aligns cleanly under headers when viewed as raw text.

## Directory Structure

```
ultramarines/
  chapter-overview.md
  chapter-command.md
  librarius.md
  reclusiam.md
  apothecarion.md
  armoury.md
  1st-company.md
  2nd-company.md
  3rd-company.md
  4th-company.md
  5th-company.md
  6th-company.md
  7th-company.md
  8th-company.md
  9th-company.md
  10th-company.md
```

## File Descriptions

### chapter-overview.md

Top-level reference for the Chapter. Contains:

- Chapter identity (homeworld, fortress monastery, Primarch, Chapter Master, founding, battle cry)
- Company table with designation, captain, and file link for each company
- Specialist corps table with leader and file link
- Collection status summary table (manually updated counts per status stage)

### chapter-command.md

Chapter-level leadership above any single company:

- Primarch (Roboute Guilliman) — returned and active; supreme commander of the Ultramarines and Imperium Sanctus
- Chapter Master (Marneus Augustus Calgar)
- Victrix Honour Guard (Victrix Ancient carrying the Chapter Banner, Victrix Champion)
- Honour Guard (if additional members are known from lore)

### Specialist Corps Files

#### librarius.md
- Chief Librarian (Varro Tigurius)
- Epistolaries, Codiciers, Lexicanums
- Known named Librarians from lore
- Company assignment noted per individual

#### reclusiam.md
- Master of Sanctity (Ortan Cassius)
- Chaplains by rank
- Known named Chaplains from lore
- Company assignment noted per individual

#### apothecarion.md
- Chief Apothecary
- Apothecaries by rank
- Known named Apothecaries from lore
- Company assignment noted per individual

#### armoury.md
- Master of the Forge
- Techmarines (with company assignment noted)
- Chapter vehicle pool (Repulsors, Impulsors, Gladiators, Land Raiders, etc.)
- Dreadnoughts not assigned to a specific company

### Company Files (1st–10th)

Each company file follows a consistent template.

#### Company Header

- Company name, number, and honorific title
- Captain
- Company Ancient
- Company Champion
- Lieutenants

#### Squad Sections

Squads grouped by battlefield role:

- Battleline Squads
- Close Support Squads
- Fire Support Squads

Each squad is named by its Sergeant (per Codex convention). Individual marines have a row in a table.

#### Attached Assets

Vehicles, Dreadnoughts, or other units assigned to the company.

#### Company-Specific Notes

- **1st Company (Veterans):** Terminators, Sternguard Veterans, Vanguard Veterans, Bladeguard Veterans. All members have earned the Crux Terminatus.
- **2nd–5th Companies (Battle Companies):** Full mix of Battleline, Close Support, and Fire Support squads. 2nd Company commanded by Demetrian Titus post-*Space Marine 2*.
- **6th–7th Companies (Battleline Reserve):** Battleline squads held in reserve.
- **8th Company (Close Support Reserve):** Close Support squads held in reserve.
- **9th Company (Fire Support Reserve):** Fire Support squads held in reserve.
- **10th Company (Scout Company):** Scout Squads and Vanguard infiltration units (Reivers, Incursors, Infiltrators).

## Specialist Corps and Company Assignment

Chaplains, Apothecaries, Librarians, and Techmarines are listed only in their respective corps file (single source of truth). Each entry includes a company assignment field. Company files may reference attached specialists but do not duplicate the entry.

## Lore Characters

All known named characters from codexes, novels, and *Space Marine 2* are pre-populated in their canonical positions regardless of model ownership. This includes named captains, sergeants, lieutenants, chaplains, librarians, apothecaries, techmarines, and notable battle-brothers. Characters without models are candidates for future kitbashing.

## Model Entry Format

Each individual model (marine, vehicle, or character) is tracked with the following fields:

| Field   | Description                                              |
|---------|----------------------------------------------------------|
| #       | Position number within the squad                         |
| Name    | Character name if known from lore, blank otherwise       |
| Role    | Battlefield role (Sergeant, Intercessor, Hellblaster, etc.) |
| Wargear | Equipped weapons and equipment                           |
| Status  | One of the six hobby stages (see below)                  |
| Notes   | Freeform (kitbash plans, conversion notes, etc.)         |

## Hobby Status Stages

Models progress through six stages:

1. **Not Purchased** — No model owned. Exists on roster for organisational completeness or as a future acquisition target.
2. **Unbuilt** — Model acquired but still on sprue.
3. **Built** — Assembled but not primed.
4. **Primed** — Base coat / primer applied.
5. **Battle Ready** — Painted to tabletop standard.
6. **Parade Ready** — Fully painted with highlights, basing, and display-quality finish.

## Table Formatting

All Markdown tables use consistent column padding. Column widths are set so that all entries align cleanly under their respective headers when viewed as raw Markdown. Example:

```markdown
| Company          | Designation    | Captain              | File                |
|------------------|----------------|----------------------|---------------------|
| Chapter Command  | HQ             | Marneus Calgar       | chapter-command.md  |
| 1st Company      | Veterans       | Severus Agemman      | 1st-company.md      |
| 2nd Company      | Battle Company | Demetrian Titus      | 2nd-company.md      |
```
