// Weapons table parser — port of parseWeaponsTable() from
// scripts/build-catalogue.js. Reads the `## Ranged Weapons` or `## Melee
// Weapons` section body and turns each table row into a Weapon record.
//
// Format (variable-width markdown table):
//   | Weapon | Range | A | BS | S | AP | D | Keywords |
//   |--------|-------|---|----|---|----|---|----------|
//   | Bolter | 24"   | 2 | 3+ | 4 | 0  | 1 | RAPID FIRE 1 |
//
// Cells are extracted via `|` split + trim; rows with fewer than 7 non-
// empty cells are skipped. The `keywords` field stores any cells past the
// 7th joined back with " | ".

use super::datasheet::extract_section;
use once_cell::sync::Lazy;
use regex::Regex;

#[derive(Debug, Clone)]
pub struct Weapon {
    pub name: String,
    pub range_in: i64,
    pub attacks: String,
    pub skill: String,
    pub strength: i64,
    pub ap: i64,
    pub damage: String,
    pub keywords: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WeaponKind {
    Ranged,
    Melee,
}

impl WeaponKind {
    pub fn section_name(self) -> &'static str {
        match self {
            WeaponKind::Ranged => "Ranged Weapons",
            WeaponKind::Melee => "Melee Weapons",
        }
    }
    pub fn db_value(self) -> &'static str {
        match self {
            WeaponKind::Ranged => "ranged",
            WeaponKind::Melee => "melee",
        }
    }
}

static WEAPON_HEADER_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^(?i)Weapon$").unwrap());
static NON_DIGIT_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"[^0-9]").unwrap());

pub fn parse_weapons_table(text: &str, kind: WeaponKind) -> Vec<Weapon> {
    let section = match extract_section(text, kind.section_name()) {
        Some(s) => s,
        None => return Vec::new(),
    };
    let mut rows = Vec::new();
    for line in section.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with('|') {
            continue;
        }
        if trimmed.contains("---") {
            continue;
        }
        let cells: Vec<&str> = trimmed
            .split('|')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        if cells.len() < 7 {
            continue;
        }
        if WEAPON_HEADER_RE.is_match(cells[0]) {
            continue; // header row
        }
        let name = cells[0].to_string();
        let range_raw = cells[1];
        let attacks = cells[2].to_string();
        let skill = cells[3].to_string();
        let strength_raw = cells[4];
        let ap_raw = cells[5];
        let damage = cells[6].to_string();
        let keywords = if cells.len() > 7 {
            let joined = cells[7..].join(" | ");
            // The JS `.replace(/^—\s*$/, '')` collapses a single em-dash
            // placeholder cell to empty. We do the same.
            let kw = joined.trim_start_matches('—').trim().to_string();
            if kw.is_empty() {
                None
            } else {
                Some(kw)
            }
        } else {
            None
        };

        let range_in = match kind {
            WeaponKind::Melee => 0,
            WeaponKind::Ranged => {
                // Strip everything but digits, then parse. JS uses
                // `parseInt(s.replace(/[^0-9]/g, ''), 10) || 0`.
                let digits = NON_DIGIT_RE.replace_all(range_raw, "");
                digits.parse::<i64>().unwrap_or(0)
            }
        };
        let strength = strength_raw.parse::<i64>().unwrap_or(0);
        let ap = ap_raw.parse::<i64>().unwrap_or(0);

        rows.push(Weapon {
            name,
            range_in,
            attacks,
            skill,
            strength,
            ap,
            damage,
            keywords,
        });
    }
    rows
}

#[cfg(test)]
mod tests {
    use super::*;

    const RANGED_DATASHEET: &str = "## Ranged Weapons\n\n| Weapon | Range | A | BS | S | AP | D | Keywords |\n|--------|-------|---|----|---|----|---|----------|\n| Bolter | 24\" | 2 | 3+ | 4 | 0 | 1 | [RAPID FIRE 1] |\n| Plasma | 24\" | 1 | 3+ | 7 | -2 | 1 | — |\n";

    #[test]
    fn parses_basic_ranged_table() {
        let weapons = parse_weapons_table(RANGED_DATASHEET, WeaponKind::Ranged);
        assert_eq!(weapons.len(), 2);
        assert_eq!(weapons[0].name, "Bolter");
        assert_eq!(weapons[0].range_in, 24);
        assert_eq!(weapons[0].strength, 4);
        assert_eq!(weapons[0].keywords.as_deref(), Some("[RAPID FIRE 1]"));
    }

    #[test]
    fn em_dash_keywords_become_none() {
        let weapons = parse_weapons_table(RANGED_DATASHEET, WeaponKind::Ranged);
        assert!(weapons[1].keywords.is_none());
    }

    #[test]
    fn melee_kind_zeros_range_in() {
        let melee = "## Melee Weapons\n\n| Weapon | Range | A | WS | S | AP | D | Keywords |\n|--------|-------|---|----|---|----|---|----------|\n| Power fist | Melee | 3 | 3+ | 8 | -2 | 2 | — |\n";
        let weapons = parse_weapons_table(melee, WeaponKind::Melee);
        assert_eq!(weapons.len(), 1);
        assert_eq!(weapons[0].range_in, 0);
    }
}
