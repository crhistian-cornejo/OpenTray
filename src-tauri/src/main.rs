// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Silence warnings from objc crate used by tauri-nspanel
#![allow(unexpected_cfgs)]

mod command;
mod fns;
mod tray;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            command::init,
            command::show_panel,
            command::hide_panel,
            command::send_notification,
            command::update_tray_icon,
            command::read_file,
            command::write_file,
            command::file_exists
        ])
        .plugin(tauri_nspanel::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Set as accessory app (no dock icon, menubar only)
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let app_handle = app.app_handle();

            // Create tray icon
            tray::create(app_handle)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
