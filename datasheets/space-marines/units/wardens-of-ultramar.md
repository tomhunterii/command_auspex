---
slug: wardens-of-ultramar
faction: space-marines
sub_factions: [adeptus-astartes, ultramarines]
epic_hero: true
battleline: false
is_character: false
loadouts:
  - models: 6
    points: 90
    default: true
keywords:
  faction: [Adeptus Astartes, Ultramarines]
  unit: [Infantry, Epic Hero, Grenades, Imperium, Tacticus, Wardens of Ultramar]
led_by: [captain-titus]
# Heroes of Ultramar: this unit can ATTACH to one of the listed squads at the
# start of the Declare Battle Formations step (it counts as part of that unit
# for the rest of the battle). Modelled here as the Wardens being a leader
# candidate on each target squad.
can_join: [assault-intercessor-squad, bladeguard-veteran-squad, intercessor-squad, sternguard-veteran-squad]
# When the Wardens have joined a target squad, ONLY Captain Titus may also
# attach to that squad (per the Heroes of Ultramar rule). The UI exposes
# Titus as a co-leader slot on the target squad.
enables_co_leader: captain-titus
---

# Wardens of Ultramar

**Faction:** Space Marines (Ultramarines)
**Source:** Codex: Space Marines (10th Edition) / Wahapedia — Ultramarines-exclusive Epic Hero unit

---

## Keywords

**Faction Keywords:** Adeptus Astartes, Ultramarines
**Unit Keywords:** Infantry, Epic Hero, Grenades, Imperium, Tacticus, Wardens of Ultramar
**Additional Model Keyword:** Psyker (Dainal Kornelius only)

---

## Base

- **Shape:** mixed (per-model)
- **Per-model bases:**
  - Ancient Gadriel: round, 40mm
  - Veteran Sergeant Metaurus: round, 40mm
  - Gaius Silva: round, 28.5mm
  - Aemelia Minervas: round, 28.5mm
  - Dainal Kornelius: round, 28.5mm
  - Lucia Vestha: round, 28.5mm
- **Flight stem:** no (all models)

---

## Profile

| Model                                            | M  | T | Sv | W | Ld | OC |
|--------------------------------------------------|----|---|----|---|----|----|
| Ancient Gadriel                                  | 6" | 4 | 3+ | 4 | 6+ | 1  |
| Veteran Sergeant Metaurus                        | 6" | 4 | 3+ | 4 | 6+ | 1  |
| Gaius Silva                                      | 6" | 3 | 4+ | 3 | 6+ | 1  |
| Aemelia Minervas                                 | 6" | 3 | 4+ | 3 | 6+ | 1  |
| Dainal Kornelius                                 | 6" | 3 | 4+ | 3 | 6+ | 1  |
| Lucia Vestha                                     | 6" | 3 | 4+ | 3 | 6+ | 1  |

**Invulnerable Saves (wargear):**
- Veteran Sergeant Metaurus: 4+ (storm shield)
- Gaius Silva: 5+ (refractor field)

---

## Ranged Weapons

| Weapon                | Range | A  | BS | S | AP | D | Keywords              |
|-----------------------|-------|----|----|---|----|---|-----------------------|
| Archeotech laspistol  | 12"   | 1  | 3+ | 4 | -1 | 1 | [PISTOL]              |
| Astropathic blast     | 12"   | D6 | 3+ | 4 | -1 | 1 | [BLAST], [PSYCHIC]    |
| Bolt rifle            | 24"   | 2  | 3+ | 4 | -1 | 1 | [ASSAULT], [HEAVY]    |
| Heavy bolt pistol     | 18"   | 1  | 3+ | 4 | -1 | 1 | [PISTOL]              |

---

## Melee Weapons

| Weapon                       | Range | A | WS | S | AP | D | Keywords   |
|------------------------------|-------|---|----|---|----|---|------------|
| Close combat weapon          | Melee | 4 | 2+ | 4 | 0  | 1 | —          |
| Force stave                  | Melee | 1 | 2+ | 5 | -2 | 2 | [PSYCHIC]  |
| Power weapon                 | Melee | 4 | 2+ | 4 | -2 | 1 | —          |
| Master-crafted power weapon  | Melee | 5 | 2+ | 5 | -2 | 2 | —          |

---

## Abilities

### Faction
**Oath of Moment.** If your Army Faction is Adeptus Astartes, at the start of your Command phase, select one unit from your opponent's army. Until the start of your next Command phase, that enemy unit is your Oath of Moment target. Each time a model with this ability makes an attack that targets your Oath of Moment target, you can re-roll the Hit roll, and if you are using a Codex: Space Marines Detachment and your army does not include one or more units with the Black Templars, Blood Angels, Dark Angels, Deathwatch or Space Wolves keywords, you can also add 1 to the Wound roll.

### Heroes of Ultramar
At the start of the Declare Battle Formations step, this unit can join one of the following units: Assault Intercessor Squad, Bladeguard Veteran Squad, Intercessor Squad or Sternguard Veteran Squad. This unit then counts as part of that unit for the rest of the battle, and that unit's Starting Strength is increased accordingly. This unit cannot join an Attached unit, and only Captain Titus can be attached to a unit this unit has joined.

### Second Company Banner
While this unit contains Ancient Gadriel, add 1 to the Objective Control characteristic of models in this unit. While this unit contains Ancient Gadriel and Captain Titus is leading the unit this unit has joined, improve the Leadership characteristic of models in this unit by 1 as well.

### Strategium Command
After both players have deployed their armies, if this unit is on the battlefield (or any Transport it is embarked within is on the battlefield), select up to three Adeptus Astartes units from your army and redeploy them. When doing so, you can set those units up in Strategic Reserves, regardless of how many units are already in Strategic Reserves.

---

## Unit Composition

- 1 Ancient Gadriel — Epic Hero
- 1 Veteran Sergeant Metaurus — Epic Hero
- 1 Gaius Silva — Epic Hero
- 1 Aemelia Minervas — Epic Hero
- 1 Dainal Kornelius — Epic Hero (Psyker)
- 1 Lucia Vestha — Epic Hero

**Fixed 6-model unit.** Each named character's wargear is fixed:

- **Ancient Gadriel:** bolt rifle; close combat weapon; standard of the Second Company
- **Veteran Sergeant Metaurus:** heavy bolt pistol; master-crafted power weapon; storm shield
- **Gaius Silva:** archeotech laspistol; power weapon; refractor field
- **Aemelia Minervas:** archeotech laspistol; power weapon
- **Dainal Kornelius:** astropathic blast; force stave
- **Lucia Vestha:** archeotech laspistol; close combat weapon

---

## Wargear Options

None (fixed wargear per character).

---

## Points

**90 points** (6 models — fixed unit size)

> Wahapedia lists 105 pts (stale). MFM v3.9 prints the unit at 90 pts under Codex: Space Marines.

---

## Source

- Wahapedia: https://wahapedia.ru/wh40k10ed/factions/space-marines/Wardens-of-Ultramar-1
- Munitorum Field Manual v3.9 (Feb 2026), Codex: Space Marines section, p.33

<!-- Last verified: 2026-04-21 — source: Wahapedia https://wahapedia.ru/wh40k10ed/factions/space-marines/Wardens-of-Ultramar-1 / MFM v3.9 -->
