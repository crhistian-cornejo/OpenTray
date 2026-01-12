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
use std::path::PathBuf;
use std::sync::Mutex;

// Store the current shortcut so we can unregister it when updating
static CURRENT_SHORTCUT: Mutex<Option<Shortcut>> = Mutex::new(None);

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
            command::update_tray_icon_theme,
            command::read_file,
            command::write_file,
            command::file_exists,
            command::show_permission_popup,
            command::hide_permission_popup,
            command::get_pending_permission,
            command::get_settings,
            command::save_settings,
            command::toggle_panel,
            command::list_project_files,
            update_global_shortcut
        ])
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
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

        // Load saved shortcut or use default
        let shortcut = load_shortcut_from_settings(&app_handle);

        // Store the initial shortcut
        if let Ok(mut current) = CURRENT_SHORTCUT.lock() {
            *current = Some(shortcut);
        }

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

#[tauri::command]
fn update_global_shortcut(app_handle: tauri::AppHandle, shortcut_str: String) -> Result<(), String> {
    let new_shortcut = parse_shortcut_string(&shortcut_str)
        .ok_or_else(|| format!("Invalid shortcut: {}", shortcut_str))?;

    // Unregister the old shortcut
    if let Ok(mut current) = CURRENT_SHORTCUT.lock() {
        if let Some(old_shortcut) = current.take() {
            let _ = app_handle.global_shortcut().unregister(old_shortcut);
        }
        *current = Some(new_shortcut);
    }

    // Register the new shortcut
    let handle = app_handle.clone();
    app_handle
        .global_shortcut()
        .on_shortcut(new_shortcut, move |_app, _shortcut, _event| {
            command::toggle_panel_internal(&handle);
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Load the global shortcut from saved settings, or return the default
fn load_shortcut_from_settings(app_handle: &tauri::AppHandle) -> Shortcut {
    // Default shortcut
    #[cfg(target_os = "macos")]
    let default_shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyO);
    #[cfg(not(target_os = "macos"))]
    let default_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyO);

    // Try to load settings
    let settings_path: PathBuf = app_handle
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json");

    if !settings_path.exists() {
        return default_shortcut;
    }

    let content = match std::fs::read_to_string(&settings_path) {
        Ok(c) => c,
        Err(_) => return default_shortcut,
    };

    let settings: serde_json::Value = match serde_json::from_str(&content) {
        Ok(s) => s,
        Err(_) => return default_shortcut,
    };

    let shortcut_str = match settings.get("global_shortcut").and_then(|v| v.as_str()) {
        Some(s) => s,
        None => return default_shortcut,
    };

    parse_shortcut_string(shortcut_str).unwrap_or(default_shortcut)
}

/// Parse a shortcut string like "Ctrl+Shift+O" into a Shortcut
fn parse_shortcut_string(s: &str) -> Option<Shortcut> {
    let parts: Vec<&str> = s.split('+').collect();
    if parts.is_empty() {
        return None;
    }

    let mut modifiers = Modifiers::empty();
    let mut key_code: Option<Code> = None;

    for part in parts {
        match part.to_lowercase().as_str() {
            "cmd" | "command" | "meta" | "super" => modifiers |= Modifiers::SUPER,
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "alt" | "option" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,
            // Single letter keys
            k if k.len() == 1 && k.chars().next().unwrap().is_ascii_alphabetic() => {
                key_code = match k.to_uppercase().as_str() {
                    "A" => Some(Code::KeyA),
                    "B" => Some(Code::KeyB),
                    "C" => Some(Code::KeyC),
                    "D" => Some(Code::KeyD),
                    "E" => Some(Code::KeyE),
                    "F" => Some(Code::KeyF),
                    "G" => Some(Code::KeyG),
                    "H" => Some(Code::KeyH),
                    "I" => Some(Code::KeyI),
                    "J" => Some(Code::KeyJ),
                    "K" => Some(Code::KeyK),
                    "L" => Some(Code::KeyL),
                    "M" => Some(Code::KeyM),
                    "N" => Some(Code::KeyN),
                    "O" => Some(Code::KeyO),
                    "P" => Some(Code::KeyP),
                    "Q" => Some(Code::KeyQ),
                    "R" => Some(Code::KeyR),
                    "S" => Some(Code::KeyS),
                    "T" => Some(Code::KeyT),
                    "U" => Some(Code::KeyU),
                    "V" => Some(Code::KeyV),
                    "W" => Some(Code::KeyW),
                    "X" => Some(Code::KeyX),
                    "Y" => Some(Code::KeyY),
                    "Z" => Some(Code::KeyZ),
                    _ => None,
                };
            }
            // Number keys
            k if k.len() == 1 && k.chars().next().unwrap().is_ascii_digit() => {
                key_code = match k {
                    "0" => Some(Code::Digit0),
                    "1" => Some(Code::Digit1),
                    "2" => Some(Code::Digit2),
                    "3" => Some(Code::Digit3),
                    "4" => Some(Code::Digit4),
                    "5" => Some(Code::Digit5),
                    "6" => Some(Code::Digit6),
                    "7" => Some(Code::Digit7),
                    "8" => Some(Code::Digit8),
                    "9" => Some(Code::Digit9),
                    _ => None,
                };
            }
            // Special keys
            "space" => key_code = Some(Code::Space),
            "enter" | "return" => key_code = Some(Code::Enter),
            "tab" => key_code = Some(Code::Tab),
            "escape" | "esc" => key_code = Some(Code::Escape),
            "backspace" => key_code = Some(Code::Backspace),
            "delete" => key_code = Some(Code::Delete),
            "up" => key_code = Some(Code::ArrowUp),
            "down" => key_code = Some(Code::ArrowDown),
            "left" => key_code = Some(Code::ArrowLeft),
            "right" => key_code = Some(Code::ArrowRight),
            // Function keys
            "f1" => key_code = Some(Code::F1),
            "f2" => key_code = Some(Code::F2),
            "f3" => key_code = Some(Code::F3),
            "f4" => key_code = Some(Code::F4),
            "f5" => key_code = Some(Code::F5),
            "f6" => key_code = Some(Code::F6),
            "f7" => key_code = Some(Code::F7),
            "f8" => key_code = Some(Code::F8),
            "f9" => key_code = Some(Code::F9),
            "f10" => key_code = Some(Code::F10),
            "f11" => key_code = Some(Code::F11),
            "f12" => key_code = Some(Code::F12),
            _ => {}
        }
    }

    // Need at least one modifier and a key
    if modifiers.is_empty() || key_code.is_none() {
        return None;
    }

    Some(Shortcut::new(Some(modifiers), key_code.unwrap()))
}
