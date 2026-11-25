use crate::HardwareMetrics;
use std::process::Command;
use std::time::Duration;
use sysinfo::{ProcessesToUpdate, System};
use tauri::{AppHandle, Emitter};

fn probe_nvidia_gpu_percent() -> Option<f32> {
    let output = Command::new("nvidia-smi")
        .args([
            "--query-gpu=utilization.gpu",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines().next()?.trim().parse::<f32>().ok()
}

/// Lightweight macOS Apple Silicon / Metal GPU utilization probe via `ioreg` (no sudo required).
#[cfg(target_os = "macos")]
fn probe_macos_gpu_percent() -> Option<f32> {
    let output = Command::new("ioreg")
        .args(["-r", "-d", "1", "-w", "0", "-c", "IOAccelerator"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    for key in ["\"Device Utilization %\"=", "\"Renderer Utilization %\"="] {
        if let Some(idx) = text.find(key) {
            let rest = &text[idx + key.len()..];
            let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(val) = digits.parse::<f32>() {
                return Some(val.clamp(0.0, 100.0));
            }
        }
    }
    None
}

fn probe_gpu_percent() -> Option<f32> {
    #[cfg(target_os = "macos")]
    {
        if let Some(v) = probe_macos_gpu_percent() {
            return Some(v);
        }
    }
    probe_nvidia_gpu_percent()
}

/// Auto-Stealth Meeting & Screen-Share Detector (zero new dependencies, reuses `sysinfo`).
/// Detects active video call / screen-recording processes so the slime melts unobtrusively.
fn detect_meeting_or_recording(sys: &mut System) -> bool {
    sys.refresh_processes(ProcessesToUpdate::All, true);
    const STEALTH_PROCS: &[&str] = &[
        "zoom.us",
        "zoom",
        "obs",
        "obs64",
        "microsoft teams",
        "ms-teams",
        "loom",
        "webex",
        "screenstudio",
    ];
    for proc_info in sys.processes().values() {
        let name = proc_info.name().to_string_lossy().to_lowercase();
        if STEALTH_PROCS.iter().any(|&p| name == p || name.starts_with(p)) {
            return true;
        }
    }
    false
}

pub async fn start_hardware_monitor(app: AppHandle) {
    let mut sys = System::new_all();
    let mut smoothed_cpu: f32 = 0.0;
    let mut tick: u32 = 0;
    let mut last_gpu: Option<f32> = None;
    let mut meeting_stealth = false;

    loop {
        sys.refresh_cpu_usage();
        sys.refresh_memory();

        let raw_cpu = sys.global_cpu_usage();
        smoothed_cpu = if smoothed_cpu == 0.0 {
            raw_cpu
        } else {
            smoothed_cpu * 0.65 + raw_cpu * 0.35
        };

        let total_mem = sys.total_memory().max(1) as f32;
        let used_mem = sys.used_memory() as f32;
        let memory_percent = (used_mem / total_mem) * 100.0;

        if tick % 3 == 0 {
            last_gpu = probe_gpu_percent();
            meeting_stealth = detect_meeting_or_recording(&mut sys);
        }
        tick = tick.wrapping_add(1);

        let metrics = HardwareMetrics {
            cpu_percent: (smoothed_cpu * 10.0).round() / 10.0,
            memory_percent: (memory_percent * 10.0).round() / 10.0,
            gpu_percent: last_gpu,
            meeting_stealth,
        };

        let _ = app.emit("slimepulse://hardware-metrics", metrics);
        tokio::time::sleep(Duration::from_millis(1800)).await;
    }
}
