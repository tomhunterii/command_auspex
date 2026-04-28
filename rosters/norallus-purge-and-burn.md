---
list_name: "Purge and Burn"
list_points: 2000
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
  - name: "Apothecary Biologis"
    datasheet: "space-marines/apothecary-biologis"
    section: "CHARACTERS"
    points: 85
    warlord: false
    enhancement: "Laurels of Thunder"
    total_models: 1
    models:
      - submodel: "Apothecary Biologis"
        count: 1
        wargear:
          - { count: 1, item: "Absolvor bolt pistol" }
          - { count: 1, item: "Close combat weapon" }
  - name: "Captain Titus"
    datasheet: "space-marines/captain-demetrian-titus"  # manually resolved: 90pts matches Epic Hero, not generic Captain (80pts)
    section: "CHARACTERS"
    points: 90
    warlord: true
    enhancement: null
    total_models: 1
    models:
      - submodel: "Captain Titus"
        count: 1
        wargear:
          - { count: 1, item: "Bolt Pistol" }
          - { count: 1, item: "Master-crafted bolter" }
          - { count: 1, item: "Master-crafted chainsword" }
  - name: "Captain in Terminator Armour"
    datasheet: "space-marines/captain-in-terminator-armour"
    section: "CHARACTERS"
    points: 95
    warlord: false
    enhancement: null
    total_models: 1
    models:
      - submodel: "Captain in Terminator Armour"
        count: 1
        wargear:
          - { count: 1, item: "Relic weapon" }
          - { count: 1, item: "Storm bolter" }
  - name: "Judiciar"
    datasheet: "space-marines/judiciar"
    section: "CHARACTERS"
    points: 70
    warlord: false
    enhancement: null
    total_models: 1
    models:
      - submodel: "Judiciar"
        count: 1
        wargear:
          - { count: 1, item: "Absolvor bolt pistol" }
          - { count: 1, item: "Executioner relic blade" }
  - name: "Lieutenant"
    datasheet: "space-marines/lieutenant"
    section: "CHARACTERS"
    points: 55
    warlord: false
    enhancement: null
    total_models: 1
    models:
      - submodel: "Lieutenant"
        count: 1
        wargear:
          - { count: 1, item: "Heavy bolt pistol" }
          - { count: 1, item: "Master-crafted bolter" }
          - { count: 1, item: "Power fist" }
  - name: "Impulsor"
    datasheet: "space-marines/impulsor"
    section: "DEDICATED TRANSPORTS"
    points: 80
    warlord: false
    enhancement: null
    total_models: 1
    models:
      - submodel: "Impulsor"
        count: 1
        wargear:
          - { count: 1, item: "Armoured hull" }
          - { count: 1, item: "Ironhail heavy stubber" }
          - { count: 1, item: "Shield Dome" }
          - { count: 2, item: "Storm bolter" }
  - name: "Aggressor Squad"
    datasheet: "space-marines/aggressor-squad"
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
  - name: "Ballistus Dreadnought"
    datasheet: "space-marines/ballistus-dreadnought"
    section: "OTHER DATASHEETS"
    points: 150
    warlord: false
    enhancement: null
    total_models: 1
    models:
      - submodel: "Ballistus Dreadnought"
        count: 1
        wargear:
          - { count: 1, item: "Armoured feet" }
          - { count: 1, item: "Ballistus lascannon" }
          - { count: 1, item: "Ballistus missile launcher" }
          - { count: 1, item: "Twin storm bolter" }
  - name: "Bladeguard Veteran Squad"
    datasheet: "space-marines/bladeguard-veteran-squad"
    section: "OTHER DATASHEETS"
    points: 170
    warlord: false
    enhancement: null
    total_models: 6
    models:
      - submodel: "Bladeguard Veteran Sergeant"
        count: 1
        wargear:
          - { count: 1, item: "Master-crafted power weapon" }
          - { count: 1, item: "Plasma pistol" }
      - submodel: "Bladeguard Veteran"
        count: 5
        wargear:
          - { count: 5, item: "Heavy bolt pistol" }
          - { count: 5, item: "Master-crafted power weapon" }
  - name: "Hellblaster Squad"
    datasheet: "space-marines/hellblaster-squad"
    section: "OTHER DATASHEETS"
    points: 110
    warlord: false
    enhancement: null
    total_models: 5
    models:
      - submodel: "Hellblaster Sergeant"
        count: 1
        wargear:
          - { count: 1, item: "Bolt pistol" }
          - { count: 1, item: "Close combat weapon" }
          - { count: 1, item: "Plasma incinerator" }
      - submodel: "Hellblaster"
        count: 4
        wargear:
          - { count: 4, item: "Bolt pistol" }
          - { count: 4, item: "Close combat weapon" }
          - { count: 4, item: "Plasma incinerator" }
  - name: "Inceptor Squad"
    datasheet: "space-marines/inceptor-squad"
    section: "OTHER DATASHEETS"
    points: 120
    warlord: false
    enhancement: null
    total_models: 3
    models:
      - submodel: "Inceptor Sergeant"
        count: 1
        wargear:
          - { count: 1, item: "Close combat weapon" }
          - { count: 1, item: "Plasma exterminators" }
      - submodel: "Inceptor"
        count: 2
        wargear:
          - { count: 2, item: "Close combat weapon" }
          - { count: 2, item: "Plasma exterminators" }
  - name: "Reiver Squad"
    datasheet: "space-marines/reiver-squad"
    section: "OTHER DATASHEETS"
    points: 80
    warlord: false
    enhancement: null
    total_models: 5
    models:
      - submodel: "Reiver Sergeant"
        count: 1
        wargear:
          - { count: 1, item: "Combat knife" }
          - { count: 1, item: "Special issue bolt pistol" }
      - submodel: "Reiver"
        count: 4
        wargear:
          - { count: 4, item: "Combat knife" }
          - { count: 4, item: "Special issue bolt pistol" }
  - name: "Repulsor Executioner"
    datasheet: null
    section: "OTHER DATASHEETS"
    points: 230
    warlord: false
    enhancement: null
    total_models: 1
    models:
      - submodel: "Repulsor Executioner"
        count: 1
        wargear:
          - { count: 1, item: "Armoured hull" }
          - { count: 1, item: "Heavy laser destroyer" }
          - { count: 1, item: "Heavy onslaught gatling cannon" }
          - { count: 1, item: "Icarus rocket pod" }
          - { count: 1, item: "Ironhail heavy stubber" }
          - { count: 1, item: "Repulsor Executioner defensive array" }
          - { count: 1, item: "Twin Icarus ironhail heavy stubber" }
          - { count: 1, item: "Twin heavy bolter" }
  - name: "Sternguard Veteran Squad"
    datasheet: "space-marines/sternguard-veteran-squad"
    section: "OTHER DATASHEETS"
    points: 200
    warlord: false
    enhancement: null
    total_models: 10
    models:
      - submodel: "Sternguard Veteran Sergeant"
        count: 1
        wargear:
          - { count: 1, item: "Close combat weapon" }
          - { count: 1, item: "Power fist" }
          - { count: 1, item: "Sternguard bolt pistol" }
          - { count: 1, item: "Sternguard bolt rifle" }
      - submodel: "Sternguard Veteran"
        count: 9
        wargear:
          - { count: 9, item: "Close combat weapon" }
          - { count: 9, item: "Sternguard bolt pistol" }
          - { count: 7, item: "Sternguard bolt rifle" }
          - { count: 2, item: "Sternguard heavy bolter" }
  - name: "Terminator Squad"
    datasheet: "space-marines/terminator-squad"
    section: "OTHER DATASHEETS"
    points: 170
    warlord: false
    enhancement: null
    total_models: 5
    models:
      - submodel: "Terminator Sergeant"
        count: 1
        wargear:
          - { count: 1, item: "Power weapon" }
          - { count: 1, item: "Storm bolter" }
      - submodel: "Terminator"
        count: 4
        wargear:
          - { count: 4, item: "Power fist" }
          - { count: 4, item: "Storm bolter" }
  - name: "Wardens of Ultramar"
    datasheet: "space-marines/wardens-of-ultramar"
    section: "OTHER DATASHEETS"
    points: 105
    warlord: false
    enhancement: null
    total_models: 6
    models:
      - submodel: "Ancient Gadriel"
        count: 1
        wargear:
          - { count: 1, item: "Bolt rifle" }
          - { count: 1, item: "Close combat weapon" }
      - submodel: "Veteran Sergeant Metaurus"
        count: 1
        wargear:
          - { count: 1, item: "Heavy bolt pistol" }
          - { count: 1, item: "Master-crafted power weapon" }
          - { count: 1, item: "Storm Shield" }
      - submodel: "Gaius Silva"
        count: 1
        wargear:
          - { count: 1, item: "Archeotech laspistol" }
          - { count: 1, item: "Power weapon" }
          - { count: 1, item: "Refractor Field" }
      - submodel: "Aemelia Minervas"
        count: 1
        wargear:
          - { count: 1, item: "Archeotech laspistol" }
          - { count: 1, item: "Power weapon" }
      - submodel: "Dainal Komelius"
        count: 1
        wargear:
          - { count: 1, item: "Astropathic Blast" }
          - { count: 1, item: "Force stave" }
      - submodel: "Lucia Vestha"
        count: 1
        wargear:
          - { count: 1, item: "Archeotech laspistol" }
          - { count: 1, item: "Close combat weapon" }
---

# Purge and Burn

**Battle size:** Strike Force (2000 pts max · 2000 pts used)  
**Faction:** Space Marines / Ultramarines  
**Detachment:** Orbital Assault Force

## Datasheet Resolution Notes

- **Captain Titus** — manually resolved to `space-marines/captain-demetrian-titus` (Epic Hero). 90-pt cost in the export disambiguates from the generic Captain (80 pts).
- **Repulsor Executioner** — no datasheet exists in the archive yet. Needs authoring (pull from Wahapedia + Munitorum Field Manual). Blocks rendering of this unit's threat ranges in the projector.

## Raw Export

Source: `norallus-purge-and-burn.txt`

## Strategic Notes

_Freeform prose — turn priorities, target assignments, stratagem economy, paint status, caveats._
