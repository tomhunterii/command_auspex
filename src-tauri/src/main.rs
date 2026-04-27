#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager,
};

const CATALOGUE_FILENAME: &str = "catalogue.db";

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
        .setup(|app| {
            install_catalogue(&app.handle())?;

            let handle = app.handle();

            let connect = MenuItem::with_id(handle, "connect_repo", "Connect Repo", true, None::<&str>)?;
            let save = MenuItem::with_id(handle, "save_scenario", "Save Scenario", true, Some("CmdOrCtrl+S"))?;
            let recall = MenuItem::with_id(handle, "recall_scenario", "Recall Scenario", true, Some("CmdOrCtrl+O"))?;
            let separator = PredefinedMenuItem::separator(handle)?;
            let quit = PredefinedMenuItem::quit(handle, None)?;

            let file_menu = Submenu::with_items(
                handle,
                "File",
                true,
                &[&connect, &save, &recall, &separator, &quit],
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
