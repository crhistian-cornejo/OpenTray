// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Silence warnings from objc crate used by tauri-nspanel
#![allow(unexpected_cfgs)]

mod command;
mod fns;
mod tray;

use tauri::Manager;

fn main() {
    // Check if updater is enabled (only in production builds with signing key)
    let updater_enabled = option_env!("TAURI_SIGNING_PRIVATE_KEY").is_some();

    let mut builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            command::init,
            command::show_panel,
            command::hide_panel,
            command::send_notification,
            command::update_tray_icon,
            command::read_file,
            command::write_file,
            command::file_exists,
            command::show_permission_popup,
            command::hide_permission_popup,
            command::get_pending_permission
        ])
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init());

    // Add macOS-specific nspanel plugin
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder = builder.setup(move |app| {
        // Set as accessory app (no dock icon, menubar only) - macOS only
        #[cfg(target_os = "macos")]
        app.set_activation_policy(tauri::ActivationPolicy::Accessory);

        let app_handle = app.app_handle();

        // Create tray icon
        tray::create(app_handle)?;

        // Inject updater status into frontend
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.eval(
                format!(
                    r#"
                window.__OPENTRAY__ = window.__OPENTRAY__ || {{}};
                window.__OPENTRAY__.updaterEnabled = {};
                "#,
                    updater_enabled
                )
                .as_str(),
            );
        }

        Ok(())
    });

    // Conditionally add updater plugin only when signing key is available
    if updater_enabled {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
