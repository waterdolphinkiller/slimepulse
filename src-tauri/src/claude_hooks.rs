use serde::Serialize;
use serde_json::{json, Map, Value};
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum HookError {
    #[error("Could not locate user home directory")]
    NoHomeDir,
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid JSON in ~/.claude/settings.json: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HookInstallResult {
    pub settings_path: String,
    pub backup_path: Option<String>,
    pub installed_events: Vec<String>,
}

const HOOK_EVENTS: &[&str] = &[
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "SubagentStart",
    "SubagentStop",
    "Notification",
    "Stop",
    "StopFailure",
];

fn settings_path() -> Result<PathBuf, HookError> {
    let home = dirs::home_dir().ok_or(HookError::NoHomeDir)?;
    Ok(home.join(".claude").join("settings.json"))
}

/// Builds an OS-appropriate, fail-silent, 800ms-timeout command hook so Claude Code
/// is NEVER blocked on Windows, macOS, or Linux even if SlimePulse is closed.
#[cfg(target_os = "windows")]
fn build_hook_command(port: u16) -> String {
    format!(
        "curl.exe -sS --max-time 0.8 -X POST http://127.0.0.1:{port}/claude-hook -H \"Content-Type: application/json\" --data-binary @- >NUL 2>&1 || exit /b 0"
    )
}

#[cfg(not(target_os = "windows"))]
fn build_hook_command(port: u16) -> String {
    format!(
        "curl -sS --max-time 0.8 -X POST http://127.0.0.1:{port}/claude-hook -H \"Content-Type: application/json\" --data-binary @- >/dev/null 2>&1 || true"
    )
}

pub fn is_installed() -> Result<bool, HookError> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(false);
    }
    let raw = fs::read_to_string(&path)?;
    Ok(raw.contains("/claude-hook") && raw.contains("127.0.0.1"))
}

pub fn install_hooks(port: u16) -> Result<HookInstallResult, HookError> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut backup_path = None;
    let mut root: Value = if path.exists() {
        let raw = fs::read_to_string(&path)?;
        let bp = path.with_extension("json.slimepulse.bak");
        fs::write(&bp, &raw)?;
        backup_path = Some(bp.display().to_string());
        if raw.trim().is_empty() {
            json!({})
        } else {
            serde_json::from_str(&raw)?
        }
    } else {
        json!({})
    };

    let obj = root
        .as_object_mut()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "Root must be object"))?;

    let hooks_val = obj
        .entry("hooks".to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    let hooks_obj = hooks_val
        .as_object_mut()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "hooks must be object"))?;

    let cmd = build_hook_command(port);
    let slimepulse_entry = json!({
        "matcher": "*",
        "hooks": [
            {
                "type": "command",
                "command": cmd,
                "async": true
            }
        ]
    });

    for &event_name in HOOK_EVENTS {
        let arr = hooks_obj
            .entry(event_name.to_string())
            .or_insert_with(|| Value::Array(vec![]));
        if let Some(list) = arr.as_array_mut() {
            list.retain(|entry| !entry.to_string().contains("/claude-hook"));
            list.push(slimepulse_entry.clone());
        }
    }

    let formatted = serde_json::to_string_pretty(&root)?;
    fs::write(&path, format!("{formatted}\n"))?;

    Ok(HookInstallResult {
        settings_path: path.display().to_string(),
        backup_path,
        installed_events: HOOK_EVENTS.iter().map(|s| s.to_string()).collect(),
    })
}

pub fn uninstall_hooks() -> Result<String, HookError> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok("No ~/.claude/settings.json found.".into());
    }
    let raw = fs::read_to_string(&path)?;
    let mut root: Value = serde_json::from_str(&raw)?;
    if let Some(hooks_obj) = root.get_mut("hooks").and_then(|v| v.as_object_mut()) {
        for &event_name in HOOK_EVENTS {
            if let Some(list) = hooks_obj.get_mut(event_name).and_then(|v| v.as_array_mut()) {
                list.retain(|entry| !entry.to_string().contains("/claude-hook"));
            }
        }
    }
    let formatted = serde_json::to_string_pretty(&root)?;
    fs::write(&path, format!("{formatted}\n"))?;
    Ok(format!("Removed SlimePulse hooks from {}", path.display()))
}

/// Safely backs up and merges SlimePulse MCP server config into Cursor (~/.cursor/mcp.json)
/// or Gemini CLI (~/.gemini/settings.json) with zero manual JSON editing.
pub fn install_mcp_for_agent(agent: &str, mcp_script_path: &str) -> Result<String, HookError> {
    let home = dirs::home_dir().ok_or(HookError::NoHomeDir)?;
    let path = match agent {
        "cursor" => home.join(".cursor").join("mcp.json"),
        "gemini" => home.join(".gemini").join("settings.json"),
        _ => return Err(HookError::Io(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Unsupported agent"))),
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut root: Value = if path.exists() {
        let raw = fs::read_to_string(&path)?;
        let bp = path.with_extension("json.slimepulse.bak");
        let _ = fs::write(&bp, &raw);
        if raw.trim().is_empty() { json!({}) } else { serde_json::from_str(&raw)? }
    } else {
        json!({})
    };
    let obj = root
        .as_object_mut()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "Root must be object"))?;
    let servers = obj
        .entry("mcpServers".to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if let Some(map) = servers.as_object_mut() {
        map.insert(
            "slimepulse".to_string(),
            json!({ "command": "node", "args": [mcp_script_path] }),
        );
    }
    let formatted = serde_json::to_string_pretty(&root)?;
    fs::write(&path, format!("{formatted}\n"))?;
    Ok(path.display().to_string())
}
