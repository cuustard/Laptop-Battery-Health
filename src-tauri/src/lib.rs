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

fn history_file_path() -> Result<PathBuf, String> {
    let base = env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .map_err(|e| format!("Failed to resolve LOCALAPPDATA: {e}"))?;

    let app_dir = base.join("BatteryDashboard");
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;

    Ok(app_dir.join("battery-history.json"))
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

    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read history: {e}"))?;

    if contents.trim().is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse history JSON: {e}"))
}

#[tauri::command]
fn save_battery_snapshot(snapshot: BatterySnapshot) -> Result<(), String> {
    let path = history_file_path()?;

    let mut history = if path.exists() {
        let contents = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read history for update: {e}"))?;

        if contents.trim().is_empty() {
            Vec::new()
        } else {
            serde_json::from_str::<Vec<BatterySnapshot>>(&contents)
                .map_err(|e| format!("Failed to parse history for update: {e}"))?
        }
    } else {
        Vec::new()
    };

    history.push(snapshot);

    let json = serde_json::to_string_pretty(&history)
        .map_err(|e| format!("Failed to serialize history: {e}"))?;

    fs::write(&path, json).map_err(|e| format!("Failed to write history: {e}"))?;

    Ok(())
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