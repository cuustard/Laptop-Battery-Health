#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env,
    fs,
    process::Command,
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_battery_report_html])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}