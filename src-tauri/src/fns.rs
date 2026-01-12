#![allow(deprecated)]
#![allow(dead_code)]

use image::{DynamicImage, Rgba};
use tauri::AppHandle;

// macOS-specific imports and functions
#[cfg(target_os = "macos")]
mod macos {
    use std::ffi::CString;
    use tauri::{AppHandle, Emitter, Listener, Manager, WebviewWindow};
    use tauri_nspanel::{
        block::ConcreteBlock,
        cocoa::{
            appkit::{NSMainMenuWindowLevel, NSView, NSWindow, NSWindowCollectionBehavior},
            base::{id, nil},
            foundation::{NSPoint, NSRect},
        },
        objc::{class, msg_send, runtime::NO, sel, sel_impl},
        panel_delegate, ManagerExt, WebviewWindowExt,
    };

    #[allow(non_upper_case_globals)]
    const NSWindowStyleMaskNonActivatingPanel: i32 = 1 << 7;

    /// Convert the window to a proper menubar panel
    pub fn swizzle_to_panel(app_handle: &tauri::AppHandle) {
        let panel_delegate = panel_delegate!(OpenTrayPanelDelegate {
            window_did_resign_key
        });

        let window = app_handle.get_webview_window("main").unwrap();

        let panel = window.to_panel().unwrap();

        let handle = app_handle.clone();

        panel_delegate.set_listener(Box::new(move |delegate_name: String| {
            if delegate_name.as_str() == "window_did_resign_key" {
                let _ = handle.emit("panel_did_resign_key", ());
            }
        }));

        // Set level above main menu
        panel.set_level(NSMainMenuWindowLevel + 1);

        // Non-activating panel style
        panel.set_style_mask(NSWindowStyleMaskNonActivatingPanel);

        // Collection behavior for menubar apps
        panel.set_collection_behaviour(
            NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary,
        );

        panel.set_delegate(panel_delegate);
    }

    /// Setup listeners for auto-hiding the panel
    pub fn setup_panel_listeners(app_handle: &AppHandle) {
        fn hide_panel(app_handle: &tauri::AppHandle) {
            if check_is_frontmost() {
                return;
            }

            let panel = app_handle.get_webview_panel("main").unwrap();
            panel.order_out(None);
        }

        let handle = app_handle.clone();

        app_handle.listen_any("panel_did_resign_key", move |_| {
            hide_panel(&handle);
        });

        let handle = app_handle.clone();

        let callback = Box::new(move || {
            hide_panel(&handle);
        });

        // Hide when another app is activated
        register_workspace_listener(
            "NSWorkspaceDidActivateApplicationNotification".into(),
            callback.clone(),
        );

        // Hide when space changes
        register_workspace_listener(
            "NSWorkspaceActiveSpaceDidChangeNotification".into(),
            callback,
        );
    }

    /// Update panel appearance (rounded corners)
    pub fn update_panel_appearance(app_handle: &AppHandle) {
        let window = app_handle.get_webview_window("main").unwrap();
        set_corner_radius(&window, 12.0);
    }

    pub fn set_corner_radius(window: &WebviewWindow, radius: f64) {
        let win: id = window.ns_window().unwrap() as _;

        unsafe {
            let view: id = win.contentView();
            view.wantsLayer();
            let layer: id = view.layer();
            let _: () = msg_send![layer, setCornerRadius: radius];
        }
    }

    /// Position the panel below the menubar, centered on mouse position
    pub fn position_panel(app_handle: &tauri::AppHandle, padding_top: f64) {
        let window = app_handle.get_webview_window("main").unwrap();

        let monitor = monitor::get_monitor_with_cursor().unwrap();

        let scale_factor = monitor.scale_factor();

        let visible_area = monitor.visible_area();

        let monitor_pos = visible_area.position().to_logical::<f64>(scale_factor);

        let monitor_size = visible_area.size().to_logical::<f64>(scale_factor);

        let mouse_location: NSPoint = unsafe { msg_send![class!(NSEvent), mouseLocation] };

        let handle: id = window.ns_window().unwrap() as _;

        let mut win_frame: NSRect = unsafe { msg_send![handle, frame] };

        // Position at top of screen, below menubar
        win_frame.origin.y = (monitor_pos.y + monitor_size.height) - win_frame.size.height;
        win_frame.origin.y -= padding_top;

        // Center on mouse position
        win_frame.origin.x = {
            let top_right = mouse_location.x + (win_frame.size.width / 2.0);
            let is_offscreen = top_right > monitor_pos.x + monitor_size.width;

            if !is_offscreen {
                mouse_location.x - (win_frame.size.width / 2.0)
            } else {
                let diff = top_right - (monitor_pos.x + monitor_size.width);
                mouse_location.x - (win_frame.size.width / 2.0) - diff
            }
        };

        let _: () = unsafe { msg_send![handle, setFrame: win_frame display: NO] };
    }

    fn register_workspace_listener(name: String, callback: Box<dyn Fn()>) {
        let workspace: id = unsafe { msg_send![class!(NSWorkspace), sharedWorkspace] };

        let notification_center: id = unsafe { msg_send![workspace, notificationCenter] };

        let block = ConcreteBlock::new(move |_notif: id| {
            callback();
        });

        let block = block.copy();

        let name: id =
            unsafe { msg_send![class!(NSString), stringWithCString: CString::new(name).unwrap()] };

        unsafe {
            let _: () = msg_send![
                notification_center,
                addObserverForName: name object: nil queue: nil usingBlock: block
            ];
        }
    }

    fn app_pid() -> i32 {
        let process_info: id = unsafe { msg_send![class!(NSProcessInfo), processInfo] };
        let pid: i32 = unsafe { msg_send![process_info, processIdentifier] };
        pid
    }

    fn get_frontmost_app_pid() -> i32 {
        let workspace: id = unsafe { msg_send![class!(NSWorkspace), sharedWorkspace] };
        let frontmost_application: id = unsafe { msg_send![workspace, frontmostApplication] };
        let pid: i32 = unsafe { msg_send![frontmost_application, processIdentifier] };
        pid
    }

    pub fn check_is_frontmost() -> bool {
        get_frontmost_app_pid() == app_pid()
    }

    /// Position the permission popup near the tray icon (top right of screen)
    pub fn position_permission_popup(app_handle: &tauri::AppHandle) {
        let Some(window) = app_handle.get_webview_window("permission") else {
            return;
        };

        let monitor = monitor::get_monitor_with_cursor().unwrap();

        let scale_factor = monitor.scale_factor();

        let visible_area = monitor.visible_area();

        let monitor_pos = visible_area.position().to_logical::<f64>(scale_factor);

        let monitor_size = visible_area.size().to_logical::<f64>(scale_factor);

        let handle: id = window.ns_window().unwrap() as _;

        let mut win_frame: NSRect = unsafe { msg_send![handle, frame] };

        // Position at top of screen, below menubar
        win_frame.origin.y = (monitor_pos.y + monitor_size.height) - win_frame.size.height;

        // Position near the right side of the screen (where tray icons usually are)
        // Leave some padding from the edge
        win_frame.origin.x = monitor_pos.x + monitor_size.width - win_frame.size.width - 16.0;

        let _: () = unsafe { msg_send![handle, setFrame: win_frame display: NO] };

        // Set window level to be above everything
        unsafe {
            let _: () = msg_send![handle, setLevel: NSMainMenuWindowLevel + 2];
        }

        // Set corner radius for the permission popup
        set_corner_radius(&window, 10.0);
    }
}

// Re-export macOS functions when on macOS
#[cfg(target_os = "macos")]
pub use macos::{
    position_panel, position_permission_popup, setup_panel_listeners, swizzle_to_panel,
    update_panel_appearance,
};

/// Update the tray icon with a badge (e.g., "3" for 3 pending items)
/// This function works on all platforms
pub fn update_tray_icon_with_badge(
    app_handle: &AppHandle,
    badge: Option<&str>,
) -> tauri::Result<()> {
    use tauri::image::Image;

    let base_icon_bytes = include_bytes!("../icons/tray-dark.png");
    let base_icon = image::load_from_memory(base_icon_bytes).unwrap();

    let final_icon = if let Some(text) = badge {
        draw_badge_on_icon(&base_icon, text)?
    } else {
        base_icon
    };

    let mut buf = Vec::new();
    final_icon
        .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
        .map_err(|e| std::io::Error::other(e.to_string()))?;

    let icon = Image::from_bytes(&buf)?;

    if let Some(tray) = app_handle.tray_by_id("tray") {
        tray.set_icon(Some(icon))?;
    }

    Ok(())
}

/// Draw a badge with text on the tray icon
fn draw_badge_on_icon(base: &DynamicImage, _text: &str) -> tauri::Result<DynamicImage> {
    let mut image = base.to_rgba8();
    let (width, height) = image.dimensions();

    // Badge size (smaller for tray icons)
    let badge_size = width as i32 / 2;
    let badge_x = width as i32 - badge_size;
    let badge_y = 0;

    // Draw red circle badge
    let color = Rgba([255, 59, 48, 255]);
    for y in 0..badge_size {
        for x in 0..badge_size {
            let dx = x - badge_size / 2;
            let dy = y - badge_size / 2;
            if dx * dx + dy * dy <= (badge_size / 2).pow(2) {
                let px = (badge_x + x) as u32;
                let py = (badge_y + y) as u32;
                if px < width && py < height {
                    image.put_pixel(px, py, color);
                }
            }
        }
    }

    // For now, just draw the badge circle without text (simpler approach)
    // Text rendering requires a font file, which complicates the build
    // The badge color indicates there are pending items

    Ok(DynamicImage::ImageRgba8(image))
}
