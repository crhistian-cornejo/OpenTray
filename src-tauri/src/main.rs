// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Silence warnings from objc crate used by tauri-nspanel
#![allow(unexpected_cfgs)]

mod command;
mod fns;
mod tray;

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

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
            command::get_pending_permission,
            command::get_settings,
            command::save_settings,
            command::toggle_panel
        ])
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());

    // Add macOS-specific nspanel plugin
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder = builder.setup(move |app| {
        // Set as accessory app (no dock icon, menubar only) - macOS only
        #[cfg(target_os = "macos")]
        app.set_activation_policy(tauri::ActivationPolicy::Accessory);

        let app_handle = app.app_handle().clone();

        // Create tray icon with context menu
        tray::create(&app_handle)?;

        // Register global shortcut (Cmd+Shift+O on macOS, Ctrl+Shift+O on Windows/Linux)
        #[cfg(target_os = "macos")]
        let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyO);
        #[cfg(not(target_os = "macos"))]
        let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyO);

        let handle = app_handle.clone();
        app.global_shortcut()
            .on_shortcut(shortcut, move |_app, _shortcut, _event| {
                command::toggle_panel_internal(&handle);
            })?;

        // Inject updater status and platform info into frontend
        if let Some(window) = app.get_webview_window("main") {
            let platform = if cfg!(target_os = "macos") {
                "macos"
            } else if cfg!(target_os = "windows") {
                "windows"
            } else {
                "linux"
            };

            let _ = window.eval(
                format!(
                    r#"
                window.__OPENTRAY__ = window.__OPENTRAY__ || {{}};
                window.__OPENTRAY__.updaterEnabled = {};
                window.__OPENTRAY__.platform = "{}";
                "#,
                    updater_enabled, platform
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
