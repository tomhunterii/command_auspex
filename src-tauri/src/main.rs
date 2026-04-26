#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
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
