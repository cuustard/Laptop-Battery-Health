import type { AppPreferences, TrackingSettings } from "../types/settings";

const PREFERENCES_STORAGE_KEY = "battery-dashboard-preferences";

export const DEFAULT_PREFERENCES: AppPreferences = {
    theme: "system",
    highContrast: false,
    largeText: false,
    colorBlindFriendly: false,
    autoSaveOnLoad: true,
    onlySaveWhenChanged: true,
    minHoursBetweenSnapshots: 24,
};

export function getTrackingSettings(
    preferences: AppPreferences
): TrackingSettings {
    return {
        autoSaveOnLoad: preferences.autoSaveOnLoad,
        onlySaveWhenChanged: preferences.onlySaveWhenChanged,
        minHoursBetweenSnapshots: preferences.minHoursBetweenSnapshots,
    };
}

export function loadPreferences(): AppPreferences {
    try {
        const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
        if (!raw) return DEFAULT_PREFERENCES;

        const parsed = JSON.parse(raw) as Partial<AppPreferences>;
        return {
            theme:
                parsed.theme === "light" ||
                parsed.theme === "dark" ||
                parsed.theme === "system"
                    ? parsed.theme
                    : DEFAULT_PREFERENCES.theme,
            highContrast:
                typeof parsed.highContrast === "boolean"
                    ? parsed.highContrast
                    : DEFAULT_PREFERENCES.highContrast,
            largeText:
                typeof parsed.largeText === "boolean"
                    ? parsed.largeText
                    : DEFAULT_PREFERENCES.largeText,
            colorBlindFriendly:
                typeof parsed.colorBlindFriendly === "boolean"
                    ? parsed.colorBlindFriendly
                    : DEFAULT_PREFERENCES.colorBlindFriendly,
            autoSaveOnLoad:
                typeof parsed.autoSaveOnLoad === "boolean"
                    ? parsed.autoSaveOnLoad
                    : DEFAULT_PREFERENCES.autoSaveOnLoad,
            onlySaveWhenChanged:
                typeof parsed.onlySaveWhenChanged === "boolean"
                    ? parsed.onlySaveWhenChanged
                    : DEFAULT_PREFERENCES.onlySaveWhenChanged,
            minHoursBetweenSnapshots:
                typeof parsed.minHoursBetweenSnapshots === "number" &&
                Number.isFinite(parsed.minHoursBetweenSnapshots) &&
                parsed.minHoursBetweenSnapshots >= 0
                    ? parsed.minHoursBetweenSnapshots
                    : DEFAULT_PREFERENCES.minHoursBetweenSnapshots,
        };
    } catch {
        return DEFAULT_PREFERENCES;
    }
}

export function savePreferences(preferences: AppPreferences) {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}
