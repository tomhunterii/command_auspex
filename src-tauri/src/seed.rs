// First-launch seeding (Phase 1B).
//
// Copies bundled markdown trees from the resource dir into the
// per-user app-data dir so they become the user-editable source of
// truth. Phase 1C will rebuild catalogue.db from these files at launch.
//
// Design notes:
//
// * Source layout: <resource_dir>/resources/{datasheets,missions} —
//   produced by `scripts/stage-bundled-md.js` at build time.
// * Destination: <app_data>/{datasheets,missions} — what the runtime
//   will read.
// * Per-tree sentinel: <app_data>/<tree>/.seeded contains the seed
//   version string. Skip the seed if the file exists and matches; on
//   bump, leave user files in place (Phase 1C handles diff/upgrade).
// * Failure mode: a single tree failing should not abort launch —
//   callers log the error and proceed. The bundled catalogue.db
//   continues to work as a fallback until 1C lands.
//
// Idempotency: running seed twice is a no-op.

use std::fs;
use std::io;
use std::path::Path;

const SEED_VERSION: &str = "1";
const SEEDED_SENTINEL: &str = ".seeded";
const TREES: &[&str] = &["datasheets", "missions"];

#[derive(Debug)]
pub struct SeedReport {
    pub seeded_trees: Vec<String>,
    pub skipped_trees: Vec<String>,
}

/// Seed all bundled trees into app-data. Returns which trees were
/// freshly seeded vs. skipped (already present at the current version).
/// Errors only on hard I/O failures the caller can't recover from;
/// missing-source warnings are logged via stderr and counted as skipped.
pub fn seed_user_data(resource_dir: &Path, app_data_dir: &Path) -> io::Result<SeedReport> {
    fs::create_dir_all(app_data_dir)?;
    let mut seeded = Vec::new();
    let mut skipped = Vec::new();
    for tree in TREES {
        let src = resource_dir.join("resources").join(tree);
        let dst = app_data_dir.join(tree);
        match seed_tree(&src, &dst)? {
            SeedAction::Seeded => seeded.push((*tree).to_string()),
            SeedAction::AlreadySeeded => skipped.push((*tree).to_string()),
            SeedAction::SourceMissing => {
                eprintln!("seed: bundled source missing, skipping: {}", src.display());
                skipped.push((*tree).to_string());
            }
        }
    }
    Ok(SeedReport { seeded_trees: seeded, skipped_trees: skipped })
}

enum SeedAction {
    Seeded,
    AlreadySeeded,
    SourceMissing,
}

fn seed_tree(src: &Path, dst: &Path) -> io::Result<SeedAction> {
    if !src.exists() {
        return Ok(SeedAction::SourceMissing);
    }
    let sentinel = dst.join(SEEDED_SENTINEL);
    if sentinel.exists() {
        let recorded = fs::read_to_string(&sentinel).unwrap_or_default();
        if recorded.trim() == SEED_VERSION {
            return Ok(SeedAction::AlreadySeeded);
        }
        // Future seed-version bumps land here. For 1B we treat any
        // existing sentinel as authoritative — even at a different
        // version — so user edits never get clobbered. Phase 1C/migration
        // is the right place to do an opt-in diff/upgrade.
        return Ok(SeedAction::AlreadySeeded);
    }
    fs::create_dir_all(dst)?;
    copy_tree(src, dst)?;
    fs::write(&sentinel, SEED_VERSION)?;
    Ok(SeedAction::Seeded)
}

fn copy_tree(src: &Path, dst: &Path) -> io::Result<()> {
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if file_type.is_dir() {
            fs::create_dir_all(&to)?;
            copy_tree(&from, &to)?;
        } else if file_type.is_file() {
            fs::copy(&from, &to)?;
        }
        // Symlinks ignored — bundled trees don't contain any.
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    fn write(p: &Path, body: &str) {
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(p, body).unwrap();
    }

    fn make_bundled(resource_dir: &Path) -> PathBuf {
        let bundle = resource_dir.join("resources");
        write(&bundle.join("datasheets/space-marines/units/captain.md"), "captain");
        write(&bundle.join("datasheets/tyranids/units/zoanthrope.md"), "zoanthrope");
        write(&bundle.join("missions/purge-and-burn.md"), "mission");
        bundle
    }

    #[test]
    fn first_launch_copies_all_files() {
        let res = TempDir::new().unwrap();
        let app = TempDir::new().unwrap();
        make_bundled(res.path());

        let report = seed_user_data(res.path(), app.path()).unwrap();
        assert_eq!(report.seeded_trees.len(), 2);
        assert!(report.skipped_trees.is_empty());

        assert!(app.path().join("datasheets/space-marines/units/captain.md").exists());
        assert!(app.path().join("datasheets/tyranids/units/zoanthrope.md").exists());
        assert!(app.path().join("missions/purge-and-burn.md").exists());
        assert_eq!(
            fs::read_to_string(app.path().join("datasheets/.seeded")).unwrap().trim(),
            "1"
        );
        assert_eq!(
            fs::read_to_string(app.path().join("missions/.seeded")).unwrap().trim(),
            "1"
        );
    }

    #[test]
    fn second_launch_is_noop() {
        let res = TempDir::new().unwrap();
        let app = TempDir::new().unwrap();
        make_bundled(res.path());

        seed_user_data(res.path(), app.path()).unwrap();
        // User edits a file post-seed.
        let edited = app.path().join("datasheets/space-marines/units/captain.md");
        fs::write(&edited, "edited by user").unwrap();

        let report = seed_user_data(res.path(), app.path()).unwrap();
        assert!(report.seeded_trees.is_empty());
        assert_eq!(report.skipped_trees.len(), 2);
        // User's edit must survive — seeding never overwrites.
        assert_eq!(fs::read_to_string(&edited).unwrap(), "edited by user");
    }

    /// End-to-end Phase 1C check: stage repo's real bundled MDs into a
    /// fake resource_dir, seed → app_data, then rebuild catalogue.db
    /// from the seeded copy and verify queryable rows.
    #[test]
    fn seed_then_rebuild_produces_queryable_db() {
        let res = TempDir::new().unwrap();
        let app = TempDir::new().unwrap();

        // Mirror repo `datasheets/` and `missions/` into res/resources/
        // — same shape `stage-bundled-md.js` produces at build time.
        let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repo root");
        let stage = res.path().join("resources");
        copy_tree_test(&repo.join("datasheets"), &stage.join("datasheets")).unwrap();
        copy_tree_test(&repo.join("missions"), &stage.join("missions")).unwrap();

        let report = seed_user_data(res.path(), app.path()).unwrap();
        assert!(report.seeded_trees.contains(&"datasheets".to_string()));
        assert!(report.seeded_trees.contains(&"missions".to_string()));

        // The .seeded sentinel must NOT trip up build_catalogue's walk.
        let db_path = app.path().join("catalogue.db");
        let result = crate::catalogue::build_catalogue(app.path(), &db_path).unwrap();
        assert!(result.unit_count > 0, "expected units, got {}", result.unit_count);
        assert!(result.mission_count > 0, "expected missions, got {}", result.mission_count);

        let conn = rusqlite::Connection::open(&db_path).unwrap();
        let captain_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM units WHERE slug = 'captain'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(captain_count, 1, "captain.md should produce one unit row");
    }

    fn copy_tree_test(src: &Path, dst: &Path) -> io::Result<()> {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let from = entry.path();
            let to = dst.join(entry.file_name());
            if entry.file_type()?.is_dir() {
                copy_tree_test(&from, &to)?;
            } else {
                fs::copy(&from, &to)?;
            }
        }
        Ok(())
    }

    #[test]
    fn missing_source_tree_is_skipped_not_fatal() {
        let res = TempDir::new().unwrap();
        let app = TempDir::new().unwrap();
        // Only seed datasheets, leave missions absent.
        write(
            &res.path().join("resources/datasheets/space-marines/units/captain.md"),
            "captain",
        );

        let report = seed_user_data(res.path(), app.path()).unwrap();
        assert_eq!(report.seeded_trees, vec!["datasheets".to_string()]);
        assert_eq!(report.skipped_trees, vec!["missions".to_string()]);
        assert!(app.path().join("datasheets/space-marines/units/captain.md").exists());
        assert!(!app.path().join("missions").exists());
    }
}
