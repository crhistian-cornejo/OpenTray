use std::path::PathBuf;
use std::sync::Once;

use tauri::Manager;
#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;
use tauri_plugin_notification::NotificationExt;

use crate::fns::update_tray_icon_with_badge;
#[cfg(target_os = "macos")]
use crate::fns::{
    position_panel, setup_panel_listeners, swizzle_to_panel, update_panel_appearance,
};

static INIT: Once = Once::new();

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
    #[cfg(target_os = "macos")]
    {
        let panel = app_handle.get_webview_panel("main").unwrap();
        position_panel(&app_handle, 0.0);
        panel.show();
    }
    #[cfg(not(target_os = "macos"))]
    {
        // On Windows, show the main window instead
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
pub fn hide_panel(app_handle: tauri::AppHandle) {
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
