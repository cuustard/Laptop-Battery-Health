#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::{env, fs, path::PathBuf, process::Command};

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatterySnapshot {
    captured_at: String,
    health_percent: Option<f64>,
    wear_percent: Option<f64>,
    #[serde(rename = "fullChargeCapacity_mWh")]
    full_charge_capacity_m_wh: Option<i64>,
    #[serde(rename = "designCapacity_mWh")]
    design_capacity_m_wh: Option<i64>,
    cycle_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SaveSnapshotOptions {
    only_save_when_changed: Option<bool>,
    min_hours_between_snapshots: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveSnapshotResult {
    saved: bool,
    reason: String,
    snapshot_count: usize,
}

fn history_file_path() -> Result<PathBuf, String> {
    let base = env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .map_err(|e| format!("Failed to resolve LOCALAPPDATA: {e}"))?;

    let app_dir = base.join("BatteryDashboard");
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;

    Ok(app_dir.join("battery-history.json"))
}

fn read_history_from_disk(path: &PathBuf) -> Result<Vec<BatterySnapshot>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents =
        fs::read_to_string(path).map_err(|e| format!("Failed to read history: {e}"))?;

    if contents.trim().is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse history JSON: {e}"))
}

fn write_history_to_disk(path: &PathBuf, history: &[BatterySnapshot]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(history)
        .map_err(|e| format!("Failed to serialize history: {e}"))?;

    fs::write(path, json).map_err(|e| format!("Failed to write history: {e}"))?;

    Ok(())
}

fn approx_equal(a: Option<f64>, b: Option<f64>) -> bool {
    match (a, b) {
        (Some(left), Some(right)) => (left - right).abs() < 0.0001,
        (None, None) => true,
        _ => false,
    }
}

fn snapshots_are_equivalent(a: &BatterySnapshot, b: &BatterySnapshot) -> bool {
    approx_equal(a.health_percent, b.health_percent)
        && approx_equal(a.wear_percent, b.wear_percent)
        && a.full_charge_capacity_m_wh == b.full_charge_capacity_m_wh
        && a.design_capacity_m_wh == b.design_capacity_m_wh
        && a.cycle_count == b.cycle_count
}

fn hours_between_snapshots(previous: &BatterySnapshot, next: &BatterySnapshot) -> Option<f64> {
    let previous_time = previous.captured_at.parse::<chrono::DateTime<chrono::Utc>>().ok()?;
    let next_time = next.captured_at.parse::<chrono::DateTime<chrono::Utc>>().ok()?;

    let diff = next_time - previous_time;
    Some(diff.num_seconds() as f64 / 3600.0)
}

#[tauri::command]
fn get_battery_report_html() -> Result<String, String> {
    let output_path = env::temp_dir().join("battery-report.html");

    let status = Command::new("powercfg")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "/batteryreport",
            "/output",
            output_path.to_string_lossy().as_ref(),
        ])
        .status()
        .map_err(|e| format!("Failed to run powercfg: {e}"))?;

    if !status.success() {
        return Err(format!("powercfg exited with status: {status}"));
    }

    fs::read_to_string(&output_path)
        .map_err(|e| format!("Failed to read generated report: {e}"))
}

#[tauri::command]
fn load_battery_history() -> Result<Vec<BatterySnapshot>, String> {
    let path = history_file_path()?;
    read_history_from_disk(&path)
}

#[tauri::command]
fn save_battery_snapshot(
    snapshot: BatterySnapshot,
    options: Option<SaveSnapshotOptions>,
) -> Result<SaveSnapshotResult, String> {
    let path = history_file_path()?;
    let mut history = read_history_from_disk(&path)?;

    let resolved_options = options.unwrap_or_default();
    let only_save_when_changed = resolved_options.only_save_when_changed.unwrap_or(true);
    let min_hours_between_snapshots = resolved_options.min_hours_between_snapshots.unwrap_or(0.0);

    if let Some(latest) = history.last() {
        if min_hours_between_snapshots > 0.0 {
            if let Some(hours_since_latest) = hours_between_snapshots(latest, &snapshot) {
                if hours_since_latest < min_hours_between_snapshots {
                    return Ok(SaveSnapshotResult {
                        saved: false,
                        reason: "min_interval_not_reached".to_string(),
                        snapshot_count: history.len(),
                    });
                }
            }
        }

        if only_save_when_changed && snapshots_are_equivalent(latest, &snapshot) {
            return Ok(SaveSnapshotResult {
                saved: false,
                reason: "duplicate_snapshot".to_string(),
                snapshot_count: history.len(),
            });
        }
    }

    history.push(snapshot);
    write_history_to_disk(&path, &history)?;

    Ok(SaveSnapshotResult {
        saved: true,
        reason: if history.len() == 1 {
            "history_empty".to_string()
        } else {
            "saved".to_string()
        },
        snapshot_count: history.len(),
    })
}

#[tauri::command]
fn clear_battery_history() -> Result<(), String> {
    let path = history_file_path()?;

    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete history file: {e}"))?;
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_battery_report_html,
            load_battery_history,
            save_battery_snapshot,
            clear_battery_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}