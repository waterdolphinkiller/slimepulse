use crate::AgentEventPayload;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tracing::info;

/// Passively scans local AI coding agent session logs (Claude Code, Codex CLI, OpenCode)
/// without requiring API keys or manual `/usage` scripts.
/// Uses raw byte-slice reads + `from_utf8_lossy` so multi-byte UTF-8 characters (CJK/Emoji)
/// can NEVER cause a string-slicing panic on log truncation or rotation.
fn candidate_log_roots() -> Vec<(&'static str, PathBuf)> {
    let Some(home) = dirs::home_dir() else {
        return vec![];
    };
    vec![
        ("claude-code", home.join(".claude").join("projects")),
        ("codex", home.join(".codex").join("sessions")),
        ("opencode", home.join(".local").join("share").join("opencode")),
    ]
}

fn collect_recent_jsonl(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth == 0 || !dir.exists() {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_recent_jsonl(&path, depth - 1, out);
        } else if path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("jsonl"))
            .unwrap_or(false)
        {
            out.push(path);
        }
    }
}

fn estimate_cost_usd(input_tokens: u64, output_tokens: u64) -> f64 {
    let raw = (input_tokens as f64 / 1_000_000.0) * 3.0 + (output_tokens as f64 / 1_000_000.0) * 15.0;
    (raw * 10_000.0).round() / 10_000.0
}

fn parse_usage_line(line: &str) -> Option<(u64, f64, Option<String>)> {
    let val: Value = serde_json::from_str(line).ok()?;
    let usage = val
        .get("usage")
        .or_else(|| val.get("message").and_then(|m| m.get("usage")))
        .or_else(|| val.get("payload").and_then(|p| p.get("usage")));

    let input_toks = usage
        .and_then(|u| u.get("input_tokens").or_else(|| u.get("prompt_tokens")))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let output_toks = usage
        .and_then(|u| u.get("output_tokens").or_else(|| u.get("completion_tokens")))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let total_toks = input_toks + output_toks;

    let explicit_cost = val
        .get("costUSD")
        .or_else(|| val.get("cost_usd"))
        .and_then(|v| v.as_f64());

    let file_path = val
        .get("file_path")
        .or_else(|| val.get("filePath"))
        .or_else(|| val.get("tool_input").and_then(|ti| ti.get("file_path")))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    if total_toks == 0 && explicit_cost.is_none() && file_path.is_none() {
        return None;
    }

    let cost = explicit_cost.unwrap_or_else(|| estimate_cost_usd(input_toks, output_toks));
    Some((total_toks, cost, file_path))
}

pub async fn start_passive_log_watcher(app: AppHandle) {
    let mut offsets: HashMap<PathBuf, u64> = HashMap::new();
    let mut initialized = false;

    loop {
        let roots = candidate_log_roots();
        for (agent_name, root) in roots {
            let mut files = Vec::new();
            collect_recent_jsonl(&root, 3, &mut files);

            for file in files {
                let Ok(meta) = fs::metadata(&file) else {
                    continue;
                };
                let len = meta.len();

                if !initialized {
                    offsets.insert(file, len);
                    continue;
                }

                let prev = *offsets.get(&file).unwrap_or(&0);
                if len <= prev {
                    offsets.insert(file, len);
                    continue;
                }

                // UTF-8 safe byte-slice read: never panics on multi-byte character boundaries
                if let Ok(bytes) = fs::read(&file) {
                    let start = (prev as usize).min(bytes.len());
                    let slice = String::from_utf8_lossy(&bytes[start..]);
                    let mut sum_tokens: u64 = 0;
                    let mut sum_cost: f64 = 0.0;
                    let mut latest_file: Option<String> = None;

                    for line in slice.lines() {
                        if let Some((toks, cost, fp)) = parse_usage_line(line) {
                            sum_tokens += toks;
                            sum_cost += cost;
                            if fp.is_some() {
                                latest_file = fp;
                            }
                        }
                    }

                    if sum_tokens > 0 || sum_cost > 0.0 || latest_file.is_some() {
                        let _ = app.emit(
                            "slimepulse://agent-event",
                            AgentEventPayload {
                                state: "AI_WORKING".into(),
                                label: None,
                                source: Some(format!("log-watcher:{agent_name}")),
                                session_id: file
                                    .file_stem()
                                    .map(|s| s.to_string_lossy().to_string()),
                                project_name: Some(agent_name.into()),
                                tool_name: None,
                                file_path: latest_file,
                                tokens_used: if sum_tokens > 0 { Some(sum_tokens) } else { None },
                                cost_usd: if sum_cost > 0.0 {
                                    Some((sum_cost * 10_000.0).round() / 10_000.0)
                                } else {
                                    None
                                },
                                subagent_delta: None,
                                duration_ms: Some(3_500),
                            },
                        );
                    }
                }
                offsets.insert(file, len);
            }
        }

        if !initialized {
            initialized = true;
            info!("SlimePulse passive log watcher initialized ({} session logs tracked)", offsets.len());
        }

        tokio::time::sleep(Duration::from_secs(4)).await;
    }
}
