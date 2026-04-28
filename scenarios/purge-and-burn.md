---
# ─────────────────────────────────────────────────────────────────────────
# MISSION METADATA
# ─────────────────────────────────────────────────────────────────────────
id: purge-and-burn
name: "Purge and Burn"
mission_number: 2
source: "500 Worlds Campaign / Vespator Front"
source_file: "campaign/09-full-missions.md"
source_book_page: 46

narrative: >
  During exterminations of Genestealer Cultists on Norallus, the Scythes of
  the Emperor surrounded a broodmass at the Halex Mine Dock. They vowed to
  prevent xenocultist attempts to spread their curse by escaping the planet.

# ─────────────────────────────────────────────────────────────────────────
# BOARD
# ─────────────────────────────────────────────────────────────────────────
# Coordinate convention:
#   Origin at top-left. X increases rightward (0 → width_in).
#   Y increases downward (0 → height_in).
#   All polygon/segment coordinates are in inches as [x, y] pairs.
board:
  width_in: 60
  height_in: 44
  orientation: landscape
  origin: top_left
  y_axis_direction: down

# ─────────────────────────────────────────────────────────────────────────
# DEPLOYMENT ZONES
# ─────────────────────────────────────────────────────────────────────────
# Each player may have one or more polygons. Each polygon is a closed
# region defined by an ordered list of [x, y] vertices (in inches).
deployment:
  attacker:
    polygons:
      - id: top_left_wedge
        description: "Right triangle at top-left corner. Right angle at (0, 0); 13\" down left edge; 30\" along top edge."
        vertices: [[0, 0], [0, 13], [30, 0]]
      - id: top_right_wedge
        description: "Right triangle at top-right corner. Right angle at (60, 0); 13\" down right edge; 30\" along top edge."
        vertices: [[60, 0], [60, 13], [30, 0]]
  defender:
    polygons:
      - id: middle_chevron_band
        description: "9-inch-thick chevron band across the middle of the board. Upper apex (30, 12) points up; lower apex (30, 21) sits 1\" above board centre."
        vertices: [[60, 25], [30, 12], [0, 25], [0, 34], [30, 21], [60, 34]]

# ─────────────────────────────────────────────────────────────────────────
# BATTLEFIELD EDGES
# ─────────────────────────────────────────────────────────────────────────
# Line segments where each player's Strategic Reserves enter the battlefield.
# A single player may have multiple disjoint edge segments (Purge and Burn
# is a rare case where the Defender has two side segments instead of a full
# edge).
battlefield_edges:
  attacker:
    - id: bottom_edge
      description: "Full bottom edge of the map (60\" wide)."
      segment: [[0, 44], [60, 44]]
  defender:
    - id: left_side_gate
      description: "9\" segment on the left side, from (0, 25) to (0, 34)."
      segment: [[0, 25], [0, 34]]
    - id: right_side_gate
      description: "9\" segment on the right side, from (60, 25) to (60, 34)."
      segment: [[60, 25], [60, 34]]

# ─────────────────────────────────────────────────────────────────────────
# TURN ORDER
# ─────────────────────────────────────────────────────────────────────────
# Set by the Primed Garrison mission rule.
first_turn: defender

# ─────────────────────────────────────────────────────────────────────────
# OBJECTIVE MARKERS
# ─────────────────────────────────────────────────────────────────────────
# Purge and Burn has no objective markers. The mission is scored entirely on
# end-game conditions (Breakthrough + Annihilation).
objective_markers: []

# ─────────────────────────────────────────────────────────────────────────
# STRATEGIC RESERVES
# ─────────────────────────────────────────────────────────────────────────
# Caps on the points value of units that can be held in Strategic Reserves.
# The Attacker's cap is set by the Encirclement mission rule.
# The Defender uses the standard 10th-edition cap (no mission override).
strategic_reserves:
  attacker:
    cap_by_battle_size:
      incursion: 500
      strike_force: 1000
      onslaught: 1500
  defender:
    cap_by_battle_size: null  # standard 10th Ed rules apply

# ─────────────────────────────────────────────────────────────────────────
# SCORING
# ─────────────────────────────────────────────────────────────────────────
# Purge and Burn has NO primary (progressive) scoring — only end-game
# objectives evaluated once at the end of the battle.
scoring:
  type: end_game_only
  objectives:
    - id: breakthrough
      scorer: defender
      name: "Breakthrough"
      description: >
        At the end of the battle, total the points value of the Defender's
        units within 9\" of the Attacker's battlefield edge. Score VP from
        the table below based on battle size.
      scoring_zone:
        polygon: [[0, 35], [60, 35], [60, 44], [0, 44]]
        depth_from_edge_in: 9
        edge_ref: "attacker.bottom_edge"
      measure: total_points_of_units_in_scoring_zone
      target: defender_units
      vp_tables:
        incursion:
          - { min_pts: 0,    max_pts: 0,    vp: 0 }
          - { min_pts: 1,    max_pts: 99,   vp: 5 }
          - { min_pts: 100,  max_pts: 249,  vp: 15 }
          - { min_pts: 250,  max_pts: 399,  vp: 25 }
          - { min_pts: 400,  max_pts: 549,  vp: 45 }
          - { min_pts: 550,  max_pts: 699,  vp: 60 }
          - { min_pts: 700,  max_pts: null, vp: 80 }
        strike_force:
          - { min_pts: 0,    max_pts: 199,  vp: 0 }
          - { min_pts: 200,  max_pts: 399,  vp: 5 }
          - { min_pts: 400,  max_pts: 699,  vp: 15 }
          - { min_pts: 700,  max_pts: 999,  vp: 25 }
          - { min_pts: 1000, max_pts: 1399, vp: 45 }
          - { min_pts: 1400, max_pts: 1799, vp: 60 }
          - { min_pts: 1800, max_pts: null, vp: 80 }
        onslaught:
          - { min_pts: 0,    max_pts: 299,  vp: 0 }
          - { min_pts: 300,  max_pts: 599,  vp: 5 }
          - { min_pts: 600,  max_pts: 1099, vp: 15 }
          - { min_pts: 1100, max_pts: 1499, vp: 25 }
          - { min_pts: 1500, max_pts: 1999, vp: 45 }
          - { min_pts: 2000, max_pts: 2499, vp: 60 }
          - { min_pts: 2500, max_pts: null, vp: 80 }

    - id: annihilation
      scorer: attacker
      name: "Annihilation"
      description: >
        At the end of the battle, total the points value of the Defender's
        units that are destroyed. Score VP from the table below based on
        battle size.
      measure: total_points_of_destroyed_units
      target: defender_units
      vp_tables:
        incursion:
          - { min_pts: 0,    max_pts: 99,   vp: 0 }
          - { min_pts: 100,  max_pts: 199,  vp: 5 }
          - { min_pts: 200,  max_pts: 349,  vp: 15 }
          - { min_pts: 350,  max_pts: 499,  vp: 25 }
          - { min_pts: 500,  max_pts: 649,  vp: 40 }
          - { min_pts: 650,  max_pts: 799,  vp: 55 }
          - { min_pts: 800,  max_pts: null, vp: 80 }
        strike_force:
          - { min_pts: 0,    max_pts: 199,  vp: 0 }
          - { min_pts: 200,  max_pts: 399,  vp: 5 }
          - { min_pts: 400,  max_pts: 699,  vp: 15 }
          - { min_pts: 700,  max_pts: 999,  vp: 25 }
          - { min_pts: 1000, max_pts: 1399, vp: 40 }
          - { min_pts: 1400, max_pts: 1799, vp: 55 }
          - { min_pts: 1800, max_pts: null, vp: 80 }
        onslaught:
          - { min_pts: 0,    max_pts: 299,  vp: 0 }
          - { min_pts: 300,  max_pts: 599,  vp: 5 }
          - { min_pts: 600,  max_pts: 1099, vp: 15 }
          - { min_pts: 1100, max_pts: 1499, vp: 25 }
          - { min_pts: 1500, max_pts: 1999, vp: 40 }
          - { min_pts: 2000, max_pts: 2499, vp: 55 }
          - { min_pts: 2500, max_pts: null, vp: 80 }

# ─────────────────────────────────────────────────────────────────────────
# MISSION RULES
# ─────────────────────────────────────────────────────────────────────────
# Structured effect blocks. Each rule has:
#   - id: stable machine identifier
#   - name: human-readable
#   - description: full rulebook text
#   - effect: typed effect(s) with parameters for auto-application
#
# Effect types are open-ended. The renderer/app may recognise known types
# and auto-apply; unknown types are shown to the player as text only.
# Effect schemas will be normalised in a future phase as patterns emerge
# across missions.
mission_rules:
  - id: primed_garrison
    name: "Primed Garrison"
    description: "The Defender has the first turn."
    effect:
      type: first_turn_override
      player: defender

  - id: baited_ambush_routes
    name: "Baited Ambush Routes"
    description: >
      At the end of the Deploy Armies step, the Defender can set up two
      ambush markers on the battlefield (circular 40 mm diameter markers
      should be used). If their Alliance's Power Level at this Planet is
      3 or more, they can set up one additional ambush marker. Each ambush
      marker must be set up more than 9" away from all other ambush markers,
      and not within either player's deployment zone.

      Each time a unit ends a Normal, Advance or Fall Back move within 3"
      of an ambush marker:
        - First, roll one D6: on a 2-4, that unit suffers D3 mortal wounds;
          on a 5+, that unit suffers 3 mortal wounds.
        - Then, roll one D6: on a 5+, remove that ambush marker from the
          battlefield.
    effect:
      type: marker_placement
      placer: defender
      timing: end_of_deploy_armies
      count:
        base: 2
        conditional_bonuses:
          - condition:
              param: defender.alliance.power_level_at_planet
              op: ">="
              value: 3
            add: 1
      marker:
        shape: round
        diameter_mm: 40
        placement_constraints:
          - type: min_distance_between_markers
            distance_in: 9  # "more than 9 inches" — strict
            strict: true
          - type: not_in_deployment_zone
            players: [attacker, defender]
      trigger:
        event: unit_ends_movement_within
        distance_in: 3
        move_types: [normal, advance, fall_back]
        apply_to: moving_unit
        resolutions_ordered:
          - type: damage_roll
            die: D6
            outcomes:
              "2-4":
                mortal_wounds: "D3"
              "5+":
                mortal_wounds: 3
          - type: marker_removal_roll
            die: D6
            outcomes:
              "5+":
                remove_marker: true

  - id: encirclement
    name: "Encirclement"
    description: >
      In the Declare Battle Formations step, the maximum combined points
      value of the Attacker's units that can be placed into Strategic
      Reserves is shown in the table below.

      | Battle Size  | Points Total |
      |--------------|-------------|
      | Incursion    | 500 pts     |
      | Strike Force | 1000 pts    |
      | Onslaught    | 1500 pts    |
    effect:
      type: strategic_reserve_cap
      player: attacker
      cap_by_battle_size:
        incursion: 500
        strike_force: 1000
        onslaught: 1500

  - id: oppression_tactics
    name: "Oppression Tactics"
    description: >
      At the start of the first battle round, the Attacker can select a
      number of enemy units up to their Alliance's Power Level at this
      Planet (to a maximum of three). For each of those units:
        - That unit must take a Battle-shock test, subtracting 1 from the
          result.
        - Until the end of the battle round, subtract 2 from that unit's
          Move characteristic and subtract 2 from Charge rolls made for
          that unit (this is not cumulative with any other negative
          modifiers to that unit's Move characteristic or Charge rolls
          made for it).
    effect:
      type: turn_start_debuff
      applier: attacker
      timing: start_of_battle_round
      active_rounds: [1]
      target_selection:
        max_count_formula: "min(attacker.alliance.power_level_at_planet, 3)"
        target_filter: enemy_units
      effects_applied:
        - type: battle_shock_test
          modifier: -1
        - type: stat_modifier
          stat: move
          modifier_in: -2
          non_cumulative_with: move_negative_modifiers
        - type: stat_modifier
          stat: charge_roll
          modifier: -2
          non_cumulative_with: charge_negative_modifiers

# ─────────────────────────────────────────────────────────────────────────
# CAMPAIGN OUTCOMES
# ─────────────────────────────────────────────────────────────────────────
# How the result of this mission affects the Vespator Front meta-campaign.
# Effects are applied in order.
campaign_outcomes:
  attacker_wins:
    description: >
      Between their preparatory assaults sowing disorder and their
      encirclement cutting off escape routes, the victors have crushed the
      power of their foes and — more importantly — prevented them from
      moving their power base to support their allies.
    effects_ordered:
      - condition:
          param_a: attacker.alliance.power_level_at_planet
          op: ">="
          param_b: defender.alliance.power_level_at_planet
        action:
          type: power_level_change
          target: defender.alliance
          planet: this_planet
          delta: -1
      - action:
          type: power_level_change
          target: attacker.alliance
          planet: this_planet
          delta: +1

  defender_wins:
    description: >
      Other worlds, other systems, of the Vespator Front beckon. Having
      thwarted the attackers' aims to cull their numbers, the victors are
      now in a position to reinforce multiple outposts in neighbouring
      systems with greater strength.
    effects_ordered:
      - action:
          type: player_choice_repeatable
          who: defender
          per_choice:
            type: power_level_transfer
            from:
              target: defender.alliance
              planet: this_planet
              delta: -1
            to:
              target: defender.alliance
              planet: connected_planet
              delta: +1
      - action:
          type: power_level_change
          target: defender.alliance
          planet: connected_planet
          delta: +1

  draw:
    description: "Attacking Alliance gains 1 Power Level at this Planet."
    effects_ordered:
      - action:
          type: power_level_change
          target: attacker.alliance
          planet: this_planet
          delta: +1

# ─────────────────────────────────────────────────────────────────────────
# PROVENANCE
# ─────────────────────────────────────────────────────────────────────────
last_verified: "2026-04-23"
verified_against:
  - "500 Worlds Campaign book, page 46 (deployment map)"
  - "campaign/09-full-missions.md lines 216-348"
  - "Captain's hand-drawn polygons via deployment-drawer.html (2026-04-23)"
geometry_reference: "campaign/purge-and-burn-geometry.html"
---

# Mission 2: Purge and Burn

> *During exterminations of Genestealer Cultists on Norallus, the Scythes of the Emperor surrounded a broodmass at the Halex Mine Dock. They vowed to prevent xenocultist attempts to spread their curse by escaping the planet.*

## Mission Rules

**Primed Garrison.** The Defender has the first turn.

**Baited Ambush Routes.** At the end of the Deploy Armies step, the Defender can set up two ambush markers on the battlefield (circular 40 mm diameter markers should be used). If their Alliance's Power Level at this Planet is 3 or more, they can set up one additional ambush marker. Each ambush marker must be set up more than 9" away from all other ambush markers, and not within either player's deployment zone.

Each time a unit ends a Normal, Advance or Fall Back move within 3" of an ambush marker:

- First, roll one D6: on a 2-4, that unit suffers D3 mortal wounds; on a 5+, that unit suffers 3 mortal wounds.
- Then, roll one D6: on a 5+, remove that ambush marker from the battlefield.

**Encirclement.** In the Declare Battle Formations step, the maximum combined points value of the Attacker's units that can be placed into Strategic Reserves is shown in the table below.

| Battle Size  | Points Total |
|--------------|--------------|
| Incursion    | 500 pts      |
| Strike Force | 1000 pts     |
| Onslaught    | 1500 pts     |

**Oppression Tactics.** At the start of the first battle round, the Attacker can select a number of enemy units up to their Alliance's Power Level at this Planet (to a maximum of three). For each of those units:

- That unit must take a Battle-shock test, subtracting 1 from the result.
- Until the end of the battle round, subtract 2 from that unit's Move characteristic and subtract 2 from Charge rolls made for that unit (this is not cumulative with any other negative modifiers to that unit's Move characteristic or Charge rolls made for it).

## Mission Objectives

### Breakthrough (End Game Objective — Defender scores)

*Smash through the foe's choke points and evade their interceptions. Reach the extraction route by any means necessary.*

At the end of the battle, total the points values of the Defender's units that are within 9" of the Attacker's battlefield edge. The Defender scores the corresponding number of VP shown in the table below, depending on the battle size.

| VP  | Incursion      | Strike Force     | Onslaught          |
|-----|----------------|------------------|--------------------|
| 0   | 0 pts          | 0-199 pts        | 0-299 pts          |
| 5   | 1-99 pts       | 200-399 pts      | 300-599 pts        |
| 15  | 100-249 pts    | 400-699 pts      | 600-1099 pts       |
| 25  | 250-399 pts    | 700-999 pts      | 1100-1499 pts      |
| 45  | 400-549 pts    | 1000-1399 pts    | 1500-1999 pts      |
| 60  | 550-699 pts    | 1400-1799 pts    | 2000-2499 pts      |
| 80  | 700+ pts       | 1800+ pts        | 2500+ pts          |

### Annihilation (End Game Objective — Attacker scores)

*Do not allow your prey to slip away. Track them down, cut off their escape routes and terminate their attempts to reinforce other worlds. This hunt must end here.*

At the end of the battle, total the points values of the Defender's units that are destroyed. The Attacker scores the corresponding number of VP shown in the table below, depending on the battle size.

| VP  | Incursion      | Strike Force     | Onslaught          |
|-----|----------------|------------------|--------------------|
| 0   | 0-99 pts       | 0-199 pts        | 0-299 pts          |
| 5   | 100-199 pts    | 200-399 pts      | 300-599 pts        |
| 15  | 200-349 pts    | 400-699 pts      | 600-1099 pts       |
| 25  | 350-499 pts    | 700-999 pts      | 1100-1499 pts      |
| 40  | 500-649 pts    | 1000-1399 pts    | 1500-1999 pts      |
| 55  | 650-799 pts    | 1400-1799 pts    | 2000-2499 pts      |
| 80  | 800+ pts       | 1800+ pts        | 2500+ pts          |

## Deployment

Board dimensions: **60" × 44"** (landscape orientation).

**Attacker's deployment zone:** Two right triangles, one at each top corner of the board.

- Left wedge: right angle at `(0, 0)`; legs 13" down the left edge to `(0, 13)` and 30" along the top edge to `(30, 0)`; hypotenuse `(0, 13)` → `(30, 0)`.
- Right wedge: right angle at `(60, 0)`; legs 13" down the right edge to `(60, 13)` and 30" along the top edge to `(30, 0)`; hypotenuse `(60, 13)` → `(30, 0)`.
- The two wedges meet at the top-centre of the map, `(30, 0)`.

**Defender's deployment zone:** A single 9"-thick chevron band across the middle of the board.

- Polygon vertices: `(60, 25) → (30, 12) → (0, 25) → (0, 34) → (30, 21) → (60, 34)`.
- Upper apex at `(30, 12)` points up. Lower apex at `(30, 21)` sits 1" above the actual board centre `(30, 22)`.
- The band is uniformly 9" thick at the sides and through the centre.

**Attacker's battlefield edge:** the full **bottom edge** of the map — `(0, 44) → (60, 44)`. Strategic Reserves enter from here.

**Defender's battlefield edges:** two **9" segments** on the sides of the map, where the chevron band meets the left and right edges — `(0, 25) → (0, 34)` on the left and `(60, 25) → (60, 34)` on the right. Defender's Strategic Reserves enter from either gate.

**Objective markers:** none. Scoring is end-game only (Breakthrough + Annihilation).

## Campaign Outcome

### Attacker Wins

*Between their preparatory assaults sowing disorder and their encirclement cutting off escape routes, the victors have crushed the power of their foes and — more importantly — prevented them from moving their power base to support their allies.*

In order:

- If the Attacking Alliance's Power Level at this Planet is equal to or greater than the Defending Alliance's Power Level at this Planet, subtract 1 from that Defending Alliance's Power Level.
- Add 1 to the Attacking Alliance's Power Level at this Planet.

### Defender Wins

*Other worlds, other systems, of the Vespator Front beckon. Having thwarted the attackers' aims to cull their numbers, the victors are now in a position to reinforce multiple outposts in neighbouring systems with greater strength.*

In order:

- The Defender can subtract 1 from their Alliance's Power Level at this Planet any number of times. Each time they do, they can add 1 to their Alliance's Power Level at a connected Planet.
- Add 1 to the Defending Alliance's Power Level at a connected Planet.

### Draw

Add 1 to the Attacking Alliance's Power Level at this Planet.

---

## Provenance

- **Rulebook source:** `campaign/09-full-missions.md`, lines 216–348; also `campaign/full-campaign-book-raw.txt` and the book page 46 image at `campaign/mission-maps/page-46.png`.
- **Geometry:** Hand-drawn by Captain Hunter via `campaign/deployment-drawer.html`; visualised at `campaign/purge-and-burn-geometry.html`.
- **Last verified:** 2026-04-23.
