#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env,
    fs,
    process::Command,
    path::PathBuf,
};

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
fn save_battery_snapshot(html: String) -> Result<String, String> {
    let mut path: PathBuf = tauri::api::path::app_data_dir(&tauri::Config::default())
        .ok_or("Could not get app data dir")?;

    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create dir: {e}"))?;

    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S");

    path.push(format!("battery_snapshot_{timestamp}.html"));

    fs::write(&path, html)
        .map_err(|e| format!("Failed to save snapshot: {e}"))?;

    Ok(path.to_string_lossy().to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_battery_report_html,
            save_battery_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}