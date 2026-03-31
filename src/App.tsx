import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import type { BatteryReport } from "./types/battery";
import type { BatterySnapshot } from "./types/history";
import type {
    AppPreferences,
    DesktopSettings,
    SaveSnapshotOptions,
    SaveSnapshotResult,
    TrackingSettings,
    ViewMode,
} from "./types/settings";

import { parseBatteryReportHtml } from "./lib/parseBatteryReport";
import {
    calculateHealthPercent,
    calculateWearPercent,
    getHealthLabel,
} from "./lib/batteryMetrics";
import { generateInsights } from "./lib/batteryInsights";
import { formatMWh, formatPercent } from "./lib/formatters";
import {
    calculateDegradationTrend,
    compareHistory,
    createSnapshot,
    formatDelta,
} from "./lib/history";
import {
    getTrackingSettings,
    loadPreferences,
    savePreferences,
} from "./lib/preferences";
import {
    DEFAULT_DESKTOP_SETTINGS,
    formatSnapshotSaveReason,
} from "./lib/settings";
import { formatDateTime } from "./lib/dateTime";
import {
    downloadCsvFile,
    downloadTextFile,
    formatDateForFilename,
} from "./lib/exportUtils";
import { formatTrendValue } from "./lib/displayHelpers";

import { StatCard } from "./components/ui/StatCard";
import { SectionCard } from "./components/ui/SectionCard";
import { InfoRow } from "./components/ui/InfoRow";
import { CapacityHistoryChart } from "./components/charts/CapacityHistoryChart";
import { RecentUsageChart } from "./components/charts/RecentUsageChart";
import { InsightsPanel } from "./components/insights/InsightsPanel";
import { SettingsView } from "./components/settings/SettingsView";
import { invoke } from "@tauri-apps/api/core";

function App() {
    const [view, setView] = useState<ViewMode>("dashboard");
    const [preferences, setPreferences] =
        useState<AppPreferences>(loadPreferences);
    const [trackingDraft, setTrackingDraft] = useState<TrackingSettings>(() =>
        getTrackingSettings(loadPreferences())
    );
    const [desktopSettings, setDesktopSettings] = useState<DesktopSettings>(
        DEFAULT_DESKTOP_SETTINGS
    );
    const [desktopDraft, setDesktopDraft] = useState<DesktopSettings>(
        DEFAULT_DESKTOP_SETTINGS
    );
    const [data, setData] = useState<BatteryReport | null>(null);
    const [history, setHistory] = useState<BatterySnapshot[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isResettingData, setIsResettingData] = useState(false);
    const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
    const [settingsSaveMessage, setSettingsSaveMessage] = useState<
        string | null
    >(null);
    const [isSavingManagedSettings, setIsSavingManagedSettings] =
        useState(false);
    const [lastSnapshotMessage, setLastSnapshotMessage] = useState<
        string | null
    >(null);

    const hasAutoLoadedRef = useRef(false);

    useEffect(() => {
        savePreferences(preferences);

        document.documentElement.dataset.theme = preferences.theme;
        document.documentElement.dataset.contrast = preferences.highContrast
            ? "high"
            : "standard";
        document.documentElement.dataset.textSize = preferences.largeText
            ? "large"
            : "standard";
        document.documentElement.dataset.palette =
            preferences.colorBlindFriendly ? "colorblind" : "default";
    }, [preferences]);

    useEffect(() => {
        void loadDesktopSettings();
    }, []);

    async function loadDesktopSettings() {
        try {
            const loaded = await invoke<DesktopSettings>(
                "load_desktop_settings"
            );
            setDesktopSettings(loaded);
            setDesktopDraft(loaded);
        } catch (err) {
            console.error("Failed to load desktop settings", err);
            setSettingsSaveMessage(
                err instanceof Error
                    ? err.message
                    : "Failed to load desktop settings."
            );
        }
    }

    async function persistDesktopSettings(next: DesktopSettings) {
        const saved = await invoke<DesktopSettings>("save_desktop_settings", {
            settings: next,
        });

        setDesktopSettings(saved);
        setDesktopDraft(saved);
        return saved;
    }

    function updateDesktopDraft(partial: Partial<DesktopSettings>) {
        setSettingsSaveMessage(null);
        setDesktopDraft((current) => ({ ...current, ...partial }));
    }

    function updateTrackingDraft(partial: Partial<TrackingSettings>) {
        setSettingsSaveMessage(null);
        setTrackingDraft((current) => ({ ...current, ...partial }));
    }

    async function handleSaveManagedSettings() {
        setSettingsSaveMessage(null);
        setIsSavingManagedSettings(true);

        try {
            const nextPreferences = {
                ...preferences,
                ...trackingDraft,
            };

            savePreferences(nextPreferences);
            setPreferences(nextPreferences);

            await persistDesktopSettings(desktopDraft);

            setSettingsSaveMessage("Tracking and background settings saved.");
        } catch (err) {
            console.error(err);
            setSettingsSaveMessage(
                err instanceof Error ? err.message : "Failed to save settings."
            );
        } finally {
            setIsSavingManagedSettings(false);
        }
    }

    function resetManagedSettingsDrafts() {
        setTrackingDraft(getTrackingSettings(preferences));
        setDesktopDraft(desktopSettings);
        setSettingsSaveMessage(null);
    }

    async function refreshHistory() {
        try {
            const loaded = await invoke<BatterySnapshot[]>(
                "load_battery_history"
            );
            setHistory(loaded);
        } catch (err) {
            console.error("Failed to load history", err);
        }
    }

    async function loadBatteryReport(options?: {
        silent?: boolean;
        saveSnapshot?: boolean;
    }) {
        const silent = options?.silent ?? false;
        const shouldSaveSnapshot =
            options?.saveSnapshot ?? preferences.autoSaveOnLoad;

        setError(null);
        setIsLoading(true);
        setLastSnapshotMessage(null);

        try {
            const html = await invoke<string>("get_battery_report_html");
            const parsed = parseBatteryReportHtml(html);

            setData(parsed);

            const snapshot = createSnapshot(parsed);
            if (snapshot && shouldSaveSnapshot) {
                const result = await invoke<SaveSnapshotResult>(
                    "save_battery_snapshot",
                    {
                        snapshot,
                        options: {
                            onlySaveWhenChanged:
                                preferences.onlySaveWhenChanged,
                            minHoursBetweenSnapshots:
                                preferences.minHoursBetweenSnapshots,
                        } satisfies SaveSnapshotOptions,
                    }
                );

                setLastSnapshotMessage(formatSnapshotSaveReason(result.reason));
            }

            await refreshHistory();
        } catch (err) {
            console.error(err);
            setData(null);

            if (!silent) {
                setError(err instanceof Error ? err.message : String(err));
            }
        } finally {
            setIsLoading(false);
        }
    }

    async function handleResetAllData() {
        const confirmed = window.confirm(
            "Delete all saved battery history on this device? This cannot be undone."
        );

        if (!confirmed) return;

        setSettingsMessage(null);
        setIsResettingData(true);

        try {
            await invoke("clear_battery_history");
            setHistory([]);
            setLastSnapshotMessage(null);
            setSettingsMessage("Saved tracking data deleted.");
        } catch (err) {
            console.error(err);
            setSettingsMessage(
                err instanceof Error ? err.message : "Failed to delete data."
            );
        } finally {
            setIsResettingData(false);
        }
    }

    function handleExportRawData() {
        const filename = `battery-history-${formatDateForFilename()}.json`;
        downloadTextFile(
            filename,
            JSON.stringify(history, null, 2),
            "application/json;charset=utf-8"
        );
        setSettingsMessage("Raw history exported.");
    }

    function handleExportCsv() {
        const rows: string[][] = [
            [
                "capturedAt",
                "healthPercent",
                "wearPercent",
                "fullChargeCapacity_mWh",
                "designCapacity_mWh",
                "cycleCount",
            ],
            ...history.map((snapshot) => [
                snapshot.capturedAt,
                snapshot.healthPercent?.toFixed(2) ?? "",
                snapshot.wearPercent?.toFixed(2) ?? "",
                snapshot.fullChargeCapacity_mWh?.toString() ?? "",
                snapshot.designCapacity_mWh?.toString() ?? "",
                snapshot.cycleCount?.toString() ?? "",
            ]),
        ];

        const filename = `battery-history-${formatDateForFilename()}.csv`;
        downloadCsvFile(filename, rows);
        setSettingsMessage("CSV history exported.");
    }

    function handleExportSummary() {
        const battery = data?.batteries[0];
        const degradationTrend = calculateDegradationTrend(history);

        const lines = [
            "Battery Health Summary",
            "======================",
            "",
            `Generated: ${formatDateTime(new Date().toISOString(), {
                includeRelative: false,
            })}`,
            `Snapshots stored: ${history.length}`,
            `Tracking since: ${formatDateTime(
                degradationTrend.first?.capturedAt ?? null
            )}`,
            "",
            "Current battery",
            "---------------",
            `Battery health: ${formatPercent(
                calculateHealthPercent(
                    battery?.fullChargeCapacity_mWh,
                    battery?.designCapacity_mWh
                )
            )}`,
            `Battery wear: ${formatPercent(
                calculateWearPercent(
                    battery?.fullChargeCapacity_mWh,
                    battery?.designCapacity_mWh
                )
            )}`,
            `Full charge capacity: ${formatMWh(
                battery?.fullChargeCapacity_mWh
            )}`,
            `Design capacity: ${formatMWh(battery?.designCapacity_mWh)}`,
            `Cycle count: ${
                battery?.cycleCount !== undefined &&
                battery?.cycleCount !== null
                    ? battery.cycleCount
                    : "N/A"
            }`,
            "",
            "Tracking summary",
            "----------------",
            `Days tracked: ${
                degradationTrend.daysTracked !== null
                    ? Math.round(degradationTrend.daysTracked)
                    : "N/A"
            }`,
            `Health change since first snapshot: ${formatDelta(
                degradationTrend.healthDelta,
                "%"
            )}`,
            `Wear change since first snapshot: ${formatDelta(
                degradationTrend.wearDelta,
                "%"
            )}`,
            `Full charge change since first snapshot: ${formatDelta(
                degradationTrend.fullChargeDelta_mWh,
                " mWh",
                0
            )}`,
            `Health trend reliability: ${degradationTrend.reliabilityMessage}`,
            `Estimated health trend: ${formatTrendValue(
                degradationTrend.healthPercentPerMonth,
                "% / month"
            )}`,
            `Estimated capacity loss rate: ${formatTrendValue(
                degradationTrend.capacityLoss_mWhPerDay,
                " mWh / day",
                0
            )}`,
            "",
            "Background monitoring",
            "---------------------",
            `Launch on startup: ${
                desktopSettings.launchOnStartup ? "Enabled" : "Disabled"
            }`,
            `Hide to tray on close: ${
                desktopSettings.minimizeToTrayOnClose ? "Enabled" : "Disabled"
            }`,
            `Background checks: ${
                desktopSettings.backgroundChecksEnabled ? "Enabled" : "Disabled"
            }`,
            `Check frequency: every ${desktopSettings.backgroundCheckIntervalHours} hour(s)`,
            `Health alerts: ${
                desktopSettings.batteryHealthAlertsEnabled
                    ? `Enabled below ${desktopSettings.batteryHealthThresholdPercent}%`
                    : "Disabled"
            }`,
        ];

        const filename = `battery-summary-${formatDateForFilename()}.txt`;
        downloadTextFile(filename, lines.join("\n"));
        setSettingsMessage("Summary exported.");
    }

    useEffect(() => {
        if (hasAutoLoadedRef.current) return;
        hasAutoLoadedRef.current = true;

        void loadBatteryReport({
            silent: false,
            saveSnapshot: preferences.autoSaveOnLoad,
        });
        // intentionally only on first mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const battery = data?.batteries[0];
    const healthPercent = calculateHealthPercent(
        battery?.fullChargeCapacity_mWh,
        battery?.designCapacity_mWh
    );
    const wearPercent = calculateWearPercent(
        battery?.fullChargeCapacity_mWh,
        battery?.designCapacity_mWh
    );
    const healthLabel = getHealthLabel(healthPercent);
    const insights = data ? generateInsights(data) : [];

    const hasCapacityHistory = (data?.capacityHistory.length ?? 0) > 0;
    const hasRecentUsage = (data?.recentUsage.length ?? 0) > 0;
    const hasMetadata =
        !!data &&
        Boolean(
            data.metadata.computerName ||
                data.metadata.systemProductName ||
                data.metadata.bios ||
                data.metadata.osBuild ||
                data.metadata.reportTime
        );

    const comparison = useMemo(() => compareHistory(history), [history]);
    const degradationTrend = useMemo(
        () => calculateDegradationTrend(history),
        [history]
    );

    const trackingStartedAt = degradationTrend.first?.capturedAt ?? null;
    const lastSnapshotAt = degradationTrend.latest?.capturedAt ?? null;

    const hasPendingSettingsChanges = useMemo(() => {
        return (
            trackingDraft.autoSaveOnLoad !== preferences.autoSaveOnLoad ||
            trackingDraft.onlySaveWhenChanged !==
                preferences.onlySaveWhenChanged ||
            trackingDraft.minHoursBetweenSnapshots !==
                preferences.minHoursBetweenSnapshots ||
            desktopDraft.launchOnStartup !== desktopSettings.launchOnStartup ||
            desktopDraft.minimizeToTrayOnClose !==
                desktopSettings.minimizeToTrayOnClose ||
            desktopDraft.backgroundChecksEnabled !==
                desktopSettings.backgroundChecksEnabled ||
            desktopDraft.backgroundCheckIntervalHours !==
                desktopSettings.backgroundCheckIntervalHours ||
            desktopDraft.batteryHealthAlertsEnabled !==
                desktopSettings.batteryHealthAlertsEnabled ||
            desktopDraft.batteryHealthThresholdPercent !==
                desktopSettings.batteryHealthThresholdPercent
        );
    }, [desktopDraft, desktopSettings, preferences, trackingDraft]);

    return (
        <div className="app-shell">
            <main className="app-main">
                <header className="app-header">
                    <div className="app-header__content">
                        <h1 className="app-title">Battery Dashboard</h1>
                        <p className="app-subtitle">
                            View battery health, wear, capacity, and device
                            details from your Windows battery report.
                        </p>
                    </div>

                    <div className="app-header__actions">
                        {view === "dashboard" ? (
                            <>
                                <button
                                    className="app-button app-button--secondary"
                                    onClick={() => {
                                        setSettingsMessage(null);
                                        setSettingsSaveMessage(null);
                                        setView("settings");
                                    }}
                                >
                                    Settings
                                </button>
                                <button
                                    className="app-button"
                                    onClick={() =>
                                        void loadBatteryReport({
                                            saveSnapshot:
                                                preferences.autoSaveOnLoad,
                                        })
                                    }
                                    disabled={isLoading}
                                >
                                    {isLoading
                                        ? "Loading..."
                                        : "Load Battery Report"}
                                </button>
                            </>
                        ) : (
                            <button
                                className="app-button"
                                onClick={() => setView("dashboard")}
                            >
                                Back to Dashboard
                            </button>
                        )}
                    </div>
                </header>

                {view === "settings" ? (
                    <SettingsView
                        preferences={preferences}
                        setPreferences={setPreferences}
                        trackingDraft={trackingDraft}
                        updateTrackingDraft={updateTrackingDraft}
                        desktopSettings={desktopSettings}
                        desktopDraft={desktopDraft}
                        updateDesktopDraft={updateDesktopDraft}
                        history={history}
                        trackingStartedAt={trackingStartedAt}
                        lastSnapshotAt={lastSnapshotAt}
                        formatDateTime={formatDateTime}
                        handleExportSummary={handleExportSummary}
                        handleExportRawData={handleExportRawData}
                        handleExportCsv={handleExportCsv}
                        handleResetAllData={handleResetAllData}
                        isResettingData={isResettingData}
                        settingsMessage={settingsMessage}
                        settingsSaveMessage={settingsSaveMessage}
                        hasPendingSettingsChanges={hasPendingSettingsChanges}
                        isSavingManagedSettings={isSavingManagedSettings}
                        resetManagedSettingsDrafts={resetManagedSettingsDrafts}
                        handleSaveManagedSettings={handleSaveManagedSettings}
                        data={data}
                        battery={battery}
                        hasMetadata={hasMetadata}
                    />
                ) : (
                    <>
                        {error && (
                            <section
                                role="alert"
                                className="status-card status-card--error"
                            >
                                <h2 className="status-card__title">
                                    Could not load battery report
                                </h2>
                                <p className="status-card__text">{error}</p>
                            </section>
                        )}

                        {!data && !error && !isLoading && (
                            <section className="status-card">
                                <h2 className="status-card__title">
                                    No battery report loaded
                                </h2>
                                <p className="status-card__text">
                                    Click <strong>Load Battery Report</strong>{" "}
                                    to parse your Windows battery report and
                                    view battery health, capacity history,
                                    recent usage, and insights.
                                </p>
                            </section>
                        )}

                        {!data && isLoading && (
                            <section className="status-card">
                                <h2 className="status-card__title">
                                    Loading battery report
                                </h2>
                                <p className="status-card__text">
                                    Fetching and parsing the report now.
                                </p>
                            </section>
                        )}

                        {lastSnapshotMessage && (
                            <section className="status-card">
                                <h2 className="status-card__title">
                                    Snapshot status
                                </h2>
                                <p className="status-card__text">
                                    {lastSnapshotMessage}
                                </p>
                            </section>
                        )}

                        {data && (
                            <div className="dashboard-stack">
                                <SectionCard
                                    title="Since last scan"
                                    description="Changes compared with the previous saved battery snapshot."
                                >
                                    {comparison.previous &&
                                    comparison.latest ? (
                                        <div className="details-grid">
                                            <div>
                                                <InfoRow
                                                    label="Health change"
                                                    value={formatDelta(
                                                        comparison.healthDelta,
                                                        "%"
                                                    )}
                                                />
                                                <InfoRow
                                                    label="Wear change"
                                                    value={formatDelta(
                                                        comparison.wearDelta,
                                                        "%"
                                                    )}
                                                />
                                                <InfoRow
                                                    label="Health trend"
                                                    value={formatTrendValue(
                                                        degradationTrend.healthPercentPerMonth,
                                                        "% / month"
                                                    )}
                                                />
                                            </div>
                                            <div>
                                                <InfoRow
                                                    label="Full charge change"
                                                    value={formatDelta(
                                                        comparison.fullChargeDelta_mWh,
                                                        " mWh",
                                                        0
                                                    )}
                                                />
                                                <InfoRow
                                                    label="Cycle count change"
                                                    value={formatDelta(
                                                        comparison.cycleCountDelta,
                                                        "",
                                                        0
                                                    )}
                                                />
                                                <InfoRow
                                                    label="Capacity loss rate"
                                                    value={formatTrendValue(
                                                        degradationTrend.capacityLoss_mWhPerDay,
                                                        " mWh / day",
                                                        0
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="app-empty-state">
                                            Load at least two distinct reports
                                            on this device to see change over
                                            time.
                                        </p>
                                    )}
                                </SectionCard>

                                {battery ? (
                                    <section
                                        aria-label="Battery overview"
                                        className="stats-grid"
                                    >
                                        <StatCard
                                            label="Battery health"
                                            value={formatPercent(healthPercent)}
                                            helper={healthLabel}
                                        />
                                        <StatCard
                                            label="Battery wear"
                                            value={formatPercent(wearPercent)}
                                        />
                                        <StatCard
                                            label="Full charge capacity"
                                            value={formatMWh(
                                                battery.fullChargeCapacity_mWh
                                            )}
                                            helper={`Design: ${formatMWh(
                                                battery.designCapacity_mWh
                                            )}`}
                                        />
                                        <StatCard
                                            label="Health trend"
                                            value={formatTrendValue(
                                                degradationTrend.healthPercentPerMonth,
                                                "% / month"
                                            )}
                                            helper={
                                                degradationTrend.isReliable
                                                    ? `Based on ${degradationTrend.reliabilityMessage}`
                                                    : degradationTrend.reliabilityMessage
                                            }
                                        />
                                        <StatCard
                                            label="Cycle count"
                                            value={
                                                battery.cycleCount !==
                                                    undefined &&
                                                battery.cycleCount !== null
                                                    ? String(battery.cycleCount)
                                                    : "N/A"
                                            }
                                        />
                                    </section>
                                ) : (
                                    <section className="status-card status-card--warning">
                                        <h2 className="status-card__title">
                                            No battery found in this report
                                        </h2>
                                        <p className="status-card__text">
                                            The report loaded, but Windows did
                                            not include any installed battery
                                            entries.
                                        </p>
                                    </section>
                                )}

                                <SectionCard
                                    title="Insights"
                                    description="Plain-English analysis based on the current battery report and capacity history."
                                >
                                    {insights.length > 0 ? (
                                        <InsightsPanel insights={insights} />
                                    ) : (
                                        <p className="app-empty-state">
                                            No insights could be generated from
                                            this report.
                                        </p>
                                    )}
                                </SectionCard>

                                <SectionCard
                                    title="Capacity history"
                                    description="How full charge capacity compares with design capacity over time."
                                >
                                    {hasCapacityHistory ? (
                                        <CapacityHistoryChart
                                            data={data.capacityHistory}
                                        />
                                    ) : (
                                        <p className="app-empty-state">
                                            No capacity history was found in
                                            this report.
                                        </p>
                                    )}
                                </SectionCard>

                                <SectionCard
                                    title="Recent usage"
                                    description="Shows how your battery level changed during recent activity sessions. Each point represents a recorded moment when your device was active, suspended, or in connected standby."
                                >
                                    <div className="usage-note">
                                        <p className="usage-note__intro">
                                            This chart shows short-term battery
                                            behavior over recent sessions, not
                                            long-term health.
                                        </p>

                                        <ul className="usage-note__list">
                                            <li>
                                                <strong>
                                                    Battery level (%)
                                                </strong>{" "}
                                                shows how charge changes over
                                                time.
                                            </li>
                                            <li>
                                                <strong>Steep drops</strong>{" "}
                                                indicate heavy usage or
                                                power-intensive activity.
                                            </li>
                                            <li>
                                                <strong>Flat sections</strong>{" "}
                                                often mean the device was idle
                                                or in standby.
                                            </li>
                                            <li>
                                                <strong>
                                                    Charging periods
                                                </strong>{" "}
                                                can be seen where the line
                                                increases.
                                            </li>
                                        </ul>

                                        <p className="usage-note__footer">
                                            Data is based on recent system
                                            activity logs and may not be
                                            continuous.
                                        </p>
                                    </div>

                                    {hasRecentUsage ? (
                                        <RecentUsageChart
                                            data={data.recentUsage}
                                        />
                                    ) : (
                                        <p className="app-empty-state">
                                            No recent usage entries were found
                                            in this report.
                                        </p>
                                    )}
                                </SectionCard>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default App;
