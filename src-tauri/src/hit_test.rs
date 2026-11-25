use serde::Serialize;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalCursorPos {
    pub x: f64,
    pub y: f64,
    pub inside_window: bool,
}

/// Polls cursor position at ~20Hz and reports local coordinates to the transparent pet window.
/// The frontend checks whether (x, y) intersects the slime's optical jelly hitbox and calls
/// `set_click_through(should_ignore)` so clicks on transparent margins pass through to apps below.
pub async fn start_cursor_position_emitter(app: AppHandle) {
    let mut last_inside = false;
    loop {
        if let Some(win) = app.get_webview_window("main") {
            if let (Ok(cursor), Ok(pos), Ok(size)) = (
                win.cursor_position(),
                win.outer_position(),
                win.outer_size(),
            ) {
                let scale = win.scale_factor().unwrap_or(1.0);
                let lx = (cursor.x - pos.x as f64) / scale;
                let ly = (cursor.y - pos.y as f64) / scale;
                let w = size.width as f64 / scale;
                let h = size.height as f64 / scale;
                let inside = lx >= 0.0 && ly >= 0.0 && lx <= w && ly <= h;

                if inside || last_inside {
                    let _ = app.emit(
                        "slimepulse://cursor-pos",
                        LocalCursorPos {
                            x: lx,
                            y: ly,
                            inside_window: inside,
                        },
                    );
                }
                last_inside = inside;
            }
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}
