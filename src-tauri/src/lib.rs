mod claude_hooks;
mod hardware;
mod hit_test;
mod input_monitor;
mod log_watcher;
mod webhook;

use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEventPayload {
    pub state: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub project_name: Option<String>,
    #[serde(default)]
    pub tool_name: Option<String>,
    #[serde(default)]
    pub file_path: Option<String>,
    #[serde(default)]
    pub tokens_used: Option<u64>,
    #[serde(default)]
    pub cost_usd: Option<f64>,
    #[serde(default)]
    pub subagent_delta: Option<i32>,
    #[serde(default)]
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareMetrics {
    pub cpu_percent: f32,
    pub memory_percent: f32,
    pub gpu_percent: Option<f32>,
    pub meeting_stealth: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedAgent {
    pub id: &'static str,
    pub name: &'static str,
    pub detected: bool,
    pub config_hint: String,
}

#[tauri::command]
fn detect_installed_agents() -> Vec<DetectedAgent> {
    let home = dirs::home_dir();
    let check = |rel: &str| -> bool {
        home.as_ref().map(|h| h.join(rel).exists()).unwrap_or(false)
    };
    vec![
        DetectedAgent {
            id: "claude-code",
            name: "Claude Code",
            detected: check(".claude"),
            config_hint: "~/.claude/settings.json".into(),
        },
        DetectedAgent {
            id: "codex",
            name: "OpenAI Codex CLI",
            detected: check(".codex"),
            config_hint: "~/.codex/sessions/ (auto-watched)".into(),
        },
        DetectedAgent {
            id: "opencode",
            name: "OpenCode",
            detected: check(".config/opencode") || check(".local/share/opencode"),
            config_hint: "~/.local/share/opencode (auto-watched + MCP)".into(),
        },
        DetectedAgent {
            id: "gemini-cli",
            name: "Gemini CLI",
            detected: check(".gemini"),
            config_hint: "~/.gemini/settings.json (MCP)".into(),
        },
        DetectedAgent {
            id: "cursor",
            name: "Cursor",
            detected: check(".cursor"),
            config_hint: "~/.cursor/mcp.json (MCP)".into(),
        },
    ]
}


#[tauri::command]
fn install_mcp_for_agent(agent: String, mcp_script_path: String) -> Result<String, String> {
    claude_hooks::install_mcp_for_agent(&agent, &mcp_script_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_window_position(app: AppHandle) -> Result<(), String> {
    let Some(win) = app.get_webview_window("main") else { return Ok(()); };
    let Ok(pos) = win.outer_position() else { return Ok(()); };
    if let Some(home) = dirs::home_dir() {
        let path = home.join(".slimepulse_pos.json");
        let data = serde_json::json!({ "x": pos.x, "y": pos.y });
        let _ = std::fs::write(path, data.to_string());
    }
    Ok(())
}

fn restore_window_position(app: &tauri::App) {
    let Some(win) = app.get_webview_window("main") else { return; };
    let Some(home) = dirs::home_dir() else { return; };
    let path = home.join(".slimepulse_pos.json");
    let Ok(raw) = std::fs::read_to_string(path) else { return; };
    let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) else { return; };
    let (Some(x), Some(y)) = (val.get("x").and_then(|v| v.as_i64()), val.get("y").and_then(|v| v.as_i64())) else { return; };
    // Clamp safely within current primary monitor bounds so unplugged external displays never hide the slime!
    if let Ok(Some(mon)) = win.current_monitor() {
        let sz = mon.size();
        let clamped_x = (x as i32).clamp(0, (sz.width as i32 - 280).max(0));
        let clamped_y = (y as i32).clamp(0, (sz.height as i32 - 280).max(0));
        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(clamped_x, clamped_y)));
    }
}

#[tauri::command]
fn install_claude_code_hooks(port: Option<u16>) -> Result<claude_hooks::HookInstallResult, String> {
    claude_hooks::install_hooks(port.unwrap_or(47890)).map_err(|e| e.to_string())
}

#[tauri::command]
fn uninstall_claude_code_hooks() -> Result<String, String> {
    claude_hooks::uninstall_hooks().map_err(|e| e.to_string())
}

#[tauri::command]
fn check_claude_code_hooks() -> Result<bool, String> {
    claude_hooks::is_installed().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        win.show().map_err(|e| e.to_string())?;
        win.unminimize().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_click_through(app: AppHandle, ignore: bool) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.set_ignore_cursor_events(ignore)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn toggle_zen_hide(app: AppHandle) -> Result<bool, String> {
    if let Some(win) = app.get_webview_window("main") {
        let visible = win.is_visible().unwrap_or(true);
        if visible {
            win.hide().map_err(|e| e.to_string())?;
            return Ok(false);
        } else {
            win.show().map_err(|e| e.to_string())?;
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
fn focus_terminal_window(hint: Option<String>) -> Result<String, String> {
    let target = hint.unwrap_or_default();

    #[cfg(target_os = "macos")]
    {
        // Support direct URL scheme deep-links for Codex / Claude desktop apps if hinted
        if target.eq_ignore_ascii_case("codex") {
            if Command::new("open").arg("codex://launch").status().map(|s| s.success()).unwrap_or(false) {
                return Ok("Opened codex://launch".into());
            }
        }
        let candidates = ["Cursor", "Visual Studio Code", "Ghostty", "Warp", "iTerm2", "Terminal"];
        for app_name in candidates {
            let script = format!(
                "tell application \"System Events\" to if exists (process \"{app_name}\") then tell application \"{app_name}\" to activate"
            );
            if let Ok(out) = Command::new("osascript").args(["-e", &script]).output() {
                if out.status.success() {
                    return Ok(format!("Activated {app_name} ({target})"));
                }
            }
        }
        return Ok("No running terminal app matched".into());
    }

    #[cfg(target_os = "windows")]
    {
        let ps = r#"
$wshell = New-Object -ComObject WScript.Shell
foreach ($t in @("Cursor", "Visual Studio Code", "Windows Terminal", "PowerShell", "cmd")) {
  if ($wshell.AppActivate($t)) { Write-Output $t; exit 0 }
}
"#;
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps])
            .output();
        return Ok(format!("Focused terminal ({target})"));
    }

    #[cfg(target_os = "linux")]
    {
        for wm_target in ["Cursor", "Visual Studio Code", "Terminal", "kitty", "Alacritty"] {
            if Command::new("wmctrl").args(["-a", wm_target]).status().map(|s| s.success()).unwrap_or(false) {
                return Ok(format!("Activated {wm_target} ({target})"));
            }
        }
        return Ok("Focus attempted".into());
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "toggle_pet", "Zen Mode: Show / Hide Slime", true, None::<&str>)?;
    let mute_item = MenuItem::with_id(app, "toggle_mute", "Mute / Unmute Sound Effects", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings & Slime DNA", true, None::<&str>)?;
    let hook_item = MenuItem::with_id(app, "install_hooks", "One-Click Claude Code Hooks", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit SlimePulse", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &mute_item, &settings_item, &hook_item, &quit_item])?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("SlimePulse v3.0 — Optical Jelly AI Companion");

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle_pet" => { let _ = toggle_zen_hide(app.clone()); }
            "toggle_mute" => { let _ = app.emit("slimepulse://toggle-mute", true); }
            "settings" => {
                if let Some(win) = app.get_webview_window("settings") {
                    let _ = win.show();
                    let _ = win.unminimize();
                    let _ = win.set_focus();
                }
            }
            "install_hooks" => {
                let res = claude_hooks::install_hooks(47890);
                let (state, label) = match res {
                    Ok(_) => ("TASK_DONE", "Claude Code Hooks installed!"),
                    Err(_) => ("TASK_ERROR", "Could not update ~/.claude/settings.json"),
                };
                let _ = app.emit(
                    "slimepulse://agent-event",
                    AgentEventPayload {
                        state: state.into(),
                        label: Some(label.into()),
                        source: Some("system".into()),
                        session_id: None,
                        project_name: None,
                        tool_name: None,
                        file_path: None,
                        tokens_used: None,
                        cost_usd: None,
                        subagent_delta: None,
                        duration_ms: Some(3500),
                    },
                );
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .on_window_event(|window, event| {
            if window.label() == "settings" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            setup_tray(app)?;
            restore_window_position(app);

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                webhook::start_webhook_server(handle, 47890).await;
            });

            let hw_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                hardware::start_hardware_monitor(hw_handle).await;
            });

            let log_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                log_watcher::start_passive_log_watcher(log_handle).await;
            });

            let input_handle = app.handle().clone();
            input_monitor::start_privacy_safe_input_monitor(input_handle);

            let hit_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                hit_test::start_cursor_position_emitter(hit_handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_installed_agents,
            install_mcp_for_agent,
            save_window_position,
            install_claude_code_hooks,
            uninstall_claude_code_hooks,
            check_claude_code_hooks,
            open_settings_window,
            set_click_through,
            toggle_zen_hide,
            focus_terminal_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SlimePulse");
}
