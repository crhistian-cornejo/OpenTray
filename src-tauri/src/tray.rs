use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter,
};

#[cfg(not(target_os = "macos"))]
use tauri::Manager;

#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;

#[cfg(target_os = "macos")]
use crate::fns::position_panel;

pub fn create(app_handle: &AppHandle) -> tauri::Result<TrayIcon> {
    // Use PNG icon for tray - SVG is not supported by Tauri
    // macOS: Use template icon (monochrome) - system auto-adapts to theme
    // Windows/Linux: Use colored icon, manually switch based on theme
    #[cfg(target_os = "macos")]
    let icon = Image::from_bytes(include_bytes!("../icons/tray-template.png"))?;

    #[cfg(not(target_os = "macos"))]
    let icon = Image::from_bytes(include_bytes!("../icons/tray-dark.png"))?;

    // Build context menu
    let show_item = MenuItemBuilder::with_id("show", "Show OpenTray").build(app_handle)?;
    let new_session_item =
        MenuItemBuilder::with_id("new_session", "New Session").build(app_handle)?;
    let separator1 = tauri::menu::PredefinedMenuItem::separator(app_handle)?;
    let refresh_item = MenuItemBuilder::with_id("refresh", "Refresh").build(app_handle)?;
    let settings_item = MenuItemBuilder::with_id("settings", "Settings...").build(app_handle)?;
    let separator2 = tauri::menu::PredefinedMenuItem::separator(app_handle)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit OpenTray").build(app_handle)?;

    let menu = MenuBuilder::new(app_handle)
        .item(&show_item)
        .item(&new_session_item)
        .item(&separator1)
        .item(&refresh_item)
        .item(&settings_item)
        .item(&separator2)
        .item(&quit_item)
        .build()?;

    #[cfg(target_os = "macos")]
    let builder = TrayIconBuilder::with_id("tray")
        .icon(icon)
        .tooltip("OpenTray")
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(false);

    #[cfg(not(target_os = "macos"))]
    let builder = TrayIconBuilder::with_id("tray")
        .icon(icon)
        .tooltip("OpenTray")
        .menu(&menu)
        .show_menu_on_left_click(false);

    builder
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show" => {
                    crate::command::toggle_panel_internal(app);
                }
                "new_session" => {
                    // Emit event to frontend to create new session
                    let _ = app.emit("tray-new-session", ());
                    crate::command::show_panel_internal(app);
                }
                "refresh" => {
                    // Emit event to frontend to refresh
                    let _ = app.emit("tray-refresh", ());
                }
                "settings" => {
                    // Emit event to frontend to show settings
                    let _ = app.emit("tray-settings", ());
                    crate::command::show_panel_internal(app);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            let app_handle = tray.app_handle();

            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                #[cfg(target_os = "macos")]
                {
                    let panel = app_handle.get_webview_panel("main").unwrap();

                    if panel.is_visible() {
                        panel.order_out(None);
                        return;
                    }

                    position_panel(app_handle, 0.0);
                    panel.show();
                }

                #[cfg(not(target_os = "macos"))]
                {
                    // On Windows, toggle the main window
                    if let Some(window) = app_handle.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            // Position window near system tray
                            position_window_near_tray(&window);
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            }
        })
        .build(app_handle)
}

/// Position window near the system tray (Windows)
#[cfg(not(target_os = "macos"))]
pub fn position_window_near_tray(window: &tauri::WebviewWindow) {
    use tauri::PhysicalPosition;

    // Try to get the primary monitor
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let monitor_size = monitor.size();
        let monitor_position = monitor.position();
        let scale = monitor.scale_factor();

        if let Ok(win_size) = window.outer_size() {
            // Position at bottom-right of screen, above taskbar (assuming 40px taskbar)
            let taskbar_height = 48.0 * scale;
            let padding = 12.0 * scale;

            let x = (monitor_position.x as f64 + monitor_size.width as f64
                - win_size.width as f64
                - padding) as i32;
            let y = (monitor_position.y as f64 + monitor_size.height as f64
                - win_size.height as f64
                - taskbar_height
                - padding) as i32;

            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
    }
}

/// Update tray icon based on system theme (Windows/Linux)
#[cfg(not(target_os = "macos"))]
pub fn update_icon_for_theme(app_handle: &AppHandle, theme: &str) -> tauri::Result<()> {
    // tray-dark.png = dark icon for light backgrounds
    // tray-light.png = light icon for dark backgrounds
    let icon_bytes = if theme == "dark" {
        // Dark system theme = dark taskbar = needs light icon
        include_bytes!("../icons/tray-light.png").as_slice()
    } else {
        // Light system theme = light taskbar = needs dark icon
        include_bytes!("../icons/tray-dark.png").as_slice()
    };

    let icon = Image::from_bytes(icon_bytes)?;

    if let Some(tray) = app_handle.tray_by_id("tray") {
        tray.set_icon(Some(icon))?;
    }

    Ok(())
}
