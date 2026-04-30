#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod catalogue;

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

// Copy the bundled catalogue.db from the resource directory into the app data
// directory on every launch so plugin-sql (which always resolves paths relative
// to BaseDirectory::App) can find it. The bundled DB is read-only canonical
// data; overwriting on every launch ensures app upgrades pick up the latest
// schema and content. User-mutable state lives in a separate user.db (future).
fn install_catalogue(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Bundle.resources entry is "resources/catalogue.db" (relative to src-tauri/)
    // so the bundled file lives at <resource_dir>/resources/catalogue.db.
    let resource_db = app
        .path()
        .resource_dir()?
        .join("resources")
        .join(CATALOGUE_FILENAME);
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;
    let dest_db = app_data_dir.join(CATALOGUE_FILENAME);
    if !resource_db.exists() {
        return Err(format!("bundled catalogue.db not found at {}", resource_db.display()).into());
    }
    fs::copy(&resource_db, &dest_db)?;
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
        ])
        .setup(|app| {
            install_catalogue(&app.handle())?;

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
