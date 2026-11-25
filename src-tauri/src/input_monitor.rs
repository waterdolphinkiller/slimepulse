use serde::Serialize;
use std::panic;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use tauri::{AppHandle, Emitter};
use tracing::warn;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PawTapEvent {
    /// Alternates "left" and "right" purely for BongoCat animation.
    /// PRIVACY GUARANTEE: Keycodes, characters, and window titles are NEVER inspected or stored.
    pub paw: &'static str,
}

static NEXT_LEFT: AtomicBool = AtomicBool::new(true);

/// Starts a background listener for global key presses & mouse clicks.
/// Strictly emits only an anonymous boolean paw-tap event (`left` / `right`) — zero keylogging.
/// Wrapped in catch_unwind + Wayland/macOS graceful fallback so missing OS permissions never crash the app.
pub fn start_privacy_safe_input_monitor(app: AppHandle) {
    // On Linux Wayland sessions without XWayland input forwarding, avoid crashing rdev
    #[cfg(target_os = "linux")]
    if std::env::var("XDG_SESSION_TYPE")
        .map(|v| v.eq_ignore_ascii_case("wayland"))
        .unwrap_or(false)
        && std::env::var("DISPLAY").is_err()
    {
        warn!("Wayland-only session detected: global key tap disabled (AI hooks & CPU/GPU still active).");
        return;
    }

    thread::spawn(move || {
        let app_clone = app.clone();
        let result = panic::catch_unwind(move || {
            let callback = move |event: rdev::Event| {
                let is_tap = matches!(
                    event.event_type,
                    rdev::EventType::KeyPress(_) | rdev::EventType::ButtonPress(_)
                );
                if is_tap {
                    // Intentionally discard the inner key/button value immediately.
                    let left = NEXT_LEFT.fetch_xor(true, Ordering::Relaxed);
                    let payload = PawTapEvent {
                        paw: if left { "left" } else { "right" },
                    };
                    let _ = app_clone.emit("slimepulse://paw-tap", payload);
                }
            };

            if let Err(err) = rdev::listen(callback) {
                warn!("Global input monitor unavailable (grant OS Accessibility permission for Bongo taps): {err:?}");
            }
        });

        if result.is_err() {
            warn!("Global input monitor exited safely due to OS permission restriction.");
        }
    });
}
