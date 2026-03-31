import type { DesktopSettings } from "../types/settings";

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
    launchOnStartup: false,
    minimizeToTrayOnClose: false,
    backgroundChecksEnabled: false,
    backgroundCheckIntervalHours: 24,
    batteryHealthAlertsEnabled: false,
    batteryHealthThresholdPercent: 80,
};

export function formatSnapshotSaveReason(reason: string): string {
    switch (reason) {
        case "saved":
            return "Snapshot saved.";
        case "duplicate_snapshot":
            return "No changes detected — snapshot not saved.";
        case "min_interval_not_reached":
            return "Snapshot not saved yet — the minimum save interval has not passed.";
        case "history_empty":
            return "No prior history found. First snapshot saved.";
        default:
            return "Snapshot check completed.";
    }
}
