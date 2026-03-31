import { SectionCard } from "../ui/SectionCard";
import { InfoRow } from "../ui/InfoRow";
import type { AppPreferences, DesktopSettings } from "../../types/settings";

type AboutSectionProps = {
    preferences: AppPreferences;
    desktopSettings: DesktopSettings;
    minTrendSnapshots: number;
    minTrendDays: number;
};

export function AboutSection({
    preferences,
    desktopSettings,
    minTrendSnapshots,
    minTrendDays,
}: AboutSectionProps) {
    return (
        <SectionCard title="About" description="Basic app information.">
            <div className="settings-about">
                <InfoRow label="App" value="Battery Dashboard" />
                <InfoRow label="Theme mode" value={preferences.theme} />
                <InfoRow
                    label="Trend reliability rule"
                    value={`${minTrendSnapshots}+ snapshots and ${minTrendDays}+ days`}
                />
                <InfoRow
                    label="Background checks"
                    value={
                        desktopSettings.backgroundChecksEnabled
                            ? `Enabled every ${desktopSettings.backgroundCheckIntervalHours} hour(s)`
                            : "Disabled"
                    }
                />
                <InfoRow
                    label="Health alerts"
                    value={
                        desktopSettings.batteryHealthAlertsEnabled
                            ? `Enabled below ${desktopSettings.batteryHealthThresholdPercent}%`
                            : "Disabled"
                    }
                />
                <InfoRow
                    label="Accessibility"
                    value={
                        [
                            preferences.highContrast ? "High contrast" : null,
                            preferences.largeText ? "Large text" : null,
                            preferences.colorBlindFriendly
                                ? "Colour-blind palette"
                                : null,
                        ]
                            .filter(Boolean)
                            .join(", ") || "Default"
                    }
                />
            </div>
        </SectionCard>
    );
}
