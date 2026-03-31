use regex::Regex;
use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::{
    env, fs,
    path::PathBuf,
    process::Command,
    thread,
    time::{Duration, Instant},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, Runtime, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartManagerExt};
use tauri_plugin_notification::NotificationExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const BACKGROUND_ARG: &str = "--background";
const MONITOR_POLL_SECONDS: u64 = 60;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSettings {
    launch_on_startup: bool,
    minimize_to_tray_on_close: bool,
    background_checks_enabled: bool,
    background_check_interval_hours: u64,
    battery_health_alerts_enabled: bool,
    battery_health_threshold_percent: f64,
    #[serde(default)]
    last_alert_sent_below_threshold: bool,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            launch_on_startup: false,
            minimize_to_tray_on_close: false,
            background_checks_enabled: false,
            background_check_interval_hours: 24,
            battery_health_alerts_enabled: false,
            battery_health_threshold_percent: 80.0,
            last_alert_sent_below_threshold: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSettingsPayload {
    launch_on_startup: bool,
    minimize_to_tray_on_close: bool,
    background_checks_enabled: bool,
    background_check_interval_hours: u64,
    battery_health_alerts_enabled: bool,
    battery_health_threshold_percent: f64,
}

impl DesktopSettings {
    fn to_payload(&self) -> DesktopSettingsPayload {
        DesktopSettingsPayload {
            launch_on_startup: self.launch_on_startup,
            minimize_to_tray_on_close: self.minimize_to_tray_on_close,
            background_checks_enabled: self.background_checks_enabled,
            background_check_interval_hours: self.background_check_interval_hours,
            battery_health_alerts_enabled: self.battery_health_alerts_enabled,
            battery_health_threshold_percent: self.battery_health_threshold_percent,
        }
    }

    fn apply_payload(&mut self, payload: DesktopSettingsPayload) {
        self.launch_on_startup = payload.launch_on_startup;
        self.minimize_to_tray_on_close = payload.minimize_to_tray_on_close;
        self.background_checks_enabled = payload.background_checks_enabled;
        self.background_check_interval_hours = payload.background_check_interval_hours.max(1);
        self.battery_health_alerts_enabled = payload.battery_health_alerts_enabled;
        self.battery_health_threshold_percent =
            payload.battery_health_threshold_percent.clamp(1.0, 100.0);
    }
}

fn app_data_dir() -> Result<PathBuf, String> {
    let base = env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .map_err(|e| format!("Failed to resolve LOCALAPPDATA: {e}"))?;

    let app_dir = base.join("BatteryDashboard");
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;

    Ok(app_dir)
}

fn history_file_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("battery-history.json"))
}

fn settings_file_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("desktop-settings.json"))
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

fn read_desktop_settings_from_disk() -> Result<DesktopSettings, String> {
    let path = settings_file_path()?;

    if !path.exists() {
        return Ok(DesktopSettings::default());
    }

    let contents =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {e}"))?;

    if contents.trim().is_empty() {
        return Ok(DesktopSettings::default());
    }

    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse settings JSON: {e}"))
}

fn write_desktop_settings_to_disk(settings: &DesktopSettings) -> Result<(), String> {
    let path = settings_file_path()?;
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;

    fs::write(path, json).map_err(|e| format!("Failed to write settings: {e}"))?;

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
    let previous_time = previous
        .captured_at
        .parse::<chrono::DateTime<chrono::Utc>>()
        .ok()?;
    let next_time = next
        .captured_at
        .parse::<chrono::DateTime<chrono::Utc>>()
        .ok()?;

    let diff = next_time - previous_time;
    Some(diff.num_seconds() as f64 / 3600.0)
}

fn save_snapshot_internal(
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

fn extract_all_mwh_values(html: &str, label: &str) -> Vec<i64> {
    let pattern = format!(
        r"(?is)<tr>\s*<td>\s*{}\s*</td>\s*<td>\s*([\d,]+)\s*mWh\s*</td>",
        regex::escape(label)
    );

    let Ok(regex) = Regex::new(&pattern) else {
        return Vec::new();
    };

    regex
        .captures_iter(html)
        .filter_map(|capture| capture.get(1).map(|m| m.as_str().replace(',', "")))
        .filter_map(|value| value.parse::<i64>().ok())
        .collect()
}

fn extract_all_cycle_counts(html: &str) -> Vec<i64> {
    let Ok(regex) =
        Regex::new(r"(?is)<tr>\s*<td>\s*CYCLE COUNT\s*</td>\s*<td>\s*([\d,]+)\s*</td>")
    else {
        return Vec::new();
    };

    regex
        .captures_iter(html)
        .filter_map(|capture| capture.get(1).map(|m| m.as_str().replace(',', "")))
        .filter_map(|value| value.parse::<i64>().ok())
        .collect()
}

fn create_snapshot_from_report_html(html: &str) -> Option<BatterySnapshot> {
    let design_values = extract_all_mwh_values(html, "DESIGN CAPACITY");
    let full_values = extract_all_mwh_values(html, "FULL CHARGE CAPACITY");
    let cycle_counts = extract_all_cycle_counts(html);

    let design_total: i64 = design_values.iter().sum();
    let full_total: i64 = full_values.iter().sum();
    let cycle_total: i64 = cycle_counts.iter().sum();

    if design_total <= 0 || full_total <= 0 {
        return None;
    }

    let health_percent = (full_total as f64 / design_total as f64) * 100.0;
    let wear_percent = 100.0 - health_percent;

    Some(BatterySnapshot {
        captured_at: chrono::Utc::now().to_rfc3339(),
        health_percent: Some(health_percent),
        wear_percent: Some(wear_percent),
        full_charge_capacity_m_wh: Some(full_total),
        design_capacity_m_wh: Some(design_total),
        cycle_count: if cycle_total > 0 {
            Some(cycle_total)
        } else {
            None
        },
    })
}

fn sync_autostart<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();

    if enabled {
        manager
            .enable()
            .map_err(|e| format!("Failed to enable autostart: {e}"))?;
    } else {
        manager
            .disable()
            .map_err(|e| format!("Failed to disable autostart: {e}"))?;
    }

    manager
        .is_enabled()
        .map_err(|e| format!("Failed to read autostart status: {e}"))
}

fn open_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn create_tray<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => open_main_window(app),
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
                open_main_window(&tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let _ = builder.build(app)?;
    Ok(())
}

fn run_background_check<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let mut settings = read_desktop_settings_from_disk()?;
    if !settings.background_checks_enabled {
        if settings.last_alert_sent_below_threshold {
            settings.last_alert_sent_below_threshold = false;
            write_desktop_settings_to_disk(&settings)?;
        }
        return Ok(());
    }

    let html = get_battery_report_html()?;
    let Some(snapshot) = create_snapshot_from_report_html(&html) else {
        return Ok(());
    };

    let _ = save_snapshot_internal(
        snapshot.clone(),
        Some(SaveSnapshotOptions {
            only_save_when_changed: Some(true),
            min_hours_between_snapshots: Some(settings.background_check_interval_hours as f64),
        }),
    )?;

    if settings.battery_health_alerts_enabled {
        if let Some(health_percent) = snapshot.health_percent {
            let is_below_threshold =
                health_percent < settings.battery_health_threshold_percent;

            if is_below_threshold && !settings.last_alert_sent_below_threshold {
                let body = format!(
                    "Battery health is now {:.1}%, below your {:.1}% alert threshold.",
                    health_percent, settings.battery_health_threshold_percent
                );

                let _ = app
                    .notification()
                    .builder()
                    .title("Battery health alert")
                    .body(&body)
                    .show();

                settings.last_alert_sent_below_threshold = true;
                write_desktop_settings_to_disk(&settings)?;
            } else if !is_below_threshold && settings.last_alert_sent_below_threshold {
                settings.last_alert_sent_below_threshold = false;
                write_desktop_settings_to_disk(&settings)?;
            }
        }
    } else if settings.last_alert_sent_below_threshold {
        settings.last_alert_sent_below_threshold = false;
        write_desktop_settings_to_disk(&settings)?;
    }

    Ok(())
}

fn start_background_monitor<R: Runtime>(app: AppHandle<R>) {
    thread::spawn(move || {
        let mut last_run: Option<Instant> = None;

        loop {
            let settings = read_desktop_settings_from_disk().unwrap_or_default();

            if settings.background_checks_enabled {
                let interval_secs = settings
                    .background_check_interval_hours
                    .max(1)
                    .saturating_mul(3600);

                let should_run = last_run
                    .map(|previous| previous.elapsed().as_secs() >= interval_secs)
                    .unwrap_or(true);

                if should_run {
                    let _ = run_background_check(&app);
                    last_run = Some(Instant::now());
                }
            } else {
                last_run = None;
            }

            thread::sleep(Duration::from_secs(MONITOR_POLL_SECONDS));
        }
    });
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
    save_snapshot_internal(snapshot, options)
}

#[tauri::command]
fn clear_battery_history() -> Result<(), String> {
    let path = history_file_path()?;

    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete history file: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
fn load_desktop_settings<R: Runtime>(app: AppHandle<R>) -> Result<DesktopSettingsPayload, String> {
    let mut settings = read_desktop_settings_from_disk()?;

    if let Ok(actual_autostart_state) = app.autolaunch().is_enabled() {
        settings.launch_on_startup = actual_autostart_state;
    }

    write_desktop_settings_to_disk(&settings)?;
    Ok(settings.to_payload())
}

#[tauri::command]
fn save_desktop_settings<R: Runtime>(
    app: AppHandle<R>,
    settings: DesktopSettingsPayload,
) -> Result<DesktopSettingsPayload, String> {
    let mut stored = read_desktop_settings_from_disk()?;
    stored.apply_payload(settings);

    stored.launch_on_startup = sync_autostart(&app, stored.launch_on_startup)?;
    write_desktop_settings_to_disk(&stored)?;

    Ok(stored.to_payload())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            // When user tries to open another instance
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            app.handle().plugin(tauri_plugin_autostart::init(
                MacosLauncher::LaunchAgent,
                Some(vec![BACKGROUND_ARG]),
            ))?;

            create_tray(app)?;
            start_background_monitor(app.handle().clone());

            if std::env::args().any(|arg| arg == BACKGROUND_ARG) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let settings = read_desktop_settings_from_disk().unwrap_or_default();
                api.prevent_close();

                if settings.minimize_to_tray_on_close {
                    let _ = window.hide();
                } else {
                    window.app_handle().exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_battery_report_html,
            load_battery_history,
            save_battery_snapshot,
            clear_battery_history,
            load_desktop_settings,
            save_desktop_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}