# Datasheet Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Markdown catalogue of Warhammer 40,000 10th Edition datasheets for the Captain's army and opponent units, structured for both human reading and damage calculations.

**Architecture:** One `datasheets/` directory at project root containing faction subdirectories. Each faction has: a faction-rules file, a detachments subdirectory, a weapons subdirectory with common profiles, individual unit datasheet files, and an index. Each datasheet is self-contained with all stat lines, weapon profiles, abilities, and keywords.

**Tech Stack:** Markdown files, no dependencies. Data sourced via web lookup (Wahapedia, NewRecruit, GW official datasheets).

**Spec:** `docs/superpowers/specs/2026-04-10-datasheet-catalogue-design.md`

**Parallelisation:** Tasks 2–4 (SM infrastructure) are independent and can run in parallel. Tasks 5–18 (SM unit datasheets) are all independent and can run in parallel. Tasks 19–21 (Tyranid files) are independent and can run in parallel. Task 22 (indexes) depends on all prior datasheet tasks. Task 23 (review) depends on Task 22.

---

## File Map

All files created under `/Users/tomhunterii/Documents/Warhammer 40k/datasheets/`.

| File                                          | Responsibility                          | Task |
|-----------------------------------------------|-----------------------------------------|------|
| `space-marines/faction-rules.md`              | Oath of Moment                          | 2    |
| `space-marines/weapons/common-ranged.md`      | Shared ranged weapon profiles           | 3    |
| `space-marines/weapons/common-melee.md`       | Shared melee weapon profiles            | 3    |
| `space-marines/detachments/blade-of-ultramar.md` | Detachment rule, stratagems, enhancements | 4  |
| `space-marines/captain-titus.md`              | Captain Titus datasheet                 | 5    |
| `space-marines/cato-sicarius.md`              | Cato Sicarius datasheet                 | 6    |
| `space-marines/lieutenant.md`                 | Lieutenant (generic) datasheet          | 7    |
| `space-marines/marneus-calgar.md`             | Marneus Calgar datasheet                | 8    |
| `space-marines/roboute-guilliman.md`          | Roboute Guilliman datasheet             | 9    |
| `space-marines/intercessor-squad.md`          | Intercessor Squad datasheet             | 10   |
| `space-marines/ballistus-dreadnought.md`      | Ballistus Dreadnought datasheet         | 11   |
| `space-marines/redemptor-dreadnought.md`      | Redemptor Dreadnought datasheet         | 12   |
| `space-marines/reiver-squad.md`               | Reiver Squad datasheet                  | 13   |
| `space-marines/repulsor-executioner.md`        | Repulsor Executioner datasheet          | 14   |
| `space-marines/sternguard-veteran-squad.md`   | Sternguard Veteran Squad datasheet      | 15   |
| `space-marines/victrix-honour-guard.md`       | Victrix Honour Guard datasheet          | 16   |
| `space-marines/wardens-of-ultramar.md`        | Wardens of Ultramar datasheet           | 17   |
| `space-marines/index.md`                      | SM datasheet index                      | 22   |
| `tyranids/faction-rules.md`                   | Synapse + faction rules                 | 18   |
| `tyranids/weapons/common-ranged.md`           | Shared Tyranid ranged bio-weapons       | 18   |
| `tyranids/weapons/common-melee.md`            | Shared Tyranid melee bio-weapons        | 18   |
| `tyranids/trygon.md`                          | Trygon datasheet                        | 19   |
| `tyranids/tyrannofex.md`                      | Tyrannofex datasheet                    | 20   |
| `tyranids/index.md`                           | Tyranid datasheet index                 | 22   |

---

## Datasheet Template Reference

Every unit datasheet task follows this template. The implementing agent must fill every section from web-sourced data. No section may be omitted or left as a placeholder.

```markdown
# [Unit Name]

**Points:** [N] | **Role:** [Battlefield Role]

**Keywords:** [Unit keywords, comma-separated]
**Faction Keywords:** [Faction keywords]

## Stat Line

| M   | T | Sv  | W | Ld  | OC | Inv | FNP |
|-----|---|-----|---|-----|----|-----|-----|
| [M] | [T] | [Sv] | [W] | [Ld] | [OC] | [Inv or —] | [FNP or —] |

## Ranged Weapons

| Weapon   | Range | A  | BS | S | AP | D | Keywords |
|----------|-------|----|----|---|----|---|----------|
| [weapon] | [rng] | [A] | [BS] | [S] | [AP] | [D] | [keywords] |

## Melee Weapons

| Weapon   | A  | WS | S | AP | D | Keywords |
|----------|----|----|---|----|---|----------|
| [weapon] | [A] | [WS] | [S] | [AP] | [D] | [keywords] |

## Abilities

**Core:** [list]
**Faction:** [name]

### [Ability Name]

[Full rules text]

## Leader (if applicable)

This model can be attached to the following units:
- [unit list]

## Wargear Options

- [options as on datasheet]

## Unit Composition

- [model count and default equipment]

<!-- Last verified: 2026-04-10 -->
```

For multi-profile units, add a Model column to the Stat Line table. For degrading units, add a Damaged section. See spec for full details.

---

### Task 1: Create Directory Structure

**Files:**
- Create: `datasheets/space-marines/detachments/`
- Create: `datasheets/space-marines/weapons/`
- Create: `datasheets/tyranids/detachments/`
- Create: `datasheets/tyranids/weapons/`

- [ ] **Step 1: Create all directories**

```bash
mkdir -p "/Users/tomhunterii/Documents/Warhammer 40k/datasheets/space-marines/detachments"
mkdir -p "/Users/tomhunterii/Documents/Warhammer 40k/datasheets/space-marines/weapons"
mkdir -p "/Users/tomhunterii/Documents/Warhammer 40k/datasheets/tyranids/detachments"
mkdir -p "/Users/tomhunterii/Documents/Warhammer 40k/datasheets/tyranids/weapons"
```

- [ ] **Step 2: Verify directories exist**

```bash
find "/Users/tomhunterii/Documents/Warhammer 40k/datasheets" -type d
```

Expected output should show all six directories (datasheets, space-marines, detachments, weapons, tyranids, detachments, weapons).

---

### Task 2: Create Space Marines Faction Rules

**Files:**
- Create: `datasheets/space-marines/faction-rules.md`

- [ ] **Step 1: Research Oath of Moment full rules text**

Search for: `"Oath of Moment" warhammer 40k 10th edition full rules text space marines faction ability`

Verify the exact wording from Wahapedia or official source.

- [ ] **Step 2: Create faction-rules.md**

Write the file with the researched Oath of Moment text. The file should contain the complete faction ability description. Example structure:

```markdown
# Space Marines — Faction Rules

## Oath of Moment

At the start of your Command phase, select one unit from your opponent's army. Until the start of your next Command phase, each time a model from your army with this ability makes an attack that targets that unit, you can re-roll the Hit roll.

<!-- Last verified: 2026-04-10 -->
```

Verify the text matches the official source exactly.

- [ ] **Step 3: Commit**

```bash
git add "datasheets/space-marines/faction-rules.md"
git commit -m "feat: add Space Marines faction rules (Oath of Moment)"
```

---

### Task 3: Create Space Marines Common Weapons

**Files:**
- Create: `datasheets/space-marines/weapons/common-ranged.md`
- Create: `datasheets/space-marines/weapons/common-melee.md`

These files catalogue standard weapon profiles shared across multiple Space Marine units. BS/WS defaults to 3+ (standard troops). Unit datasheets override where needed.

- [ ] **Step 1: Research common ranged weapon profiles**

Search for the following weapon profiles on Wahapedia or NewRecruit. All must be 10th Edition current:

- Bolt pistol
- Heavy bolt pistol
- Bolt rifle
- Heavy bolt rifle
- Storm bolter
- Twin storm bolter
- Boltgun
- Heavy bolter
- Ironhail heavy stubber
- Icarus rocket pod
- Heavy flamer
- Special issue bolt pistol

For each weapon, record: Range, A, BS, S, AP, D, Keywords.

- [ ] **Step 2: Create common-ranged.md**

```markdown
# Space Marines — Common Ranged Weapons

Standard BS shown is 3+ (troops). Characters and other models may override in their unit datasheets.

| Weapon                    | Range | A  | BS | S | AP | D | Keywords                          |
|---------------------------|-------|----|----|---|----|---|-----------------------------------|
| Bolt pistol               | 12"   | 1  | 3+ | 4 | 0  | 1 | Pistol                            |
| Heavy bolt pistol         | 18"   | 1  | 3+ | 4 | -1 | 1 | Pistol                            |
| Bolt rifle                | 24"   | 2  | 3+ | 4 | -1 | 1 | Assault, Heavy                    |
| [continue for all weapons researched...]

<!-- Last verified: 2026-04-10 -->
```

Fill every row from researched data. Do not guess profiles.

- [ ] **Step 3: Research common melee weapon profiles**

Search for:
- Close combat weapon
- Power weapon
- Power fist
- Master-crafted power weapon
- Astartes chainsword

For each: A, WS, S, AP, D, Keywords.

- [ ] **Step 4: Create common-melee.md**

```markdown
# Space Marines — Common Melee Weapons

Standard WS shown is 3+ (troops). Characters and other models may override in their unit datasheets.

| Weapon                    | A | WS | S | AP | D | Keywords |
|---------------------------|---|----|---|----|---|----------|
| Close combat weapon       | 4 | 3+ | 4 | 0  | 1 |          |
| Power weapon              | 4 | 3+ | 4 | -2 | 1 |          |
| [continue for all weapons researched...]

<!-- Last verified: 2026-04-10 -->
```

- [ ] **Step 5: Verify all tables align cleanly**

Open both files and confirm column padding is consistent.

- [ ] **Step 6: Commit**

```bash
git add "datasheets/space-marines/weapons/"
git commit -m "feat: add Space Marines common weapon profiles"
```

---

### Task 4: Create Blade of Ultramar Detachment

**Files:**
- Create: `datasheets/space-marines/detachments/blade-of-ultramar.md`

- [ ] **Step 1: Research Blade of Ultramar detachment rules**

Search for: `"Blade of Ultramar" detachment rule stratagems enhancements warhammer 40k 10th edition`

Also try Wahapedia: `wahapedia.ru/wh40k10ed/factions/space-marines/Blade-of-Ultramar`

Record:
1. Detachment rule name and full text
2. All stratagems (name, CP, phase, when, target, effect)
3. All enhancements (name, points, restriction, effect)

- [ ] **Step 2: Create blade-of-ultramar.md**

Write the file with the detachment rule, a stratagem summary table followed by individual stratagem details, and an enhancement summary table followed by individual enhancement details. Follow the spec format:

```markdown
# Blade of Ultramar

## Detachment Rule: [Rule Name]

[Full rules text from research]

## Stratagems

| Name              | CP | Phase        | Target                                 |
|-------------------|----|--------------|----------------------------------------|
| [Strat 1]         | 1  | [Phase]      | [Brief target description]             |
| [Strat 2]         | 1  | [Phase]      | [Brief target description]             |
| [continue...]

### [Stratagem 1 Name]

**Cost:** [N] CP | **Phase:** [Phase] | **When:** [Timing]
**Target:** [Full target text]
**Effect:** [Full effect text]

[Repeat for each stratagem]

## Enhancements

| Name                    | Points | Restriction                        |
|-------------------------|--------|------------------------------------|
| Armour of Antoninus     | [N]    | [Restriction]                      |
| [continue...]

### Armour of Antoninus

**Points:** [N]
**Restriction:** [Full restriction text]
**Effect:** [Full effect text]

[Repeat for each enhancement]

<!-- Last verified: 2026-04-10 -->
```

Every stratagem and enhancement must have complete text. No placeholders.

- [ ] **Step 3: Verify completeness**

Count stratagems and enhancements. A standard 10th Edition detachment has 6 stratagems and 4 enhancements. Confirm the file has the correct count.

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/detachments/blade-of-ultramar.md"
git commit -m "feat: add Blade of Ultramar detachment rules, stratagems, enhancements"
```

---

### Task 5: Create Captain Titus Datasheet

**Files:**
- Create: `datasheets/space-marines/captain-titus.md`

- [ ] **Step 1: Research Captain Titus datasheet**

Search for: `"Captain Titus" datasheet wahapedia 10th edition weapons abilities stat line`

Also try: Warhammer Community Wardens of Ultramar datasheets, Goonhammer Captain Titus review.

This is the updated **Captain** version (from Wardens of Ultramar box, January 2026), NOT the older Lieutenant Titus. Key differences from the Lieutenant version:
- Captain keyword (not Lieutenant)
- W6 (not W5)
- 4+ invulnerable save (Iron Halo)
- Master-crafted bolter + bolt pistol (not heavy bolt pistol)
- Master-crafted chainsword at S5 AP-1 D2 (not S4 D1)
- Honour of Ultramar (upgraded from Honour of the Chapter — can revive if he kills)

Record: full stat line, all weapon profiles, all abilities with complete text, Leader attachments, unit composition, keywords, points.

- [ ] **Step 2: Create captain-titus.md**

Write the complete datasheet following the template. Include all sections: Stat Line, Ranged Weapons, Melee Weapons, Abilities, Leader, Wargear Options, Unit Composition. Every number must come from the official source.

- [ ] **Step 3: Verify all sections are present and complete**

Check that the file has: stat line, ranged weapons table, melee weapons table, core abilities, faction ability, Press the Attack full text, Honour of Ultramar full text, Leader list, keywords, points, composition.

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/captain-titus.md"
git commit -m "feat: add Captain Titus datasheet"
```

---

### Task 6: Create Cato Sicarius Datasheet

**Files:**
- Create: `datasheets/space-marines/cato-sicarius.md`

- [ ] **Step 1: Research Cato Sicarius datasheet**

Search for: `"Cato Sicarius" datasheet wahapedia 10th edition weapons abilities`

Record: full stat line, Artisan plasma pistol profile, Talassarian tempest blade profile, all abilities, Leader attachments, keywords, points (95 pts).

- [ ] **Step 2: Create cato-sicarius.md following the template**

- [ ] **Step 3: Verify completeness**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/cato-sicarius.md"
git commit -m "feat: add Cato Sicarius datasheet"
```

---

### Task 7: Create Lieutenant Datasheet

**Files:**
- Create: `datasheets/space-marines/lieutenant.md`

- [ ] **Step 1: Research generic Lieutenant datasheet**

Search for: `space marines Lieutenant datasheet wahapedia 10th edition`

This is the generic Lieutenant (not Titus). The Captain's list equips: heavy bolt pistol, master-crafted bolter, master-crafted power weapon, Armour of Antoninus enhancement.

Record: full stat line, all weapon profiles (including all wargear options), all abilities, Leader attachments, wargear options, keywords, points (65 pts).

- [ ] **Step 2: Create lieutenant.md following the template**

- [ ] **Step 3: Verify completeness**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/lieutenant.md"
git commit -m "feat: add Lieutenant datasheet"
```

---

### Task 8: Create Marneus Calgar Datasheet

**Files:**
- Create: `datasheets/space-marines/marneus-calgar.md`

- [ ] **Step 1: Research Marneus Calgar datasheet**

Search for: `"Marneus Calgar" datasheet wahapedia 10th edition "Armour of Antilochus" weapons abilities`

Record: full stat line (in Armour of Antilochus — Gravis armour), Gauntlets of Ultramar profiles (both ranged and melee), all abilities (Chapter Master ability, God of War, etc.), Leader attachments, keywords, points (140 pts).

- [ ] **Step 2: Create marneus-calgar.md following the template**

- [ ] **Step 3: Verify completeness**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/marneus-calgar.md"
git commit -m "feat: add Marneus Calgar datasheet"
```

---

### Task 9: Create Roboute Guilliman Datasheet

**Files:**
- Create: `datasheets/space-marines/roboute-guilliman.md`

- [ ] **Step 1: Research Roboute Guilliman datasheet**

Search for: `"Roboute Guilliman" datasheet wahapedia 10th edition weapons abilities`

Record: full stat line (he is a Primarch — expect high stats, likely Supreme Commander keyword), Emperor's Sword profile, Hand of Dominion profiles (both ranged and melee), all abilities (Author of the Codex, Armour of Fate, Supreme Commander aura, etc.), keywords, points (340 pts). Note any degrading profile.

- [ ] **Step 2: Create roboute-guilliman.md following the template**

- [ ] **Step 3: Verify completeness**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/roboute-guilliman.md"
git commit -m "feat: add Roboute Guilliman datasheet"
```

---

### Task 10: Create Intercessor Squad Datasheet

**Files:**
- Create: `datasheets/space-marines/intercessor-squad.md`

- [ ] **Step 1: Research Intercessor Squad datasheet**

Search for: `"Intercessor Squad" datasheet wahapedia 10th edition weapons abilities`

Record: stat line (Sergeant may differ), all weapon profiles (bolt rifle, bolt pistol, close combat weapon, Sergeant options including power weapon/fist/thunder hammer), Oath of Moment ability, wargear options, unit composition (5-10 models), keywords, points.

- [ ] **Step 2: Create intercessor-squad.md following the template**

Include both Intercessor and Intercessor Sergeant stat lines if they differ. List all wargear options.

- [ ] **Step 3: Verify completeness**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/intercessor-squad.md"
git commit -m "feat: add Intercessor Squad datasheet"
```

---

### Task 11: Create Ballistus Dreadnought Datasheet

**Files:**
- Create: `datasheets/space-marines/ballistus-dreadnought.md`

- [ ] **Step 1: Research Ballistus Dreadnought datasheet**

Search for: `"Ballistus Dreadnought" datasheet wahapedia 10th edition weapons abilities`

Record: stat line, Ballistus lascannon profile, Ballistus missile launcher profile (likely multiple fire modes), twin storm bolter profile, armoured feet melee profile, all abilities (Deadly Demise, etc.), keywords, points (150 pts). Check for degrading profile.

- [ ] **Step 2: Create ballistus-dreadnought.md following the template**

Include Damaged section if the unit degrades.

- [ ] **Step 3: Verify completeness**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/ballistus-dreadnought.md"
git commit -m "feat: add Ballistus Dreadnought datasheet"
```

---

### Task 12: Create Redemptor Dreadnought Datasheet

**Files:**
- Create: `datasheets/space-marines/redemptor-dreadnought.md`

- [ ] **Step 1: Research Redemptor Dreadnought datasheet**

Search for: `"Redemptor Dreadnought" datasheet wahapedia 10th edition weapons abilities`

Record: stat line, macro plasma incinerator profile (and heavy onslaught gatling cannon alternative), heavy flamer, Icarus rocket pod, twin storm bolter, Redemptor fist (ranged and melee), all abilities (Deadly Demise), keywords, points (205 pts). Check for degrading profile.

- [ ] **Step 2: Create redemptor-dreadnought.md following the template**

- [ ] **Step 3: Verify completeness**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/redemptor-dreadnought.md"
git commit -m "feat: add Redemptor Dreadnought datasheet"
```

---

### Task 13: Create Reiver Squad Datasheet

**Files:**
- Create: `datasheets/space-marines/reiver-squad.md`

- [ ] **Step 1: Research Reiver Squad datasheet**

Search for: `"Reiver Squad" datasheet wahapedia 10th edition weapons abilities`

Record: stat line, special issue bolt pistol profile, combat knife profile, all abilities (Terror Troops, etc.), wargear options, unit composition, keywords, points (80 pts).

- [ ] **Step 2: Create reiver-squad.md following the template**

- [ ] **Step 3: Verify completeness**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/reiver-squad.md"
git commit -m "feat: add Reiver Squad datasheet"
```

---

### Task 14: Create Repulsor Executioner Datasheet

**Files:**
- Create: `datasheets/space-marines/repulsor-executioner.md`

- [ ] **Step 1: Research Repulsor Executioner datasheet**

Search for: `"Repulsor Executioner" datasheet wahapedia 10th edition weapons abilities`

This is a heavily-armed vehicle. Record: stat line, ALL weapon profiles:
- Heavy laser destroyer
- Heavy onslaught gatling cannon
- Icarus rocket pod
- Ironhail heavy stubber
- Repulsor Executioner defensive array (may be a combined profile)
- Twin Icarus ironhail heavy stubber
- Twin heavy bolter
- Armoured hull (melee)

Also record: all abilities (Deadly Demise, transport capacity, etc.), keywords, points (230 pts). Check for degrading profile.

- [ ] **Step 2: Create repulsor-executioner.md following the template**

This will be one of the larger datasheet files due to the number of weapons.

- [ ] **Step 3: Verify all weapons are accounted for**

Cross-reference against the Captain's army list weapons for this unit.

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/repulsor-executioner.md"
git commit -m "feat: add Repulsor Executioner datasheet"
```

---

### Task 15: Create Sternguard Veteran Squad Datasheet

**Files:**
- Create: `datasheets/space-marines/sternguard-veteran-squad.md`

**Known data from this session:**
- Stat line: M 6", T 4, Sv 3+, W 2, Ld 6+, OC 1
- Sternguard bolt rifle: 24", A2, BS 3+, S4, AP-1, D1 [Assault, Devastating Wounds, Heavy, Rapid Fire 1]
- Sternguard bolt pistol: 12", A1, BS 3+, S4, AP 0, D1 [Devastating Wounds, Pistol]
- Close combat weapon: Melee, A4, WS 3+, S4, AP 0, D1
- Sternguard Focus: re-roll wound rolls against Oath of Moment target

- [ ] **Step 1: Research Sternguard Veteran Squad for any missing data**

Search for: `"Sternguard Veteran Squad" datasheet wahapedia 10th edition`

Verify the known data above. Additionally research:
- Sternguard Veteran Sergeant stat line (may differ from regular Veterans)
- Sergeant weapon options (power weapon profile)
- Sternguard heavy bolter profile (the Captain's list includes 2)
- Combi-weapon profile
- Pyrecannon profile
- Full wargear options text
- Full keywords list
- Unit composition options (5 or 10 models)

- [ ] **Step 2: Create sternguard-veteran-squad.md**

Write the complete datasheet using known data plus research. The Captain's specific loadout is: 1 Sergeant (power weapon + bolt rifle + bolt pistol), 7 Veterans with bolt rifles, 2 Veterans with Sternguard heavy bolters.

- [ ] **Step 3: Verify all weapons present**

Confirm the file includes: Sternguard bolt rifle, Sternguard bolt pistol, Sternguard heavy bolter, close combat weapon, power weapon (Sergeant), combi-weapon (option), and pyrecannon (option).

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/sternguard-veteran-squad.md"
git commit -m "feat: add Sternguard Veteran Squad datasheet"
```

---

### Task 16: Create Victrix Honour Guard Datasheet

**Files:**
- Create: `datasheets/space-marines/victrix-honour-guard.md`

- [ ] **Step 1: Research Victrix Honour Guard datasheet**

Search for: `"Victrix Honour Guard" datasheet wahapedia 10th edition weapons abilities`

This is an Ultramarines-specific unit. Record: stat lines for Chapter Ancient, Chapter Champion, and Victrix Honour Guard models (may differ). Record all weapon profiles:
- Banner of Macragge (Ancient)
- Blades of honour (Champion)
- Master-crafted bolt carbine
- Master-crafted power weapon

Record all abilities, keywords, points (220 pts for 6 models), unit composition.

- [ ] **Step 2: Create victrix-honour-guard.md following the template**

Use multi-profile stat line table if models have different stat lines.

- [ ] **Step 3: Verify completeness**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/victrix-honour-guard.md"
git commit -m "feat: add Victrix Honour Guard datasheet"
```

---

### Task 17: Create Wardens of Ultramar Datasheet

**Files:**
- Create: `datasheets/space-marines/wardens-of-ultramar.md`

**Known data from this session:**

Stat lines:
- Ancient Gadriel, Vet Sgt Metaurus: M 6", T 4, Sv 3+, W 4, Ld 6+, OC 1
- Gaius Silva: M 6", T 3, Sv 4+, W 3, Ld 6+, OC 1 (Inv 5+ from Refractor Field)
- Aemelia Minervas, Dainal Kornelius, Lucia Vestha: M 6", T 3, Sv 4+, W 3, Ld 6+, OC 1
- Metaurus has 4+ Inv from Storm Shield

Ranged weapons:
- Bolt rifle (Gadriel): 24", A2, BS 3+, S4, AP-1, D1 [Assault, Heavy]
- Heavy bolt pistol (Metaurus): 18", A1, BS 3+, S4, AP-1, D1 [Pistol]
- Archeotech laspistol (Silva, Minervas, Vestha): 12", A1, BS 3+, S4, AP-1, D1 [Pistol]
- Astropathic blast (Kornelius): 12", A D6, BS 3+, S4, AP-1, D1 [Blast, Psychic]

Melee weapons:
- Close combat weapon (Gadriel): A4, WS 2+, S4, AP 0, D1
- Master-crafted power weapon (Metaurus): A5, WS 2+, S5, AP-2, D2
- Power weapon (Silva, Minervas): A4, WS 2+, S4, AP-2, D1
- Force stave (Kornelius): A1, WS 2+, S5, AP-2, D2 [Psychic]
- Close combat weapon (Vestha): A4, WS 2+, S4, AP 0, D1

Abilities: Second Company Banner, Strategium Command, Heroes of Ultramar.

- [ ] **Step 1: Research any missing data**

Search for: `"Wardens of Ultramar" datasheet wahapedia 10th edition abilities`

Verify all known data above. Research the full text of: Second Company Banner, Strategium Command, Heroes of Ultramar abilities. Confirm points (105 pts) and full keywords list.

- [ ] **Step 2: Create wardens-of-ultramar.md**

Write the complete datasheet using confirmed data. Use multi-profile stat line table with Model column (6 rows, one per named model).

Weapon tables should note which model carries each weapon in parentheses, e.g. "Bolt rifle (Gadriel)".

- [ ] **Step 3: Verify all 6 models and all weapons present**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/wardens-of-ultramar.md"
git commit -m "feat: add Wardens of Ultramar datasheet"
```

---

### Task 18: Create Tyranids Infrastructure

**Files:**
- Create: `datasheets/tyranids/faction-rules.md`
- Create: `datasheets/tyranids/weapons/common-ranged.md`
- Create: `datasheets/tyranids/weapons/common-melee.md`

- [ ] **Step 1: Research Tyranids faction rules**

Search for: `Tyranids faction ability "Synapse" 10th edition full rules text`

Also search for Shadow in the Warp and any other army-wide rules.

- [ ] **Step 2: Create faction-rules.md**

```markdown
# Tyranids — Faction Rules

## Synapse

[Full rules text]

## Shadow in the Warp

[Full rules text, if it exists as a faction-wide rule in 10th edition]

<!-- Last verified: 2026-04-10 -->
```

- [ ] **Step 3: Create common weapons files**

For only 2 Tyranid units, the common weapons files may be minimal or empty. Check if Trygon and Tyrannofex share any identical weapon profiles. If they do, list them. If not, create the files with a note that no shared profiles exist yet.

```markdown
# Tyranids — Common Ranged Weapons

No shared ranged weapon profiles across catalogued units yet.

<!-- Last verified: 2026-04-10 -->
```

- [ ] **Step 4: Commit**

```bash
git add "datasheets/tyranids/faction-rules.md" "datasheets/tyranids/weapons/"
git commit -m "feat: add Tyranids faction rules and common weapons"
```

---

### Task 19: Create Trygon Datasheet

**Files:**
- Create: `datasheets/tyranids/trygon.md`

**Known data from this session:**
- Stat line: M 10", T 10, Sv 3+, W 14, Ld 8+, OC 4, no Inv, no FNP
- Bio-electric pulse: 12", A6, BS 3+, S5, AP 0, D1 [Sustained Hits 2]
- Trygon scything talons: A12, WS 3+, S9, AP-2, D3
- Abilities: Deep Strike (core), Synapse (faction), Subterranean Tunnels
- Damaged: 1-5 wounds, -1 to Hit rolls
- Points: 140
- Keywords: Monster, Great Devourer, Vanguard Invader, Burrower, Trygon

- [ ] **Step 1: Verify known data and research missing details**

Search for: `Trygon datasheet wahapedia 10th edition` to verify all stats and get full ability text for Subterranean Tunnels.

Also confirm: wargear options (if any), unit composition, full keywords list, faction keywords.

- [ ] **Step 2: Create trygon.md**

Write the complete datasheet using verified data:

```markdown
# Trygon

**Points:** 140 | **Role:** Monster

**Keywords:** Monster, Great Devourer, Vanguard Invader, Burrower, Trygon
**Faction Keywords:** Tyranids

## Stat Line

| M    | T  | Sv  | W  | Ld  | OC | Inv | FNP |
|------|----|----|----|----|----|----|-----|
| 10"  | 10 | 3+ | 14 | 8+ | 4  | —  | —   |

## Ranged Weapons

| Weapon              | Range | A | BS | S | AP | D | Keywords        |
|---------------------|-------|---|----|---|----|---|-----------------|
| Bio-electric pulse  | 12"   | 6 | 3+ | 5 | 0  | 1 | Sustained Hits 2 |

## Melee Weapons

| Weapon                  | A  | WS | S | AP | D | Keywords |
|-------------------------|----|----|---|----|---|----------|
| Trygon scything talons  | 12 | 3+ | 9 | -2 | 3 |          |

## Abilities

**Core:** Deep Strike
**Faction:** Synapse

### Subterranean Tunnels

[Full researched rules text — known summary: when set up via Deep Strike, can be placed 6" from enemies instead of 9", but cannot charge that turn]

## Damaged

**Threshold:** 1-5 wounds remaining
**Effect:** Each time this model makes an attack, subtract 1 from the Hit roll.

## Unit Composition

- 1x Trygon — equipped with: bio-electric pulse, Trygon scything talons

<!-- Last verified: 2026-04-10 -->
```

- [ ] **Step 3: Verify completeness**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/tyranids/trygon.md"
git commit -m "feat: add Trygon datasheet"
```

---

### Task 20: Create Tyrannofex Datasheet

**Files:**
- Create: `datasheets/tyranids/tyrannofex.md`

**Known data from this session:**
- Stat line: M 9", T 12, Sv 2+, W 16, Ld 8+, OC 5, no Inv, no FNP
- Abilities: Deadly Demise D6, Synapse (faction), Resilient Organism (once per battle, set one attack's damage to 0)
- Damaged: 1-5 wounds, -1 to Hit rolls
- Points: 200 (confirmed from Wahapedia result, noting the Captain's list may differ)

- [ ] **Step 1: Research Tyrannofex weapons and full abilities**

Search for: `Tyrannofex datasheet wahapedia 10th edition weapons`

The Tyrannofex has multiple main weapon options (acid spray, fleshborer hive, rupture cannon) and secondary weapons (stinger salvo, thorax swarm variants). Record ALL weapon profiles including all options.

Also verify: full text of Resilient Organism, Deadly Demise D6, points cost, keywords.

- [ ] **Step 2: Create tyrannofex.md following the template**

Include all weapon options, not just the equipped loadout. Note which weapon is the default and which are alternatives.

- [ ] **Step 3: Verify completeness — especially all weapon options**

- [ ] **Step 4: Commit**

```bash
git add "datasheets/tyranids/tyrannofex.md"
git commit -m "feat: add Tyrannofex datasheet"
```

---

### Task 21: Create Faction Indexes

**Depends on:** All datasheet tasks (5–20) completed.

**Files:**
- Create: `datasheets/space-marines/index.md`
- Create: `datasheets/tyranids/index.md`

- [ ] **Step 1: Read all completed datasheets to extract points and roles**

Read the header of every datasheet file in `datasheets/space-marines/` and `datasheets/tyranids/` to extract unit name, points, and role.

- [ ] **Step 2: Create Space Marines index.md**

```markdown
# Space Marines — Datasheet Index

| Unit                      | Role       | Points | File                          |
|---------------------------|------------|--------|-------------------------------|
| Ballistus Dreadnought     | Other      | 150    | ballistus-dreadnought.md      |
| Captain Titus             | Character  | 90     | captain-titus.md              |
| Cato Sicarius             | Character  | 95     | cato-sicarius.md              |
| Intercessor Squad         | Battleline | 80     | intercessor-squad.md          |
| Lieutenant                | Character  | 65     | lieutenant.md                 |
| Marneus Calgar            | Character  | 140    | marneus-calgar.md             |
| Redemptor Dreadnought     | Other      | 205    | redemptor-dreadnought.md      |
| Reiver Squad              | Other      | 80     | reiver-squad.md               |
| Repulsor Executioner      | Other      | 230    | repulsor-executioner.md       |
| Roboute Guilliman         | Character  | 340    | roboute-guilliman.md          |
| Sternguard Veteran Squad  | Other      | 200    | sternguard-veteran-squad.md   |
| Victrix Honour Guard      | Other      | 220    | victrix-honour-guard.md       |
| Wardens of Ultramar       | Other      | 105    | wardens-of-ultramar.md        |

**Also see:**
- [Faction Rules](faction-rules.md)
- [Blade of Ultramar Detachment](detachments/blade-of-ultramar.md)
- [Common Ranged Weapons](weapons/common-ranged.md)
- [Common Melee Weapons](weapons/common-melee.md)

<!-- Last verified: 2026-04-10 -->
```

Adjust points from actual datasheet files (not assumed values).

- [ ] **Step 3: Create Tyranids index.md**

```markdown
# Tyranids — Datasheet Index

| Unit         | Role    | Points | File             |
|--------------|---------|--------|------------------|
| Trygon       | Monster | 140    | trygon.md        |
| Tyrannofex   | Monster | 200    | tyrannofex.md    |

**Also see:**
- [Faction Rules](faction-rules.md)
- [Common Ranged Weapons](weapons/common-ranged.md)
- [Common Melee Weapons](weapons/common-melee.md)

<!-- Last verified: 2026-04-10 -->
```

- [ ] **Step 4: Commit**

```bash
git add "datasheets/space-marines/index.md" "datasheets/tyranids/index.md"
git commit -m "feat: add faction datasheet indexes"
```

---

### Task 22: Final Review and Verification

**Depends on:** Task 21 complete.

- [ ] **Step 1: Verify all files exist**

```bash
find "/Users/tomhunterii/Documents/Warhammer 40k/datasheets" -name "*.md" | sort
```

Expected: 24 `.md` files total (14 SM datasheets + SM faction-rules + SM index + 2 SM common weapons + 1 detachment + 2 Tyranid datasheets + Tyranid faction-rules + Tyranid index + 2 Tyranid common weapons).

- [ ] **Step 2: Verify each datasheet has all required sections**

For each unit datasheet, confirm it contains:
- Points and Role header
- Keywords (unit + faction)
- Stat Line table
- Ranged Weapons table (if unit has ranged weapons)
- Melee Weapons table (if unit has melee weapons)
- Abilities section with full rules text
- Unit Composition
- `<!-- Last verified -->` footer

- [ ] **Step 3: Verify table alignment across all files**

Spot-check at least 5 files to confirm column padding is consistent and tables render cleanly.

- [ ] **Step 4: Cross-reference against the Captain's army list**

Verify every unit in the army list has a datasheet:
- Captain Titus ✓
- Cato Sicarius ✓
- Lieutenant ✓
- Marneus Calgar ✓
- Roboute Guilliman ✓
- Intercessor Squad ✓
- Ballistus Dreadnought ✓
- Redemptor Dreadnought ✓
- Reiver Squad ✓
- Repulsor Executioner ✓
- Sternguard Veteran Squad ✓
- Victrix Honour Guard ✓
- Wardens of Ultramar ✓

- [ ] **Step 5: Commit any corrections**

```bash
git add -A "datasheets/"
git commit -m "fix: final review corrections across datasheet catalogue"
```

Only commit if corrections were needed. Skip if everything passes.
