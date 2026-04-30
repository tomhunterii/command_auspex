// SQLite INSERT helpers. One function per table. Mirrors the prepare-once /
// run-many pattern from the JS builder, except rusqlite's prepared-statement
// API caches per-connection so we re-prepare per call (rusqlite caches by
// SQL text via its statement cache; this is fast enough for our row counts
// — <100 datasheets means <1k inserts total).

use crate::catalogue::errors::CatalogueError;
use crate::catalogue::parsers::datasheet::{Datasheet, ProfileValue};
use crate::catalogue::parsers::mission::{yaml_value_to_json, Mission};
use crate::catalogue::parsers::weapons::{Weapon, WeaponKind};
use rusqlite::{params, Connection};
use serde_yaml::Value;

/// Look up or create a faction row. Mirrors ensureFaction() from JS.
pub fn ensure_faction(conn: &Connection, slug: &str) -> Result<i64, CatalogueError> {
    if let Some(id) = conn
        .query_row(
            "SELECT id FROM factions WHERE slug = ?1",
            params![slug],
            |row| row.get::<_, i64>(0),
        )
        .ok()
    {
        return Ok(id);
    }
    let name = canonical_faction_name(slug);
    conn.execute(
        "INSERT INTO factions (slug, name) VALUES (?1, ?2)",
        params![slug, name],
    )?;
    Ok(conn.last_insert_rowid())
}

fn canonical_faction_name(slug: &str) -> String {
    match slug {
        "space-marines" => "Space Marines".to_string(),
        "tyranids" => "Tyranids".to_string(),
        "astra-militarum" => "Astra Militarum".to_string(),
        // Fallback: title-case the slug. Matches the JS regex
        // .replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).
        _ => slug
            .split('-')
            .map(|w| {
                let mut chars = w.chars();
                match chars.next() {
                    Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
                    None => String::new(),
                }
            })
            .collect::<Vec<_>>()
            .join(" "),
    }
}

/// Pull `key` from the frontmatter Value as a string, falling back gracefully
/// when the field is missing or wrong-typed. Mirrors `fm?.x ?? null`.
fn fm_str<'a>(fm: Option<&'a Value>, key: &str) -> Option<&'a str> {
    fm.and_then(|v| v.get(key).and_then(|v| v.as_str()))
}

/// Pull `key` from the frontmatter as a boolean. Treats missing/wrong-typed
/// as false to match `fm?.x ? 1 : 0`.
fn fm_bool(fm: Option<&Value>, key: &str) -> bool {
    fm.and_then(|v| v.get(key).and_then(|v| v.as_bool())).unwrap_or(false)
}

/// Pull a string from a ProfileValue, when present.
fn profile_string(p: &Datasheet, key: &str) -> Option<String> {
    p.profile.as_ref().and_then(|prof| {
        prof.get(key).map(|v| match v {
            ProfileValue::Int(n) => n.to_string(),
            ProfileValue::String(s) => s.clone(),
        })
    })
}

/// Pull an integer from a ProfileValue, when present and integer-typed.
fn profile_int(p: &Datasheet, key: &str) -> Option<i64> {
    p.profile.as_ref().and_then(|prof| match prof.get(key) {
        Some(ProfileValue::Int(n)) => Some(*n),
        _ => None,
    })
}

/// Insert a parsed datasheet (+ its frontmatter) and all its child rows.
/// Returns the unit_id and an "enriched" flag (1 if the frontmatter has a
/// loadouts: array — the same heuristic the JS uses).
pub fn insert_datasheet(
    conn: &Connection,
    faction_id: i64,
    ds: &Datasheet,
    fm: Option<&Value>,
    text: &str,
    slug: &str,
    source_path: &str,
) -> Result<(i64, bool), CatalogueError> {
    let enriched = fm
        .and_then(|v| v.get("loadouts"))
        .map(|v| v.is_sequence())
        .unwrap_or(false);

    // Per-model bases JSON
    let per_model_json = ds.base.as_ref().and_then(|b| {
        if b.per_model.is_empty() {
            None
        } else {
            serde_json::to_string(&b.per_model).ok()
        }
    });

    let grants_json = match fm.and_then(|v| v.get("grants_to_attached_unit")) {
        Some(grants) => Some(serde_json::to_string(&yaml_value_to_json(grants))?),
        None => None,
    };
    let can_join_json = match fm.and_then(|v| v.get("can_join")) {
        Some(Value::Sequence(seq)) if !seq.is_empty() => {
            let strs: Vec<String> = seq
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
            Some(serde_json::to_string(&strs)?)
        }
        _ => None,
    };
    let enables_co_leader = fm_str(fm, "enables_co_leader").map(|s| s.to_string());

    let inv_save = profile_string(ds, "InvSv")
        .or_else(|| fm_str(fm, "invulnerable_save").map(|s| s.to_string()));

    let ranges_json = if ds.ranges_in.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&ds.ranges_in)?)
    };

    let base = ds.base.as_ref();
    conn.execute(
        r#"
        INSERT INTO units
          (faction_id, slug, name, epic_hero, battleline, is_character,
           base_shape, base_diameter_mm, base_length_mm, base_width_mm, per_model_bases_json,
           movement, toughness, save, invulnerable_save, wounds, leadership, oc,
           max_range_in, ranges_in_json, grants_json, can_join_json, enables_co_leader,
           source_path, enriched)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)
        "#,
        params![
            faction_id,
            slug,
            ds.name.as_deref().unwrap_or(slug),
            fm_bool(fm, "epic_hero") as i64,
            fm_bool(fm, "battleline") as i64,
            fm_bool(fm, "is_character") as i64,
            base.and_then(|b| b.shape.as_deref()),
            base.and_then(|b| b.diameter_mm),
            base.and_then(|b| b.length_mm),
            base.and_then(|b| b.width_mm),
            per_model_json,
            profile_string(ds, "M"),
            profile_int(ds, "T"),
            profile_string(ds, "Sv"),
            inv_save,
            profile_int(ds, "W"),
            profile_string(ds, "Ld"),
            profile_int(ds, "OC"),
            ds.max_range_in,
            ranges_json,
            grants_json,
            can_join_json,
            enables_co_leader,
            source_path,
            enriched as i64,
        ],
    )?;
    let unit_id = conn.last_insert_rowid();

    // Loadouts (frontmatter only)
    if let Some(Value::Sequence(loadouts)) = fm.and_then(|v| v.get("loadouts")) {
        for lo in loadouts {
            let models = lo.get("models").and_then(|v| v.as_i64()).unwrap_or(0);
            let points = lo.get("points").and_then(|v| v.as_i64()).unwrap_or(0);
            let is_default = lo.get("default").and_then(|v| v.as_bool()).unwrap_or(false);
            conn.execute(
                "INSERT INTO unit_loadouts (unit_id, model_count, points, is_default) VALUES (?1, ?2, ?3, ?4)",
                params![unit_id, models, points, is_default as i64],
            )?;
        }
    }

    // Keywords — frontmatter preferred, body parse fallback
    let kw_pairs = collect_keywords(fm, text);
    for (kw, is_faction) in kw_pairs {
        conn.execute(
            "INSERT OR IGNORE INTO unit_keywords (unit_id, keyword, is_faction) VALUES (?1, ?2, ?3)",
            params![unit_id, kw, is_faction as i64],
        )?;
    }

    // Led-by
    if let Some(Value::Sequence(seq)) = fm.and_then(|v| v.get("led_by")) {
        for entry in seq {
            if let Some(s) = entry.as_str() {
                conn.execute(
                    "INSERT OR IGNORE INTO unit_led_by (unit_id, leader_slug) VALUES (?1, ?2)",
                    params![unit_id, s],
                )?;
            }
        }
    }

    // Weapons — both kinds parsed from the body
    for w in
        crate::catalogue::parsers::weapons::parse_weapons_table(text, WeaponKind::Ranged).iter()
    {
        insert_weapon(conn, unit_id, WeaponKind::Ranged, w)?;
    }
    for w in
        crate::catalogue::parsers::weapons::parse_weapons_table(text, WeaponKind::Melee).iter()
    {
        insert_weapon(conn, unit_id, WeaponKind::Melee, w)?;
    }

    Ok((unit_id, enriched))
}

fn insert_weapon(
    conn: &Connection,
    unit_id: i64,
    kind: WeaponKind,
    w: &Weapon,
) -> Result<(), CatalogueError> {
    conn.execute(
        r#"
        INSERT INTO weapons (unit_id, kind, name, range_in, attacks, skill, strength, ap, damage, keywords)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        "#,
        params![
            unit_id,
            kind.db_value(),
            w.name,
            w.range_in,
            w.attacks,
            w.skill,
            w.strength,
            w.ap,
            w.damage,
            w.keywords,
        ],
    )?;
    Ok(())
}

/// Collect (keyword, is_faction) pairs in the same order/precedence as the
/// JS builder: frontmatter wins, body fallback only when frontmatter is
/// absent.
fn collect_keywords(fm: Option<&Value>, text: &str) -> Vec<(String, bool)> {
    use std::collections::HashSet;
    let mut seen: HashSet<String> = HashSet::new();
    let mut out: Vec<(String, bool)> = Vec::new();

    let from_frontmatter = fm
        .and_then(|v| v.get("keywords"))
        .map(|v| v.is_mapping())
        .unwrap_or(false);

    if from_frontmatter {
        if let Some(faction_kws) = fm
            .and_then(|v| v.get("keywords"))
            .and_then(|k| k.get("faction"))
            .and_then(|s| s.as_sequence())
        {
            for k in faction_kws {
                if let Some(s) = k.as_str() {
                    let upper = s.to_uppercase();
                    if seen.insert(upper.clone()) {
                        out.push((upper, true));
                    }
                }
            }
        }
        if let Some(unit_kws) = fm
            .and_then(|v| v.get("keywords"))
            .and_then(|k| k.get("unit"))
            .and_then(|s| s.as_sequence())
        {
            for k in unit_kws {
                if let Some(s) = k.as_str() {
                    let upper = s.to_uppercase();
                    if seen.insert(upper.clone()) {
                        out.push((upper, false));
                    }
                }
            }
        }
    } else {
        // Body fallback
        use once_cell::sync::Lazy;
        use regex::Regex;
        static FACTION_KW_RE: Lazy<Regex> =
            Lazy::new(|| Regex::new(r"(?im)\*\*Faction Keywords:\*\*\s*(.+?)$").unwrap());
        static UNIT_KW_RE: Lazy<Regex> =
            Lazy::new(|| Regex::new(r"(?im)\*\*Unit Keywords:\*\*\s*(.+?)$").unwrap());
        if let Some(c) = FACTION_KW_RE.captures(text) {
            for k in c[1].split(',') {
                let upper = k.trim().to_uppercase();
                if !upper.is_empty() && seen.insert(upper.clone()) {
                    out.push((upper, true));
                }
            }
        }
        if let Some(c) = UNIT_KW_RE.captures(text) {
            for k in c[1].split(',') {
                let upper = k.trim().to_uppercase();
                if !upper.is_empty() && seen.insert(upper.clone()) {
                    out.push((upper, false));
                }
            }
        }
    }
    out
}

/// Insert a parsed mission row.
pub fn insert_mission(
    conn: &Connection,
    mission: &Mission,
    source_path: &str,
) -> Result<(), CatalogueError> {
    conn.execute(
        r#"
        INSERT INTO missions (slug, name, source_path, body_md, frontmatter_json)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
        params![
            mission.slug,
            mission.name,
            source_path,
            mission.body_md,
            mission.frontmatter_json,
        ],
    )?;
    Ok(())
}

pub fn insert_meta(conn: &Connection, key: &str, value: &str) -> Result<(), CatalogueError> {
    conn.execute(
        "INSERT INTO catalogue_meta (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}
