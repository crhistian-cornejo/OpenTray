use tauri::{
    image::Image,
    tray::{MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle,
};

#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;

#[cfg(target_os = "macos")]
use crate::fns::position_panel;

pub fn create(app_handle: &AppHandle) -> tauri::Result<TrayIcon> {
    // Use simplified monochrome icon for macOS (template icon)
    // Use full color logo for Windows
    #[cfg(target_os = "macos")]
    let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;

    #[cfg(not(target_os = "macos"))]
    let icon = Image::from_bytes(include_bytes!("../icons/logo-32x32.png"))?;

    let mut builder = TrayIconBuilder::with_id("tray")
        .icon(icon)
        .tooltip("OpenTray");

    // Only use template mode on macOS (adapts to light/dark mode)
    #[cfg(target_os = "macos")]
    {
        builder = builder.icon_as_template(true);
    }

    builder
        .on_tray_icon_event(|tray, event| {
            let app_handle = tray.app_handle();

            if let TrayIconEvent::Click { button_state, .. } = event {
                if button_state == MouseButtonState::Up {
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
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                }
            }
        })
        .build(app_handle)
}
