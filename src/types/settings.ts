export type SaveSnapshotResult = {
    saved: boolean;
    reason: string;
    snapshotCount: number;
};

export type SaveSnapshotOptions = {
    onlySaveWhenChanged: boolean;
    minHoursBetweenSnapshots: number;
};

export type ViewMode = "dashboard" | "settings";
export type ThemeMode = "light" | "dark" | "system";

export type AppPreferences = {
    theme: ThemeMode;
    highContrast: boolean;
    largeText: boolean;
    colorBlindFriendly: boolean;
    autoSaveOnLoad: boolean;
    onlySaveWhenChanged: boolean;
    minHoursBetweenSnapshots: number;
};

export type TrackingSettings = Pick<
    AppPreferences,
    "autoSaveOnLoad" | "onlySaveWhenChanged" | "minHoursBetweenSnapshots"
>;

export type DesktopSettings = {
    launchOnStartup: boolean;
    minimizeToTrayOnClose: boolean;
    backgroundChecksEnabled: boolean;
    backgroundCheckIntervalHours: number;
    batteryHealthAlertsEnabled: boolean;
    batteryHealthThresholdPercent: number;
};
