# Ultramarines Chapter Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Ultramarines Chapter roster across 16 Markdown files, populating all known lore characters and establishing a hobby-tracking framework for the Captain's model collection.

**Architecture:** One directory (`ultramarines/`) containing a chapter overview, chapter command file, four specialist corps files, and ten company files. All files use padded Markdown tables with consistent column alignment. Named lore characters are pre-populated; all entries default to "Not Purchased" status until the Captain provides his inventory.

**Tech Stack:** Markdown files, no dependencies.

**Spec:** `docs/superpowers/specs/2026-04-10-ultramarines-chapter-roster-design.md`

**Lore Research:** Each task that creates a roster file requires web research to identify named characters from codexes, novels, campaign books, and *Space Marine 2*. The implementing agent must search for named Ultramarines for each company/corps and populate them in their canonical positions. Characters without official models should be noted as kitbash candidates.

**Parallelisation:** Tasks 2–6 (Chapter Command + specialist corps) are independent of each other and can be executed in parallel. Tasks 7–16 (company files) are independent of each other and can be executed in parallel. Task 17 (chapter overview) depends on all prior tasks being complete. Task 18 (final review) depends on Task 17.

---

## File Map

All files created under `/Users/tomhunterii/Documents/Warhammer 40k/ultramarines/`.

| File                  | Responsibility                                            | Task |
|-----------------------|-----------------------------------------------------------|------|
| `chapter-overview.md` | Chapter identity, company index, collection summary       | 17   |
| `chapter-command.md`  | Primarch, Chapter Master, Victrix Honour Guard             | 2    |
| `librarius.md`        | Chief Librarian, all Librarians by rank + company         | 3    |
| `reclusiam.md`        | Master of Sanctity, all Chaplains by rank + company       | 4    |
| `apothecarion.md`     | Chief Apothecary, all Apothecaries by rank + company      | 5    |
| `armoury.md`          | Master of the Forge, Techmarines, vehicles, Dreadnoughts  | 6    |
| `1st-company.md`      | Veterans — Terminators, Sternguard, Vanguard, Bladeguard  | 7    |
| `2nd-company.md`      | Battle Company — Titus commanding post-SM2                | 8    |
| `3rd-company.md`      | Battle Company                                            | 9    |
| `4th-company.md`      | Battle Company — Uriel Ventris commanding                 | 10   |
| `5th-company.md`      | Battle Company                                            | 11   |
| `6th-company.md`      | Battleline Reserve                                        | 12   |
| `7th-company.md`      | Battleline Reserve                                        | 13   |
| `8th-company.md`      | Close Support Reserve                                     | 14   |
| `9th-company.md`      | Fire Support Reserve                                      | 15   |
| `10th-company.md`     | Scout Company                                             | 16   |

---

### Task 1: Create Directory Structure

**Files:**
- Create: `ultramarines/` directory

- [ ] **Step 1: Create the ultramarines directory**

```bash
mkdir -p "/Users/tomhunterii/Documents/Warhammer 40k/ultramarines"
```

- [ ] **Step 2: Verify directory exists**

```bash
ls -la "/Users/tomhunterii/Documents/Warhammer 40k/ultramarines"
```

Expected: empty directory listing.

---

### Task 2: Create chapter-command.md

**Files:**
- Create: `ultramarines/chapter-command.md`

**Lore research required:** Search for all named Ultramarines Chapter Command members — Honour Guard members, named equerry, any other Chapter-level officers from codexes, novels, or *Space Marine 2*.

- [ ] **Step 1: Research lore characters for Chapter Command**

Use web search to find all named Chapter Command characters. Key known characters:

- Roboute Guilliman (Primarch)
- Marneus Augustus Calgar (Chapter Master)
- Victrix Honour Guard (Victrix Ancient, Victrix Champion — find names if they exist in lore)

Search for additional Honour Guard members, named equerries, or other Chapter-level staff.

- [ ] **Step 2: Create chapter-command.md**

Write the file with the following structure. All tables must use padded column alignment. Every entry defaults to `Not Purchased` status. Populate all named characters found in research. The file must include:

```markdown
# Chapter Command

## Primarch

| Name               | Title                                      | Wargear                                           | Status        | Notes |
|--------------------|--------------------------------------------|---------------------------------------------------|---------------|-------|
| Roboute Guilliman  | Primarch of the XIII Legion, Lord of Ultramar | The Emperor's Sword, Hand of Dominion, Armour of Fate | Not Purchased |       |

## Chapter Master

| Name                    | Title                    | Wargear                | Status        | Notes |
|-------------------------|--------------------------|------------------------|---------------|-------|
| Marneus Augustus Calgar | Lord Macragge             | Gauntlets of Ultramar  | Not Purchased |       |

## Victrix Honour Guard

| # | Name   | Role             | Wargear                            | Status        | Notes |
|---|--------|------------------|------------------------------------|---------------|-------|
| 1 | [Name] | Victrix Ancient  | Chapter Banner, power weapon       | Not Purchased |       |
| 2 | [Name] | Victrix Champion | Blade of Triumph, boarding shield  | Not Purchased |       |

## Honour Guard

| # | Name   | Wargear                       | Status        | Notes |
|---|--------|-------------------------------|---------------|-------|
| 1 | [Name] | power weapon, boarding shield | Not Purchased |       |
```

Replace `[Name]` with actual lore names where found, leave blank where unknown.

- [ ] **Step 3: Verify table alignment**

Open the file and confirm all columns align cleanly under their headers.

- [ ] **Step 4: Commit**

```bash
git add ultramarines/chapter-command.md
git commit -m "feat: add Chapter Command roster with Guilliman, Calgar, and Victrix Guard"
```

---

### Task 3: Create librarius.md

**Files:**
- Create: `ultramarines/librarius.md`

**Lore research required:** Search for all named Ultramarines Librarians — Epistolaries, Codiciers, Lexicanums from codexes, novels (particularly the Uriel Ventris series, Dark Imperium, *Space Marine 2*), and campaign books.

- [ ] **Step 1: Research named Librarians**

Key known characters:
- Varro Tigurius (Chief Librarian)

Search for additional named Librarians and their ranks and company assignments.

- [ ] **Step 2: Create librarius.md**

Write the file with the following structure:

```markdown
# Librarius

## Chief Librarian

| Name            | Rank            | Company Assignment | Wargear                        | Status        | Notes |
|-----------------|-----------------|--------------------|--------------------------------|---------------|-------|
| Varro Tigurius  | Chief Librarian | Chapter Command    | Rod of Tigurius, force staff   | Not Purchased |       |

## Epistolaries

| # | Name   | Rank       | Company Assignment | Wargear     | Status        | Notes |
|---|--------|------------|--------------------|-------------|---------------|-------|
| 1 | [Name] | Epistolary | [Company]          | force weapon | Not Purchased |       |

## Codiciers

| # | Name   | Rank     | Company Assignment | Wargear     | Status        | Notes |
|---|--------|----------|--------------------|-------------|---------------|-------|
| 1 | [Name] | Codicier | [Company]          | force weapon | Not Purchased |       |

## Lexicanums

| # | Name   | Rank      | Company Assignment | Wargear     | Status        | Notes |
|---|--------|-----------|--------------------| ------------|---------------|-------|
| 1 | [Name] | Lexicanum | [Company]          | force weapon | Not Purchased |       |
```

Populate all named characters found in research. Include company assignments where known.

- [ ] **Step 3: Verify table alignment**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/librarius.md
git commit -m "feat: add Librarius roster with Tigurius and known Librarians"
```

---

### Task 4: Create reclusiam.md

**Files:**
- Create: `ultramarines/reclusiam.md`

**Lore research required:** Search for all named Ultramarines Chaplains — from codexes, novels, and *Space Marine 2* (Leandros becomes a Chaplain). Find ranks and company assignments.

- [ ] **Step 1: Research named Chaplains**

Key known characters:
- Ortan Cassius (Master of Sanctity / Chaplain)
- Leandros (Chaplain in *Space Marine 2* — determine company assignment)

Search for additional named Chaplains.

- [ ] **Step 2: Create reclusiam.md**

Write the file with the following structure:

```markdown
# Reclusiam

## Master of Sanctity

| Name          | Rank               | Company Assignment | Wargear                          | Status        | Notes |
|---------------|--------------------|--------------------| ---------------------------------|---------------|-------|
| Ortan Cassius | Master of Sanctity | Chapter Command    | Crozius Arcanum, combi-flamer    | Not Purchased |       |

## Chaplains

| # | Name     | Rank     | Company Assignment | Wargear                       | Status        | Notes                    |
|---|----------|----------|--------------------|-------------------------------|---------------|--------------------------|
| 1 | Leandros | Chaplain | 2nd Company        | Crozius Arcanum, bolt pistol  | Not Purchased | From *Space Marine 2*    |
```

Populate all named characters found in research. Include company assignments where known.

- [ ] **Step 3: Verify table alignment**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/reclusiam.md
git commit -m "feat: add Reclusiam roster with Cassius, Leandros, and known Chaplains"
```

---

### Task 5: Create apothecarion.md

**Files:**
- Create: `ultramarines/apothecarion.md`

**Lore research required:** Search for all named Ultramarines Apothecaries — from codexes, novels (Uriel Ventris series features several), and campaign books. Find ranks and company assignments.

- [ ] **Step 1: Research named Apothecaries**

Search for named Apothecaries. Look in:
- Codex supplements
- Uriel Ventris novels
- Dark Imperium series
- *Space Marine 2*

- [ ] **Step 2: Create apothecarion.md**

Write the file with the following structure:

```markdown
# Apothecarion

## Chief Apothecary

| Name   | Rank             | Company Assignment | Wargear                            | Status        | Notes |
|--------|------------------|--------------------|------------------------------------|---------------|-------|
| [Name] | Chief Apothecary | Chapter Command    | Narthecium, reductor, bolt pistol  | Not Purchased |       |

## Apothecaries

| # | Name   | Rank      | Company Assignment | Wargear                            | Status        | Notes |
|---|--------|-----------|--------------------|------------------------------------|---------------|-------|
| 1 | [Name] | Apothecary | [Company]         | Narthecium, reductor, bolt pistol  | Not Purchased |       |
```

Populate all named characters found in research. Include company assignments where known.

- [ ] **Step 3: Verify table alignment**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/apothecarion.md
git commit -m "feat: add Apothecarion roster with known Apothecaries"
```

---

### Task 6: Create armoury.md

**Files:**
- Create: `ultramarines/armoury.md`

**Lore research required:** Search for named Ultramarines Techmarines, notable vehicles, and named Dreadnoughts (e.g., Ancient Galatan). Look in codexes, novels, and campaign books.

- [ ] **Step 1: Research named Armoury characters and notable assets**

Key areas:
- Master of the Forge (find name)
- Named Techmarines
- Named Dreadnoughts (Ancient Galatan, others)
- Notable Chapter vehicles

- [ ] **Step 2: Create armoury.md**

Write the file with the following structure:

```markdown
# Armoury

## Master of the Forge

| Name   | Rank              | Wargear                                  | Status        | Notes |
|--------|-------------------|------------------------------------------|---------------|-------|
| [Name] | Master of the Forge | servo-harness, power axe, bolt pistol  | Not Purchased |       |

## Techmarines

| # | Name   | Company Assignment | Wargear                                | Status        | Notes |
|---|--------|--------------------|----------------------------------------|---------------|-------|
| 1 | [Name] | [Company]          | servo-arm, bolt pistol, power weapon   | Not Purchased |       |

## Dreadnoughts

| # | Name            | Type                 | Wargear                              | Status        | Notes |
|---|-----------------|----------------------|--------------------------------------|---------------|-------|
| 1 | Ancient Galatan | Redemptor Dreadnought | macro plasma incinerator, fist       | Not Purchased |       |

## Chapter Vehicle Pool

### Transports

| # | Type     | Designation | Company Assignment | Status        | Notes |
|---|----------|-------------|--------------------|---------------|-------|
| 1 | Impulsor | [Name]      | [Company]          | Not Purchased |       |

### Main Battle Tanks

| # | Type              | Designation | Company Assignment | Status        | Notes |
|---|-------------------|-------------|--------------------|---------------|-------|
| 1 | Repulsor          | [Name]      | [Company]          | Not Purchased |       |
| 2 | Gladiator Lancer  | [Name]      | [Company]          | Not Purchased |       |
| 3 | Gladiator Reaper  | [Name]      | [Company]          | Not Purchased |       |
| 4 | Gladiator Valiant | [Name]      | [Company]          | Not Purchased |       |

### Super-Heavy

| # | Type                    | Designation | Status        | Notes |
|---|-------------------------|-------------|---------------|-------|
| 1 | Repulsor Executioner    | [Name]      | Not Purchased |       |
| 2 | Astraeus Super-heavy    | [Name]      | Not Purchased |       |

### Aircraft

| # | Type              | Designation | Status        | Notes |
|---|-------------------|-------------|---------------|-------|
| 1 | Stormraven Gunship | [Name]     | Not Purchased |       |
| 2 | Stormhawk Interceptor | [Name]  | Not Purchased |       |
```

Populate all named assets found in research. Expand vehicle categories as appropriate for a full Chapter armoury.

- [ ] **Step 3: Verify table alignment**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/armoury.md
git commit -m "feat: add Armoury roster with Techmarines, Dreadnoughts, and vehicle pool"
```

---

### Task 7: Create 1st-company.md

**Files:**
- Create: `ultramarines/1st-company.md`

**Lore research required:** Search for all named 1st Company Ultramarines — Severus Agemman, named Terminator sergeants, notable veterans from codexes and novels. The 1st Company is the Veterans and fields Terminators, Sternguard, Vanguard, and Bladeguard Veterans.

- [ ] **Step 1: Research named 1st Company marines**

Key known characters:
- Severus Agemman (Captain, Regent of Ultramar)

Search for named lieutenants, sergeants, and veterans.

- [ ] **Step 2: Create 1st-company.md**

Write the file with the following structure. A standard 10th Edition 1st Company fields approximately 100 Veterans across 10 squads. Include command staff, then squads grouped by type:

```markdown
# 1st Company — "The Defenders of Ultramar"

## Command

| Role              | Name              | Wargear                                    | Status        | Notes |
|-------------------|-------------------|--------------------------------------------|---------------|-------|
| Captain           | Severus Agemman   | Relic blade, storm bolter, Terminator armour | Not Purchased | Regent of Ultramar |
| Lieutenant        | [Name]            | [Wargear]                                  | Not Purchased |       |
| Lieutenant        | [Name]            | [Wargear]                                  | Not Purchased |       |
| Company Ancient   | [Name]            | Company banner, bolt pistol                | Not Purchased |       |
| Company Champion  | [Name]            | Champion's blade, bolt pistol              | Not Purchased |       |

## Terminator Squads

### Squad [Sergeant Name]

| # | Name   | Role                | Wargear                              | Status        | Notes |
|---|--------|---------------------|--------------------------------------|---------------|-------|
| 1 | [Name] | Terminator Sergeant | power sword, storm bolter            | Not Purchased |       |
| 2 |        | Terminator          | power fist, storm bolter             | Not Purchased |       |
| 3 |        | Terminator          | power fist, storm bolter             | Not Purchased |       |
| 4 |        | Terminator          | power fist, storm bolter             | Not Purchased |       |
| 5 |        | Terminator          | power fist, storm bolter             | Not Purchased |       |

## Sternguard Veteran Squads

(Same table format, 10-man squads, sternguard bolt rifles)

## Vanguard Veteran Squads

(Same table format, jump packs, close combat weapons)

## Bladeguard Veteran Squads

(Same table format, heavy bolt pistol, master-crafted power sword, storm shield)

## Attached Assets

| # | Type   | Designation | Wargear | Status        | Notes |
|---|--------|-------------|---------|---------------|-------|
```

Populate all squads to reach ~100 marines. Fill in every row — no placeholders. Use lore names for known sergeants and marines. Leave Name blank for unknown marines but still include the full row.

- [ ] **Step 3: Verify table alignment and marine count**

Confirm approximately 100 marines across all squads plus command staff. Verify all tables align.

- [ ] **Step 4: Commit**

```bash
git add ultramarines/1st-company.md
git commit -m "feat: add 1st Company Veterans roster with Agemman and known veterans"
```

---

### Task 8: Create 2nd-company.md

**Files:**
- Create: `ultramarines/2nd-company.md`

**Lore research required:** This is the Captain's own company. Search thoroughly for all named 2nd Company marines from codexes, novels, and especially *Space Marine 2* (Titus, squad members like Chairon, Gadriel). Also search for the previous captain Cato Sicarius's whereabouts (lost in the Warp) and any marines named during his tenure.

- [ ] **Step 1: Research named 2nd Company marines**

Key known characters:
- Demetrian Titus (Captain, post-*Space Marine 2*)
- Cato Sicarius (former Captain, lost in the Warp)
- Gadriel (from *Space Marine 2* — determine rank)
- Chairon (from *Space Marine 2*)

Search extensively for additional named marines, sergeants, and squad members from all sources.

- [ ] **Step 2: Create 2nd-company.md**

A standard 10th Edition Battle Company fields ~100 marines across 10 squads: 6 Battleline, 2 Close Support, 2 Fire Support. Write the file:

```markdown
# 2nd Company — "The Guardians of the Temple"

## Command

| Role              | Name             | Wargear                                | Status        | Notes                                |
|-------------------|------------------|----------------------------------------|---------------|--------------------------------------|
| Captain           | Demetrian Titus  | bolt pistol, power sword               | Not Purchased | Assumed command post-*Space Marine 2* |
| Lieutenant        | [Name]           | [Wargear]                              | Not Purchased |                                      |
| Lieutenant        | [Name]           | [Wargear]                              | Not Purchased |                                      |
| Company Ancient   | [Name]           | Company banner, bolt pistol            | Not Purchased |                                      |
| Company Champion  | [Name]           | Champion's blade, bolt pistol          | Not Purchased |                                      |

## Battleline Squads

### Squad [Sergeant Name]

| # | Name   | Role        | Wargear    | Status        | Notes |
|---|--------|-------------|------------|---------------|-------|
| 1 | [Name] | Sergeant    | [Wargear]  | Not Purchased |       |
| 2 |        | Intercessor | bolt rifle | Not Purchased |       |
...

(6 Battleline squads of 10)

## Close Support Squads

(2 squads — Assault Intercessors or Inceptors)

## Fire Support Squads

(2 squads — Hellblasters or Eradicators)

## Attached Assets

| # | Type   | Designation | Wargear | Status        | Notes |
|---|--------|-------------|---------|---------------|-------|
```

Populate all squads to reach ~100 marines. Fill in every row. Use lore names for all known marines. Place *Space Marine 2* characters in their canonical positions.

- [ ] **Step 3: Verify table alignment and marine count**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/2nd-company.md
git commit -m "feat: add 2nd Company Battle roster with Titus and Space Marine 2 characters"
```

---

### Task 9: Create 3rd-company.md

**Files:**
- Create: `ultramarines/3rd-company.md`

**Lore research required:** Search for the 3rd Company Captain and all named marines. The 3rd Company has appeared in various novels and campaigns.

- [ ] **Step 1: Research named 3rd Company marines**

Search for the current captain, lieutenants, named sergeants, and notable marines from codexes, novels, and campaign books.

- [ ] **Step 2: Create 3rd-company.md**

Battle Company structure: same as 2nd Company (6 Battleline, 2 Close Support, 2 Fire Support, ~100 marines). Include command staff and all named lore characters. Fill in every row — no placeholders.

Use the same template structure as Task 8 but with 3rd Company identity:
- Company name and honorific title (research the 3rd Company's title)
- 3rd Company Captain and command staff
- Full squad rosters

- [ ] **Step 3: Verify table alignment and marine count**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/3rd-company.md
git commit -m "feat: add 3rd Company Battle roster with known lore characters"
```

---

### Task 10: Create 4th-company.md

**Files:**
- Create: `ultramarines/4th-company.md`

**Lore research required:** The 4th Company is notable for Captain Uriel Ventris, protagonist of a major novel series. Search thoroughly for all named marines from the Uriel Ventris novels (Pasanius, Learchus, etc.) and place them in their canonical positions.

- [ ] **Step 1: Research named 4th Company marines**

Key known characters:
- Uriel Ventris (Captain)
- Pasanius Lysane (Sergeant/veteran)
- Learchus Abantes (Sergeant)

Search for all other named marines from the novel series and codex entries.

- [ ] **Step 2: Create 4th-company.md**

Battle Company structure. Same template as Task 8 with 4th Company identity. Populate all Uriel Ventris novel characters in their canonical positions. Fill in every row.

- [ ] **Step 3: Verify table alignment and marine count**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/4th-company.md
git commit -m "feat: add 4th Company Battle roster with Ventris and novel characters"
```

---

### Task 11: Create 5th-company.md

**Files:**
- Create: `ultramarines/5th-company.md`

**Lore research required:** Search for the 5th Company Captain and named marines from codexes and novels.

- [ ] **Step 1: Research named 5th Company marines**

- [ ] **Step 2: Create 5th-company.md**

Battle Company structure. Same template as Task 8 with 5th Company identity. Fill in every row.

- [ ] **Step 3: Verify table alignment and marine count**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/5th-company.md
git commit -m "feat: add 5th Company Battle roster with known lore characters"
```

---

### Task 12: Create 6th-company.md

**Files:**
- Create: `ultramarines/6th-company.md`

**Lore research required:** Search for the 6th Company Captain and named marines. The 6th Company is a Battleline Reserve company — all 10 squads are Battleline.

- [ ] **Step 1: Research named 6th Company marines**

- [ ] **Step 2: Create 6th-company.md**

Reserve Company structure: 10 Battleline squads (~100 marines). All squads are Battleline (Intercessors, Tactical Marines). Write with the following structure:

```markdown
# 6th Company — "[Honorific Title]"

## Command

(Same command staff table)

## Battleline Squads

(10 squads of 10, all Battleline)

## Attached Assets

(Table)
```

Fill in every row. Use lore names where known.

- [ ] **Step 3: Verify table alignment and marine count**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/6th-company.md
git commit -m "feat: add 6th Company Battleline Reserve roster"
```

---

### Task 13: Create 7th-company.md

**Files:**
- Create: `ultramarines/7th-company.md`

**Lore research required:** Search for the 7th Company Captain and named marines. Also a Battleline Reserve company.

- [ ] **Step 1: Research named 7th Company marines**

- [ ] **Step 2: Create 7th-company.md**

Same structure as Task 12 — 10 Battleline squads. Fill in every row.

- [ ] **Step 3: Verify table alignment and marine count**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/7th-company.md
git commit -m "feat: add 7th Company Battleline Reserve roster"
```

---

### Task 14: Create 8th-company.md

**Files:**
- Create: `ultramarines/8th-company.md`

**Lore research required:** Search for the 8th Company Captain and named marines. The 8th Company is the Close Support Reserve — all 10 squads are Close Support.

- [ ] **Step 1: Research named 8th Company marines**

- [ ] **Step 2: Create 8th-company.md**

Reserve Company structure: 10 Close Support squads (~100 marines). All squads are Close Support (Assault Intercessors, Inceptors, Reivers, etc.). Write:

```markdown
# 8th Company — "[Honorific Title]"

## Command

(Same command staff table)

## Close Support Squads

(10 squads of 10, all Close Support)

## Attached Assets

(Table)
```

Fill in every row. Use lore names where known.

- [ ] **Step 3: Verify table alignment and marine count**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/8th-company.md
git commit -m "feat: add 8th Company Close Support Reserve roster"
```

---

### Task 15: Create 9th-company.md

**Files:**
- Create: `ultramarines/9th-company.md`

**Lore research required:** Search for the 9th Company Captain and named marines. The 9th Company is the Fire Support Reserve — all 10 squads are Fire Support.

- [ ] **Step 1: Research named 9th Company marines**

- [ ] **Step 2: Create 9th-company.md**

Reserve Company structure: 10 Fire Support squads (~100 marines). All squads are Fire Support (Hellblasters, Eradicators, Devastators, Eliminators, etc.). Write:

```markdown
# 9th Company — "[Honorific Title]"

## Command

(Same command staff table)

## Fire Support Squads

(10 squads of 10, all Fire Support)

## Attached Assets

(Table)
```

Fill in every row. Use lore names where known.

- [ ] **Step 3: Verify table alignment and marine count**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/9th-company.md
git commit -m "feat: add 9th Company Fire Support Reserve roster"
```

---

### Task 16: Create 10th-company.md

**Files:**
- Create: `ultramarines/10th-company.md`

**Lore research required:** Search for the 10th Company Captain and named marines. The 10th Company is the Scout Company and also fields Vanguard infiltration units. Search for Sergeant Telion and other named scouts/vanguard marines.

- [ ] **Step 1: Research named 10th Company marines**

Key known characters:
- Torias Telion (Scout Sergeant, notable marksman)

Search for the current Captain and other named marines.

- [ ] **Step 2: Create 10th-company.md**

Scout Company structure: mix of Scout Squads and Vanguard units (Reivers, Incursors, Infiltrators, Eliminators). Write:

```markdown
# 10th Company — "[Honorific Title]"

## Command

(Same command staff table)

## Scout Squads

(Scout squads with sniper rifles, bolt pistol/combat knife, shotguns, etc.)

## Vanguard Squads

(Infiltrators, Incursors, Reivers — organised as squads)

## Attached Assets

(Table)
```

Fill in every row. Use lore names where known. Place Telion in his canonical position.

- [ ] **Step 3: Verify table alignment and marine count**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/10th-company.md
git commit -m "feat: add 10th Company Scout roster with Telion and known marines"
```

---

### Task 17: Create chapter-overview.md

**Depends on:** Tasks 2–16 (all company and corps files must be complete to populate the index accurately).

**Files:**
- Create: `ultramarines/chapter-overview.md`

- [ ] **Step 1: Compile captain names and corps leaders from completed files**

Read all company and corps files to extract the final captain names and corps leaders for the index tables.

- [ ] **Step 2: Create chapter-overview.md**

```markdown
# Ultramarines Chapter

**Homeworld:** Macragge
**Fortress Monastery:** Fortress of Hera
**Primarch:** Roboute Guilliman
**Chapter Master:** Marneus Augustus Calgar
**Founding:** First Founding (XIII Legion)
**Battle Cry:** "Courage and Honour!"

## Chapter Organisation

| Company          | Designation          | Captain              | File                |
|------------------|----------------------|----------------------|---------------------|
| Chapter Command  | HQ                   | Marneus Calgar       | chapter-command.md  |
| 1st Company      | Veterans             | Severus Agemman      | 1st-company.md      |
| 2nd Company      | Battle Company       | Demetrian Titus      | 2nd-company.md      |
| 3rd Company      | Battle Company       | [from research]      | 3rd-company.md      |
| 4th Company      | Battle Company       | Uriel Ventris        | 4th-company.md      |
| 5th Company      | Battle Company       | [from research]      | 5th-company.md      |
| 6th Company      | Battleline Reserve   | [from research]      | 6th-company.md      |
| 7th Company      | Battleline Reserve   | [from research]      | 7th-company.md      |
| 8th Company      | Close Support Reserve | [from research]     | 8th-company.md      |
| 9th Company      | Fire Support Reserve | [from research]      | 9th-company.md      |
| 10th Company     | Scout Company        | [from research]      | 10th-company.md     |

## Specialist Corps

| Corps        | Leader           | File             |
|--------------|------------------|------------------|
| Librarius    | Varro Tigurius   | librarius.md     |
| Reclusiam    | Ortan Cassius    | reclusiam.md     |
| Apothecarion | [from research]  | apothecarion.md  |
| Armoury      | [from research]  | armoury.md       |

## Collection Status Summary

| Status        | Count |
|---------------|-------|
| Not Purchased | —     |
| Unbuilt       | —     |
| Built         | —     |
| Primed        | —     |
| Battle Ready  | —     |
| Parade Ready  | —     |
| **Total**     | —     |
```

Replace all `[from research]` with actual names from the completed files.

- [ ] **Step 3: Verify table alignment and file link accuracy**

- [ ] **Step 4: Commit**

```bash
git add ultramarines/chapter-overview.md
git commit -m "feat: add Chapter overview with full company and corps index"
```

---

### Task 18: Final Review and Verification

**Depends on:** Task 17.

- [ ] **Step 1: Verify all 16 files exist**

```bash
ls -la "/Users/tomhunterii/Documents/Warhammer 40k/ultramarines/"
```

Expected: 16 `.md` files.

- [ ] **Step 2: Verify table alignment across all files**

Open each file and confirm padded column alignment is consistent.

- [ ] **Step 3: Verify lore accuracy**

Cross-check that named characters appear in the correct company and rank. Verify no character is duplicated across files (except specialist corps references in company files, which are allowed as references only, not full entries).

- [ ] **Step 4: Verify specialist corps single-source-of-truth**

Confirm that Chaplains, Librarians, Apothecaries, and Techmarines appear only in their corps files, not duplicated in company files.

- [ ] **Step 5: Final commit if any corrections were made**

```bash
git add -A
git commit -m "fix: final review corrections across Chapter roster"
```
