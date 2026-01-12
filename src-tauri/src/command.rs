use std::path::PathBuf;
use std::sync::{Mutex, Once};

use tauri::{Emitter, Manager};
#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;
use tauri_plugin_notification::NotificationExt;

use crate::fns::update_tray_icon_with_badge;
#[cfg(target_os = "macos")]
use crate::fns::{
    position_panel, position_permission_popup, setup_panel_listeners, swizzle_to_panel,
    update_panel_appearance,
};

// Store pending permission data
static PENDING_PERMISSION: Mutex<Option<serde_json::Value>> = Mutex::new(None);

static INIT: Once = Once::new();

// App settings stored in memory and synced to disk
#[derive(serde::Deserialize, serde::Serialize, Clone, Default)]
pub struct AppSettings {
    #[serde(default)]
    pub autostart: bool,
    #[serde(default)]
    pub sound_enabled: bool,
    #[serde(default)]
    pub compact_mode: bool,
    #[serde(default = "default_shortcut")]
    pub global_shortcut: String,
}

fn default_shortcut() -> String {
    if cfg!(target_os = "macos") {
        "Cmd+Shift+O".to_string()
    } else {
        "Ctrl+Shift+O".to_string()
    }
}

#[tauri::command]
pub fn init(app_handle: tauri::AppHandle) {
    INIT.call_once(|| {
        #[cfg(target_os = "macos")]
        {
            swizzle_to_panel(&app_handle);
            update_panel_appearance(&app_handle);
            setup_panel_listeners(&app_handle);
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = &app_handle; // Suppress unused warning on non-macOS
        }
    });
}

#[tauri::command]
pub fn show_panel(app_handle: tauri::AppHandle) {
    show_panel_internal(&app_handle);
}

pub fn show_panel_internal(app_handle: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let panel = app_handle.get_webview_panel("main").unwrap();
        position_panel(app_handle, 0.0);
        panel.show();
    }
    #[cfg(not(target_os = "macos"))]
    {
        // On Windows, show the main window instead
        if let Some(window) = app_handle.get_webview_window("main") {
            // Position near tray before showing
            crate::tray::position_window_near_tray(&window);
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
pub fn hide_panel(app_handle: tauri::AppHandle) {
    hide_panel_internal(&app_handle);
}

fn hide_panel_internal(app_handle: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let panel = app_handle.get_webview_panel("main").unwrap();
        panel.order_out(None);
    }
    #[cfg(not(target_os = "macos"))]
    {
        // On Windows, hide the main window
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.hide();
        }
    }
}

#[tauri::command]
pub fn toggle_panel(app_handle: tauri::AppHandle) {
    toggle_panel_internal(&app_handle);
}

pub fn toggle_panel_internal(app_handle: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let panel = app_handle.get_webview_panel("main").unwrap();
        if panel.is_visible() {
            panel.order_out(None);
        } else {
            position_panel(app_handle, 0.0);
            panel.show();
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        if let Some(window) = app_handle.get_webview_window("main") {
            if window.is_visible().unwrap_or(false) {
                let _ = window.hide();
            } else {
                crate::tray::position_window_near_tray(&window);
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }
}

#[tauri::command]
pub fn send_notification(
    app_handle: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    app_handle
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e: tauri_plugin_notification::Error| e.to_string())
}

#[derive(serde::Deserialize)]
pub struct TrayIconUpdate {
    pub badge: Option<String>,
}

#[tauri::command]
pub fn update_tray_icon(
    app_handle: tauri::AppHandle,
    update: TrayIconUpdate,
) -> Result<(), String> {
    update_tray_icon_with_badge(&app_handle, update.badge.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
    PathBuf::from(path).exists()
}

// --------------------------------------------
// Settings Commands
// --------------------------------------------

fn get_settings_path(app_handle: &tauri::AppHandle) -> PathBuf {
    app_handle
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json")
}

#[tauri::command]
pub fn get_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, String> {
    let path = get_settings_path(&app_handle);
    if path.exists() {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(AppSettings::default())
    }
}

#[tauri::command]
pub fn save_settings(app_handle: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = get_settings_path(&app_handle);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Update autostart setting
    use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;
    let autostart = app_handle.autolaunch();
    if settings.autostart {
        let _ = autostart.enable();
    } else {
        let _ = autostart.disable();
    }

    // Save settings to disk
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(())
}

// --------------------------------------------
// Permission Popup Commands
// --------------------------------------------

#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct PermissionData {
    pub request: serde_json::Value,
    #[serde(rename = "sessionTitle")]
    pub session_title: String,
    #[serde(rename = "instanceUrl")]
    pub instance_url: String,
}

#[tauri::command]
pub fn show_permission_popup(
    app_handle: tauri::AppHandle,
    data: PermissionData,
) -> Result<(), String> {
    // Store the permission data
    {
        let mut pending = PENDING_PERMISSION.lock().map_err(|e| e.to_string())?;
        *pending = Some(serde_json::to_value(&data).map_err(|e| e.to_string())?);
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(window) = app_handle.get_webview_window("permission") {
            // Position the popup near the tray icon
            position_permission_popup(&app_handle);

            // Show the window
            let _ = window.show();
            let _ = window.set_focus();

            // Emit the permission data to the window
            let _ = window.emit("permission-request", &data);
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Some(window) = app_handle.get_webview_window("permission") {
            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("permission-request", &data);
        }
    }

    Ok(())
}

#[tauri::command]
pub fn hide_permission_popup(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Clear the pending permission
    {
        let mut pending = PENDING_PERMISSION.lock().map_err(|e| e.to_string())?;
        *pending = None;
    }

    if let Some(window) = app_handle.get_webview_window("permission") {
        let _ = window.hide();
    }

    Ok(())
}

#[tauri::command]
pub fn get_pending_permission() -> Result<Option<serde_json::Value>, String> {
    let pending = PENDING_PERMISSION.lock().map_err(|e| e.to_string())?;
    Ok(pending.clone())
}
