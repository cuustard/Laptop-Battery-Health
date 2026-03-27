use serde::{Deserialize, Serialize};
use std::{env, fs, path::PathBuf, process::Command};

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

#[tauri::command]
fn get_battery_report_html() -> Result<String, String> {
    let output_path = env::temp_dir().join("battery-report.html");

    let status = Command::new("powercfg")
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
fn save_battery_snapshot(snapshot: BatterySnapshot) -> Result<SaveSnapshotResult, String> {
    let path = history_file_path()?;
    let mut history = read_history_from_disk(&path)?;

    if let Some(latest) = history.last() {
        if snapshots_are_equivalent(latest, &snapshot) {
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
        reason: "saved".to_string(),
        snapshot_count: history.len(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_battery_report_html,
            load_battery_history,
            save_battery_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}