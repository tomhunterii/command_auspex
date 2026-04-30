#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod catalogue;
mod seed;

use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager,
};

const CATALOGUE_FILENAME: &str = "catalogue.db";

// Resolve a user-supplied relative path under the app-data directory while
// rejecting path traversal (.. components, absolute paths). Returns the
// absolute path on success.
fn resolve_user_path(app: &tauri::AppHandle, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return Err(format!("absolute paths not allowed: {rel}"));
    }
    for c in rel_path.components() {
        match c {
            Component::ParentDir => return Err(format!("path traversal not allowed: {rel}")),
            Component::Prefix(_) | Component::RootDir => return Err(format!("absolute paths not allowed: {rel}")),
            _ => {}
        }
    }
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(base.join(rel_path))
}

#[tauri::command]
fn user_write_text(app: tauri::AppHandle, path: String, contents: String) -> Result<(), String> {
    let abs = resolve_user_path(&app, &path)?;
    if let Some(parent) = abs.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&abs, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn user_read_text(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let abs = resolve_user_path(&app, &path)?;
    fs::read_to_string(&abs).map_err(|e| e.to_string())
}

#[tauri::command]
fn user_list_dir(app: tauri::AppHandle, path: String) -> Result<Vec<String>, String> {
    let abs = resolve_user_path(&app, &path)?;
    if !abs.exists() { return Ok(Vec::new()); }
    let entries = fs::read_dir(&abs).map_err(|e| e.to_string())?;
    let mut names = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        if let Some(name) = entry.file_name().to_str() {
            names.push(name.to_string());
        }
    }
    Ok(names)
}

#[tauri::command]
fn user_file_exists(app: tauri::AppHandle, path: String) -> bool {
    match resolve_user_path(&app, &path) {
        Ok(abs) => abs.is_file(),
        Err(_) => false,
    }
}

#[tauri::command]
fn user_mkdir(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let abs = resolve_user_path(&app, &path)?;
    fs::create_dir_all(&abs).map_err(|e| e.to_string())
}

// Delete a single user-pasted file (e.g. rosters/foo.md). Refuses to remove
// directories — mass deletion has no UI surface today and a stray slash
// shouldn't be able to wipe a tree. Idempotent: missing file returns Ok.
#[tauri::command]
fn user_delete(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let abs = resolve_user_path(&app, &path)?;
    if !abs.exists() { return Ok(()); }
    if abs.is_dir() {
        return Err(format!("refusing to delete directory: {path}"));
    }
    fs::remove_file(&abs).map_err(|e| e.to_string())
}

// Reparse one mission MD file into catalogue.db without rebuilding the
// whole catalogue. Phase 2B's mission editor calls this after writing
// edits to <app_data>/missions/<slug>.md so the panel can re-render
// against fresh DB data.
#[tauri::command]
fn reparse_mission(app: tauri::AppHandle, slug: String) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join(CATALOGUE_FILENAME);
    catalogue::reparse_mission(&db_path, &app_data_dir, &slug).map_err(|e| e.to_string())
}

// Phase 2C twin of reparse_mission for datasheets. Reads
// <app_data>/datasheets/<faction_slug>/units/<slug>.md, drops the unit
// + its child rows (loadouts, keywords, led_by, weapons), re-inserts.
#[tauri::command]
fn reparse_unit(app: tauri::AppHandle, faction_slug: String, slug: String) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join(CATALOGUE_FILENAME);
    catalogue::reparse_unit(&db_path, &app_data_dir, &faction_slug, &slug)
        .map_err(|e| e.to_string())
}

// Rebuild catalogue.db from the user-editable markdown trees in
// <app_data>/{datasheets,missions} on every launch (Phase 1C). Three
// reasons this lives at startup, not bundle time:
//   * Editors (Phase 2) write to those trees — the DB must reflect
//     latest edits without a manual rebuild.
//   * Bundle.resources no longer ships catalogue.db, so there's no
//     stale copy to install.
//   * The rebuild is fast (<1s for the current corpus) and the
//     plugin-sql connection opens after this returns.
//
// Hard fails on error: without a working DB the frontend has nothing
// to query, so abort startup loudly rather than silently shipping a
// broken app.
fn rebuild_catalogue(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;
    let db_path = app_data_dir.join(CATALOGUE_FILENAME);
    let result = catalogue::build_catalogue(&app_data_dir, &db_path)?;
    eprintln!(
        "catalogue: rebuilt from {} → {} units ({} enriched), {} missions",
        app_data_dir.display(),
        result.unit_count,
        result.enriched_count,
        result.mission_count,
    );
    if !result.warnings.is_empty() {
        eprintln!("catalogue: {} parse warnings:", result.warnings.len());
        for w in &result.warnings {
            eprintln!("  [{}] {} — {}", w.kind, w.source_path, w.message);
        }
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            user_write_text,
            user_read_text,
            user_list_dir,
            user_file_exists,
            user_mkdir,
            user_delete,
            reparse_mission,
            reparse_unit,
        ])
        .setup(|app| {
            // Seed bundled markdown trees into app-data on first launch
            // so the in-app editors (Phase 2) can mutate them. Must run
            // BEFORE rebuild — the rebuild reads from these trees.
            let res_dir = app.handle().path().resource_dir()?;
            let data_dir = app.handle().path().app_data_dir()?;
            match seed::seed_user_data(&res_dir, &data_dir) {
                Ok(report) => {
                    if !report.seeded_trees.is_empty() {
                        eprintln!(
                            "seed: copied bundled trees → app-data: {}",
                            report.seeded_trees.join(", ")
                        );
                    }
                    if !report.skipped_trees.is_empty() {
                        eprintln!(
                            "seed: trees already present, skipped: {}",
                            report.skipped_trees.join(", ")
                        );
                    }
                }
                Err(e) => return Err(format!("seed: failed: {e}").into()),
            }

            rebuild_catalogue(&app.handle())?;

            let handle = app.handle();

            let save = MenuItem::with_id(handle, "save_scenario", "Save Scenario", true, Some("CmdOrCtrl+S"))?;
            let recall = MenuItem::with_id(handle, "recall_scenario", "Recall Scenario", true, Some("CmdOrCtrl+O"))?;
            let separator = PredefinedMenuItem::separator(handle)?;
            let quit = PredefinedMenuItem::quit(handle, None)?;

            let file_menu = Submenu::with_items(
                handle,
                "File",
                true,
                &[&save, &recall, &separator, &quit],
            )?;

            let menu = Menu::with_items(handle, &[&file_menu])?;
            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.as_str();
                let _ = app_handle.emit("menu-action", id);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Command Auspex");
}
