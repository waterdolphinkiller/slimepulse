use crate::AgentEventPayload;
use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tower_http::cors::CorsLayer;
use tracing::{info, warn};

#[derive(Clone)]
struct AppState {
    app: AppHandle,
}

#[derive(Debug, Deserialize)]
struct ClaudeHookPayload {
    #[serde(default)]
    hook_event_name: Option<String>,
    #[serde(default)]
    event: Option<String>,
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    cwd: Option<String>,
    #[serde(default)]
    tool_name: Option<String>,
    #[serde(default, alias = "filePath")]
    file_path: Option<String>,
    #[serde(default)]
    tool_input: Option<Value>,
    #[serde(default, alias = "tokensUsed")]
    tokens_used: Option<u64>,
    #[serde(default, alias = "costUsd")]
    cost_usd: Option<f64>,
    #[serde(default)]
    notification_type: Option<String>,
    #[serde(default)]
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsagePayload {
    #[serde(default, alias = "tokensUsed")]
    tokens_used: u64,
    #[serde(default, alias = "costUsd")]
    cost_usd: f64,
    #[serde(default, alias = "sessionId")]
    session_id: Option<String>,
    #[serde(default, alias = "projectName")]
    project_name: Option<String>,
}

/// Detects high-risk shell/SQL commands so SlimePulse immediately flashes a red DANGER alert.
fn detect_dangerous_command(text: &str) -> Option<&'static str> {
    let lower = text.to_lowercase();
    const PATTERNS: &[(&str, &str)] = &[
        ("rm -rf", "rm -rf"),
        ("git push --force", "git push --force"),
        ("git push -f", "git push -f"),
        ("git reset --hard", "git reset --hard"),
        ("drop table", "DROP TABLE"),
        ("drop database", "DROP DATABASE"),
        ("chmod 777", "chmod 777"),
        ("sudo rm", "sudo rm"),
    ];
    for &(needle, label) in PATTERNS {
        if lower.contains(needle) {
            return Some(label);
        }
    }
    None
}

fn extract_project_name(cwd: &Option<String>) -> Option<String> {
    cwd.as_deref()
        .and_then(|p| Path::new(p).file_name())
        .map(|n| n.to_string_lossy().to_string())
        .filter(|s| !s.is_empty())
}

async fn health() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "slimepulse-webhook",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

async fn handle_generic_event(
    State(state): State<AppState>,
    Json(payload): Json<AgentEventPayload>,
) -> StatusCode {
    if let Err(err) = state.app.emit("slimepulse://agent-event", payload) {
        warn!("Failed to emit agent event: {err}");
        return StatusCode::INTERNAL_SERVER_ERROR;
    }
    StatusCode::OK
}

/// Innovation 1 endpoint: accepts live Token / API cost updates from Claude Code statusline or scripts.
async fn handle_usage(
    State(state): State<AppState>,
    Json(payload): Json<UsagePayload>,
) -> StatusCode {
    let mapped = AgentEventPayload {
        state: "AI_WORKING".into(),
        label: None,
        source: Some("usage".into()),
        session_id: payload.session_id,
        project_name: payload.project_name,
        tool_name: None,
        file_path: None,
        tokens_used: Some(payload.tokens_used),
        cost_usd: Some(payload.cost_usd),
        subagent_delta: None,
        duration_ms: Some(3_000),
    };
    if let Err(err) = state.app.emit("slimepulse://agent-event", mapped) {
        warn!("Failed to emit usage event: {err}");
        return StatusCode::INTERNAL_SERVER_ERROR;
    }
    StatusCode::OK
}

async fn handle_claude_hook(
    State(state): State<AppState>,
    Json(payload): Json<ClaudeHookPayload>,
) -> StatusCode {
    let event_name = payload
        .hook_event_name
        .or(payload.event)
        .unwrap_or_default();
    let project_name = extract_project_name(&payload.cwd);
    let session_id = payload.session_id.or_else(|| project_name.clone());
    let tool_name = payload.tool_name.clone();

    // Extract file_path or command from nested tool_input if top-level file_path is absent
    let nested_file_path = payload
        .tool_input
        .as_ref()
        .and_then(|ti| ti.get("file_path").or_else(|| ti.get("path")))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let command_text = payload
        .tool_input
        .as_ref()
        .and_then(|ti| ti.get("command"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let combined_check = format!(
        "{} {}",
        command_text,
        payload.message.as_deref().unwrap_or("")
    );
    let danger = detect_dangerous_command(&combined_check);

    let (st, label, delta, dur) = if let Some(rule) = danger {
        let prefix = project_name
            .as_ref()
            .map(|p| format!("[{p}] "))
            .unwrap_or_default();
        (
            "NEED_APPROVAL",
            Some(format!("⚠️ DANGER {prefix}{rule}")),
            None,
            None,
        )
    } else {
        match event_name.as_str() {
            "UserPromptSubmit" => ("AI_THINKING", Some("Thinking...".into()), None, Some(15_000)),
            "PreToolUse" => {
                let lbl = tool_name
                    .as_ref()
                    .map(|t| format!("Running {t}..."))
                    .unwrap_or_else(|| "Coding...".into());
                ("AI_WORKING", Some(lbl), None, Some(12_000))
            }
            "PostToolUse" => ("AI_THINKING", Some("Reviewing output...".into()), None, Some(6_000)),
            "SubagentStart" => ("AI_JUGGLING", Some("Subagent spawned!".into()), Some(1), None),
            "SubagentStop" => ("AI_WORKING", Some("Subagent done".into()), Some(-1), Some(4_000)),
            "Notification" => {
                let ntype = payload.notification_type.unwrap_or_default();
                if ntype == "permission_prompt" {
                    let prefix = project_name
                        .as_ref()
                        .map(|p| format!("[{p}] "))
                        .unwrap_or_default();
                    let msg = payload
                        .message
                        .or_else(|| tool_name.as_ref().map(|t| format!("Allow {t}?")))
                        .unwrap_or_else(|| "Needs approval!".into());
                    ("NEED_APPROVAL", Some(format!("{prefix}{msg}")), None, None)
                } else {
                    ("IDLE", payload.message, None, Some(3_000))
                }
            }
            "Stop" => ("TASK_DONE", Some("Done! +15 XP".into()), Some(-99), Some(5_000)),
            "StopFailure" => (
                "TASK_ERROR",
                payload.message.or_else(|| Some("Build / tool failed!".into())),
                Some(-99),
                Some(6_000),
            ),
            _ => ("AI_WORKING", Some(format!("Event: {event_name}")), None, Some(4_000)),
        }
    };

    let mapped = AgentEventPayload {
        state: st.into(),
        label,
        source: Some("claude-code".into()),
        session_id,
        project_name,
        tool_name,
        file_path: payload.file_path.or(nested_file_path),
        tokens_used: payload.tokens_used,
        cost_usd: payload.cost_usd,
        subagent_delta: delta,
        duration_ms: dur,
    };

    if let Err(err) = state.app.emit("slimepulse://agent-event", mapped) {
        warn!("Failed to emit Claude hook event: {err}");
        return StatusCode::INTERNAL_SERVER_ERROR;
    }
    StatusCode::OK
}

pub async fn start_webhook_server(app: AppHandle, port: u16) {
    let router = Router::new()
        .route("/health", get(health))
        .route("/event", post(handle_generic_event))
        .route("/usage", post(handle_usage))
        .route("/claude-hook", post(handle_claude_hook))
        .layer(CorsLayer::permissive())
        .with_state(AppState { app });

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => {
            info!("SlimePulse v3.0 webhook server listening on http://{addr}");
            if let Err(err) = axum::serve(listener, router).await {
                warn!("Webhook server exited: {err}");
            }
        }
        Err(err) => {
            warn!("Could not bind local webhook server on {addr}: {err}");
        }
    }
}
