import styles from "./SettingsView.module.css";

import type { BatteryReport } from "../../types/battery";
import type { BatterySnapshot } from "../../types/history";
import type {
    AppPreferences,
    DesktopSettings,
    TrackingSettings,
} from "../../types/settings";

import { MIN_TREND_DAYS, MIN_TREND_SNAPSHOTS } from "../../lib/history";
import { formatMWh } from "../../lib/formatters";

import { SectionCard } from "../ui/SectionCard";
import { InfoRow } from "../ui/InfoRow";
import { AppearanceSection } from "./AppearanceSection";
import { AccessibilitySection } from "./AccessibilitySection";
import { TrackingSection } from "./TrackingSection";
import { BackgroundSection } from "./BackgroundSection";
import { DataSection } from "./DataSection";
import { AboutSection } from "./AboutSection";

type SettingsViewProps = {
    preferences: AppPreferences;
    setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
    trackingDraft: TrackingSettings;
    updateTrackingDraft: (partial: Partial<TrackingSettings>) => void;
    desktopSettings: DesktopSettings;
    desktopDraft: DesktopSettings;
    updateDesktopDraft: (partial: Partial<DesktopSettings>) => void;
    history: BatterySnapshot[];
    trackingStartedAt: string | null;
    lastSnapshotAt: string | null;
    formatDateTime: (
        value: string | null | undefined,
        options?: { includeRelative?: boolean }
    ) => string;
    handleExportSummary: () => void;
    handleExportRawData: () => void;
    handleExportCsv: () => void;
    handleResetAllData: () => Promise<void>;
    isResettingData: boolean;
    settingsMessage: string | null;
    settingsSaveMessage: string | null;
    hasPendingSettingsChanges: boolean;
    isSavingManagedSettings: boolean;
    resetManagedSettingsDrafts: () => void;
    handleSaveManagedSettings: () => Promise<void>;
    data: BatteryReport | null;
    battery: BatteryReport["batteries"][number] | undefined;
    hasMetadata: boolean;
};

export function SettingsView({
    preferences,
    setPreferences,
    trackingDraft,
    updateTrackingDraft,
    desktopSettings,
    desktopDraft,
    updateDesktopDraft,
    history,
    trackingStartedAt,
    lastSnapshotAt,
    formatDateTime,
    handleExportSummary,
    handleExportRawData,
    handleExportCsv,
    handleResetAllData,
    isResettingData,
    settingsMessage,
    settingsSaveMessage,
    hasPendingSettingsChanges,
    isSavingManagedSettings,
    resetManagedSettingsDrafts,
    handleSaveManagedSettings,
    data,
    battery,
    hasMetadata,
}: SettingsViewProps) {
    return (
        <div className={styles.settingsStack}>
            <AppearanceSection
                preferences={preferences}
                setPreferences={setPreferences}
            />

            <AccessibilitySection
                preferences={preferences}
                setPreferences={setPreferences}
            />

            <hr className={styles.settingsDivider} />

            <TrackingSection
                trackingDraft={trackingDraft}
                updateTrackingDraft={updateTrackingDraft}
            />

            <BackgroundSection
                desktopDraft={desktopDraft}
                updateDesktopDraft={updateDesktopDraft}
            />

            <SectionCard
                title="Save settings"
                description="Tracking and background changes stay pending until you confirm them."
            >
                <div className="settings-save-bar">
                    <div className="settings-save-bar__content">
                        <strong>
                            {hasPendingSettingsChanges
                                ? "You have unsaved changes."
                                : "All tracking and background settings are saved."}
                        </strong>
                        <small>
                            Appearance and accessibility settings still save
                            instantly.
                        </small>
                    </div>

                    <div className="settings-save-bar__actions">
                        <button
                            type="button"
                            className="app-button app-button--secondary"
                            onClick={resetManagedSettingsDrafts}
                            disabled={
                                !hasPendingSettingsChanges ||
                                isSavingManagedSettings
                            }
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            className="app-button"
                            onClick={() => void handleSaveManagedSettings()}
                            disabled={
                                !hasPendingSettingsChanges ||
                                isSavingManagedSettings
                            }
                        >
                            {isSavingManagedSettings
                                ? "Saving..."
                                : "Save changes"}
                        </button>
                    </div>
                </div>

                {settingsSaveMessage && (
                    <p className="settings-message">{settingsSaveMessage}</p>
                )}
            </SectionCard>

            <hr className={styles.settingsDivider} />

            <DataSection
                historyLength={history.length}
                trackingStartedAt={trackingStartedAt}
                lastSnapshotAt={lastSnapshotAt}
                formatDateTime={formatDateTime}
                handleExportSummary={handleExportSummary}
                handleExportRawData={handleExportRawData}
                handleExportCsv={handleExportCsv}
                handleResetAllData={handleResetAllData}
                isResettingData={isResettingData}
                settingsMessage={settingsMessage}
            />

            <hr className={styles.settingsDivider} />

            {data ? (
                <div className="details-grid">
                    <SectionCard
                        title="System information"
                        description="Basic metadata extracted from the battery report."
                    >
                        {hasMetadata ? (
                            <>
                                <InfoRow
                                    label="Computer"
                                    value={data.metadata.computerName ?? "N/A"}
                                />
                                <InfoRow
                                    label="System product"
                                    value={
                                        data.metadata.systemProductName ?? "N/A"
                                    }
                                />
                                <InfoRow
                                    label="BIOS"
                                    value={data.metadata.bios ?? "N/A"}
                                />
                                <InfoRow
                                    label="OS build"
                                    value={data.metadata.osBuild ?? "N/A"}
                                />
                                <InfoRow
                                    label="Report time"
                                    value={formatDateTime(
                                        data.metadata.reportTime
                                    )}
                                />
                            </>
                        ) : (
                            <p className="app-empty-state">
                                No system metadata was found in this report.
                            </p>
                        )}
                    </SectionCard>

                    <SectionCard
                        title="Battery details"
                        description="Installed battery properties reported by Windows."
                    >
                        {battery ? (
                            <>
                                <InfoRow
                                    label="Name"
                                    value={battery.name ?? "N/A"}
                                />
                                <InfoRow
                                    label="Manufacturer"
                                    value={battery.manufacturer ?? "N/A"}
                                />
                                <InfoRow
                                    label="Serial number"
                                    value={battery.serialNumber ?? "N/A"}
                                />
                                <InfoRow
                                    label="Chemistry"
                                    value={battery.chemistry ?? "N/A"}
                                />
                                <InfoRow
                                    label="Design capacity"
                                    value={formatMWh(
                                        battery.designCapacity_mWh
                                    )}
                                />
                                <InfoRow
                                    label="Full charge capacity"
                                    value={formatMWh(
                                        battery.fullChargeCapacity_mWh
                                    )}
                                />
                            </>
                        ) : (
                            <p className="app-empty-state">
                                No battery details were found in this report.
                            </p>
                        )}
                    </SectionCard>
                </div>
            ) : (
                <p className="app-empty-state">
                    Load a battery report to view device information.
                </p>
            )}

            <AboutSection
                preferences={preferences}
                desktopSettings={desktopSettings}
                minTrendSnapshots={MIN_TREND_SNAPSHOTS}
                minTrendDays={MIN_TREND_DAYS}
            />
        </div>
    );
}
