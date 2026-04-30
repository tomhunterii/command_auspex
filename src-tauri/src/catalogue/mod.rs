// Catalogue builder — port of scripts/build-catalogue.js. Reads markdown
// source files (datasheets + missions, NOT rosters — those live in
// user-save.md per the Captain's data-model directive) and writes a
// SQLite catalogue.db.
//
// Public entrypoint: `build_catalogue(source_root, db_path)` — fully
// rebuilds the DB from scratch. Returns a CatalogueBuildResult with row
// counts and any per-file warnings encountered.
//
// Single-entity reparse helpers (reparse_unit / reparse_mission) ride on
// top of the same parsers but do an UPDATE-or-INSERT instead of a full
// rebuild — used by the in-app editor after a save. (Not yet implemented;
// will land in a follow-up PR.)

pub mod errors;
pub mod frontmatter;
pub mod insert;
pub mod parsers;
pub mod schema;
pub mod walk;

use crate::catalogue::errors::{CatalogueError, ParseWarning};
use crate::catalogue::frontmatter::parse_frontmatter;
use crate::catalogue::insert::{
    ensure_faction, insert_datasheet, insert_meta, insert_mission,
};
use crate::catalogue::parsers::datasheet::parse_datasheet;
use crate::catalogue::parsers::mission::parse_mission;
use crate::catalogue::schema::SCHEMA;
use crate::catalogue::walk::{
    list_markdown_files, list_subdirs, relative_source_path, slug_from_path,
};
use rusqlite::Connection;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct CatalogueBuildResult {
    pub unit_count: usize,
    pub enriched_count: usize,
    pub mission_count: usize,
    pub warnings: Vec<ParseWarning>,
}

/// Apply the schema to a fresh DB. Does NOT delete an existing file —
/// callers should remove the path before calling if they want a clean
/// build.
pub fn apply_schema(conn: &Connection) -> Result<(), CatalogueError> {
    conn.execute_batch(SCHEMA)?;
    Ok(())
}

/// Full rebuild from `source_root` (which must contain `datasheets/` and
/// `missions/` subdirectories). Writes the DB at `db_path`, removing any
/// pre-existing file there. Returns build stats + warnings.
pub fn build_catalogue(
    source_root: &Path,
    db_path: &Path,
) -> Result<CatalogueBuildResult, CatalogueError> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if db_path.exists() {
        std::fs::remove_file(db_path)?;
    }

    let conn = Connection::open(db_path)?;
    apply_schema(&conn)?;
    // WAL mode — needed so the in-app editor's `reparse_unit` writes can
    // coexist with plugin-sql's reads. Set ONCE at create time; it sticks.
    let _: String = conn
        .pragma_update_and_check(None, "journal_mode", "WAL", |row| row.get(0))
        .unwrap_or_default();

    let mut warnings: Vec<ParseWarning> = Vec::new();
    let mut unit_count = 0usize;
    let mut enriched_count = 0usize;

    // Datasheets — walk <source_root>/datasheets/<faction>/units/*.md
    let datasheets_root = source_root.join("datasheets");
    for faction_dir in list_subdirs(&datasheets_root) {
        let faction_slug = slug_from_path(&faction_dir);
        let units_dir = faction_dir.join("units");
        let files = list_markdown_files(&units_dir);
        if files.is_empty() {
            continue;
        }
        let faction_id = ensure_faction(&conn, &faction_slug)?;
        for file in files {
            let source_path = relative_source_path(source_root, &file);
            match build_one_datasheet(&conn, faction_id, &file, &source_path) {
                Ok(enriched) => {
                    unit_count += 1;
                    if enriched {
                        enriched_count += 1;
                    }
                }
                Err(e) => warnings.push(ParseWarning::new(
                    source_path,
                    "datasheet",
                    e.to_string(),
                )),
            }
        }
    }

    // Missions — flat <source_root>/missions/*.md
    let missions_root = source_root.join("missions");
    let mut mission_count = 0usize;
    for file in list_markdown_files(&missions_root) {
        let source_path = relative_source_path(source_root, &file);
        match build_one_mission(&conn, &file, &source_path) {
            Ok(()) => mission_count += 1,
            Err(e) => warnings.push(ParseWarning::new(
                source_path,
                "mission",
                e.to_string(),
            )),
        }
    }

    // Catalogue metadata
    insert_meta(&conn, "built_at", &chrono_now())?;
    insert_meta(&conn, "built_from_sha", "rust-catalogue-builder")?;
    insert_meta(&conn, "catalogue_version", "1")?;
    insert_meta(&conn, "unit_count", &unit_count.to_string())?;
    insert_meta(&conn, "enriched_count", &enriched_count.to_string())?;
    insert_meta(&conn, "mission_count", &mission_count.to_string())?;
    insert_meta(&conn, "roster_count", "0")?;

    Ok(CatalogueBuildResult {
        unit_count,
        enriched_count,
        mission_count,
        warnings,
    })
}

fn build_one_datasheet(
    conn: &Connection,
    faction_id: i64,
    path: &Path,
    source_path: &str,
) -> Result<bool, CatalogueError> {
    let text = std::fs::read_to_string(path)?;
    let fm = parse_frontmatter(&text).map_err(|e| CatalogueError::Yaml {
        path: path.to_path_buf(),
        source: e,
    })?;
    let ds = parse_datasheet(&text);
    let slug = fm
        .as_ref()
        .and_then(|v| v.get("slug").and_then(|s| s.as_str()).map(|s| s.to_string()))
        .unwrap_or_else(|| slug_from_path(path));
    let (_id, enriched) = insert_datasheet(
        conn,
        faction_id,
        &ds,
        fm.as_ref(),
        &text,
        &slug,
        source_path,
    )?;
    Ok(enriched)
}

fn build_one_mission(
    conn: &Connection,
    path: &Path,
    source_path: &str,
) -> Result<(), CatalogueError> {
    let text = std::fs::read_to_string(path)?;
    let fm = parse_frontmatter(&text).map_err(|e| CatalogueError::Yaml {
        path: path.to_path_buf(),
        source: e,
    })?;
    let fallback_slug = slug_from_path(path);
    let mission = parse_mission(&text, &fallback_slug, fm.as_ref())?;
    insert_mission(conn, &mission, source_path)?;
    Ok(())
}

/// RFC-3339 timestamp without pulling in chrono (one tiny stdlib snippet
/// keeps the dep tree small). Format: 2026-04-29T22:14:00Z.
fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Crude epoch → date conversion (UTC). Adequate for "built_at" provenance.
    // Days since 1970-01-01.
    let days = secs / 86_400;
    let secs_today = secs % 86_400;
    let h = secs_today / 3600;
    let m = (secs_today % 3600) / 60;
    let s = secs_today % 60;
    let (y, mo, d) = days_to_ymd(days as i64);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}

fn days_to_ymd(mut days: i64) -> (i64, u32, u32) {
    // Algorithm from Howard Hinnant's "date" library, public domain.
    days += 719468;
    let era = if days >= 0 { days / 146_097 } else { (days - 146_096) / 146_097 };
    let doe = (days - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn empty_source_root_builds_empty_catalogue() {
        let tmp = TempDir::new().unwrap();
        let db = tmp.path().join("catalogue.db");
        let result = build_catalogue(tmp.path(), &db).unwrap();
        assert_eq!(result.unit_count, 0);
        assert_eq!(result.mission_count, 0);
        assert_eq!(result.warnings.len(), 0);
        assert!(db.exists());
    }

    #[test]
    fn schema_creates_all_tables() {
        let tmp = TempDir::new().unwrap();
        let db = tmp.path().join("catalogue.db");
        build_catalogue(tmp.path(), &db).unwrap();
        let conn = Connection::open(&db).unwrap();
        let table_names: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .filter_map(Result::ok)
            .collect();
        for expected in [
            "catalogue_meta",
            "factions",
            "missions",
            "rosters",
            "unit_keywords",
            "unit_led_by",
            "unit_loadouts",
            "units",
            "weapons",
        ] {
            assert!(
                table_names.iter().any(|n| n == expected),
                "missing table: {expected} (have: {table_names:?})"
            );
        }
    }
}
