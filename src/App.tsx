import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import type { BatteryReport } from "./types/battery";
import type { BatterySnapshot } from "./types/history";

import { parseBatteryReportHtml } from "./lib/parseBatteryReport";
import {
    calculateHealthPercent,
    calculateWearPercent,
    getHealthLabel,
} from "./lib/batteryMetrics";
import { generateInsights } from "./lib/batteryInsights";
import { formatMWh, formatPercent } from "./lib/formatters";
import {
    MIN_TREND_DAYS,
    MIN_TREND_SNAPSHOTS,
    calculateDegradationTrend,
    compareHistory,
    createSnapshot,
    formatDelta,
} from "./lib/history";

import { StatCard } from "./components/ui/StatCard";
import { SectionCard } from "./components/ui/SectionCard";
import { InfoRow } from "./components/ui/InfoRow";
import { CapacityHistoryChart } from "./components/charts/CapacityHistoryChart";
import { RecentUsageChart } from "./components/charts/RecentUsageChart";
import { InsightsPanel } from "./components/insights/InsightsPanel";
import { invoke } from "@tauri-apps/api/core";

type SaveSnapshotResult = {
    saved: boolean;
    reason: string;
    snapshotCount: number;
};

type SaveSnapshotOptions = {
    onlySaveWhenChanged: boolean;
    minHoursBetweenSnapshots: number;
};

type ViewMode = "dashboard" | "settings";
type ThemeMode = "light" | "dark" | "system";

type AppPreferences = {
    theme: ThemeMode;
    highContrast: boolean;
    largeText: boolean;
    colorBlindFriendly: boolean;
    autoSaveOnLoad: boolean;
    onlySaveWhenChanged: boolean;
    minHoursBetweenSnapshots: number;
};

const PREFERENCES_STORAGE_KEY = "battery-dashboard-preferences";

const DEFAULT_PREFERENCES: AppPreferences = {
    theme: "system",
    highContrast: false,
    largeText: false,
    colorBlindFriendly: false,
    autoSaveOnLoad: true,
    onlySaveWhenChanged: true,
    minHoursBetweenSnapshots: 24,
};

function loadPreferences(): AppPreferences {
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

function savePreferences(preferences: AppPreferences) {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

function downloadTextFile(
    filename: string,
    content: string,
    mimeType = "text/plain;charset=utf-8"
) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function formatDateForFilename(date = new Date()): string {
    return date.toISOString().replace(/[:.]/g, "-");
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return "N/A";

    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString();
}

function formatTrendValue(
    value: number | null,
    suffix: string,
    decimals = 2,
    invertSign = false
): string {
    if (value === null || !Number.isFinite(value)) {
        return "Not enough history";
    }

    const displayed = invertSign ? -value : value;
    return `${displayed.toFixed(decimals)}${suffix}`;
}

function formatSnapshotSaveReason(reason: string): string {
    switch (reason) {
        case "saved":
            return "Snapshot saved.";
        case "duplicate_snapshot":
            return "Snapshot skipped because nothing changed.";
        case "min_interval_not_reached":
            return "Snapshot skipped because the minimum save interval has not passed yet.";
        case "history_empty":
            return "No prior history found. First snapshot saved.";
        default:
            return "Snapshot check completed.";
    }
}

function downloadCsvFile(filename: string, rows: string[][]) {
    const escapeCell = (value: string) => {
        const safe = value ?? "";
        if (
            safe.includes(",") ||
            safe.includes('"') ||
            safe.includes("\n") ||
            safe.includes("\r")
        ) {
            return `"${safe.replace(/"/g, '""')}"`;
        }
        return safe;
    };

    const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
    downloadTextFile(filename, csv, "text/csv;charset=utf-8");
}

function App() {
    const [view, setView] = useState<ViewMode>("dashboard");
    const [preferences, setPreferences] =
        useState<AppPreferences>(loadPreferences);
    const [data, setData] = useState<BatteryReport | null>(null);
    const [history, setHistory] = useState<BatterySnapshot[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isResettingData, setIsResettingData] = useState(false);
    const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
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
            `Generated: ${new Date().toLocaleString()}`,
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
                    <div className="settings-stack">
                        <SectionCard
                            title="Appearance"
                            description="Control the app theme and how the interface looks."
                        >
                            <div className="settings-group">
                                <label
                                    className="settings-field"
                                    htmlFor="theme-select"
                                >
                                    <span className="settings-field__label">
                                        Theme
                                    </span>
                                    <select
                                        id="theme-select"
                                        className="settings-select"
                                        value={preferences.theme}
                                        onChange={(event) =>
                                            setPreferences((current) => ({
                                                ...current,
                                                theme: event.target
                                                    .value as ThemeMode,
                                            }))
                                        }
                                    >
                                        <option value="system">System</option>
                                        <option value="light">Light</option>
                                        <option value="dark">Dark</option>
                                    </select>
                                </label>
                            </div>
                        </SectionCard>

                        <SectionCard
                            title="Accessibility"
                            description="Adjust readability and colour accessibility."
                        >
                            <div className="settings-group">
                                <label className="settings-toggle">
                                    <input
                                        type="checkbox"
                                        checked={preferences.highContrast}
                                        onChange={(event) =>
                                            setPreferences((current) => ({
                                                ...current,
                                                highContrast:
                                                    event.target.checked,
                                            }))
                                        }
                                    />
                                    <span>
                                        <strong>High contrast mode</strong>
                                        <small>
                                            Increase contrast for text, cards,
                                            and controls.
                                        </small>
                                    </span>
                                </label>

                                <label className="settings-toggle">
                                    <input
                                        type="checkbox"
                                        checked={preferences.largeText}
                                        onChange={(event) =>
                                            setPreferences((current) => ({
                                                ...current,
                                                largeText: event.target.checked,
                                            }))
                                        }
                                    />
                                    <span>
                                        <strong>Larger text</strong>
                                        <small>
                                            Increase font sizes across the app.
                                        </small>
                                    </span>
                                </label>

                                <label className="settings-toggle">
                                    <input
                                        type="checkbox"
                                        checked={preferences.colorBlindFriendly}
                                        onChange={(event) =>
                                            setPreferences((current) => ({
                                                ...current,
                                                colorBlindFriendly:
                                                    event.target.checked,
                                            }))
                                        }
                                    />
                                    <span>
                                        <strong>
                                            Colour-blind friendly palette
                                        </strong>
                                        <small>
                                            Use safer accent colours for charts
                                            and highlights.
                                        </small>
                                    </span>
                                </label>
                            </div>
                        </SectionCard>

                        <SectionCard
                            title="Tracking"
                            description="Control when new battery snapshots are saved."
                        >
                            <div className="settings-group">
                                <label className="settings-toggle">
                                    <input
                                        type="checkbox"
                                        checked={preferences.autoSaveOnLoad}
                                        onChange={(event) =>
                                            setPreferences((current) => ({
                                                ...current,
                                                autoSaveOnLoad:
                                                    event.target.checked,
                                            }))
                                        }
                                    />
                                    <span>
                                        <strong>
                                            Auto-save snapshot on load
                                        </strong>
                                        <small>
                                            Save a snapshot automatically when a
                                            report is loaded.
                                        </small>
                                    </span>
                                </label>

                                <label className="settings-toggle">
                                    <input
                                        type="checkbox"
                                        checked={
                                            preferences.onlySaveWhenChanged
                                        }
                                        onChange={(event) =>
                                            setPreferences((current) => ({
                                                ...current,
                                                onlySaveWhenChanged:
                                                    event.target.checked,
                                            }))
                                        }
                                    />
                                    <span>
                                        <strong>
                                            Only save when values change
                                        </strong>
                                        <small>
                                            Skip saving when the latest snapshot
                                            is effectively identical.
                                        </small>
                                    </span>
                                </label>

                                <label
                                    className="settings-field"
                                    htmlFor="interval-select"
                                >
                                    <span className="settings-field__label">
                                        Minimum time between saved snapshots
                                    </span>
                                    <select
                                        id="interval-select"
                                        className="settings-select"
                                        value={String(
                                            preferences.minHoursBetweenSnapshots
                                        )}
                                        onChange={(event) =>
                                            setPreferences((current) => ({
                                                ...current,
                                                minHoursBetweenSnapshots:
                                                    Number(event.target.value),
                                            }))
                                        }
                                    >
                                        <option value="0">No minimum</option>
                                        <option value="6">6 hours</option>
                                        <option value="12">12 hours</option>
                                        <option value="24">24 hours</option>
                                        <option value="48">48 hours</option>
                                        <option value="72">72 hours</option>
                                    </select>
                                </label>
                            </div>
                        </SectionCard>

                        <SectionCard
                            title="Data & storage"
                            description="Export battery data or remove saved history from this device."
                        >
                            <div className="settings-stats">
                                <InfoRow
                                    label="Snapshots stored"
                                    value={String(history.length)}
                                />
                                <InfoRow
                                    label="Tracking since"
                                    value={formatDateTime(trackingStartedAt)}
                                />
                                <InfoRow
                                    label="Last snapshot"
                                    value={formatDateTime(lastSnapshotAt)}
                                />
                            </div>

                            <div className="settings-actions">
                                <button
                                    className="app-button"
                                    onClick={handleExportSummary}
                                >
                                    Export summary
                                </button>
                                <button
                                    className="app-button app-button--secondary"
                                    onClick={handleExportRawData}
                                >
                                    Export raw JSON
                                </button>
                                <button
                                    className="app-button app-button--secondary"
                                    onClick={handleExportCsv}
                                >
                                    Export CSV
                                </button>
                                <button
                                    className="app-button app-button--danger"
                                    onClick={() => void handleResetAllData()}
                                    disabled={isResettingData}
                                >
                                    {isResettingData
                                        ? "Deleting..."
                                        : "Delete all saved data"}
                                </button>
                            </div>

                            {settingsMessage && (
                                <p className="settings-message">
                                    {settingsMessage}
                                </p>
                            )}
                        </SectionCard>

                        <SectionCard
                            title="About"
                            description="Basic app information."
                        >
                            <div className="settings-about">
                                <InfoRow
                                    label="App"
                                    value="Battery Dashboard"
                                />
                                <InfoRow
                                    label="Theme mode"
                                    value={preferences.theme}
                                />
                                <InfoRow
                                    label="Trend reliability rule"
                                    value={`${MIN_TREND_SNAPSHOTS}+ snapshots and ${MIN_TREND_DAYS}+ days`}
                                />
                                <InfoRow
                                    label="Accessibility"
                                    value={
                                        [
                                            preferences.highContrast
                                                ? "High contrast"
                                                : null,
                                            preferences.largeText
                                                ? "Large text"
                                                : null,
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
                    </div>
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

                                <div className="details-grid">
                                    <SectionCard
                                        title="System information"
                                        description="Basic metadata extracted from the battery report."
                                    >
                                        {hasMetadata ? (
                                            <>
                                                <InfoRow
                                                    label="Computer"
                                                    value={
                                                        data.metadata
                                                            .computerName ??
                                                        "N/A"
                                                    }
                                                />
                                                <InfoRow
                                                    label="System product"
                                                    value={
                                                        data.metadata
                                                            .systemProductName ??
                                                        "N/A"
                                                    }
                                                />
                                                <InfoRow
                                                    label="BIOS"
                                                    value={
                                                        data.metadata.bios ??
                                                        "N/A"
                                                    }
                                                />
                                                <InfoRow
                                                    label="OS build"
                                                    value={
                                                        data.metadata.osBuild ??
                                                        "N/A"
                                                    }
                                                />
                                                <InfoRow
                                                    label="Report time"
                                                    value={
                                                        data.metadata
                                                            .reportTime ?? "N/A"
                                                    }
                                                />
                                            </>
                                        ) : (
                                            <p className="app-empty-state">
                                                No system metadata was found in
                                                this report.
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
                                                    value={
                                                        battery.name ?? "N/A"
                                                    }
                                                />
                                                <InfoRow
                                                    label="Manufacturer"
                                                    value={
                                                        battery.manufacturer ??
                                                        "N/A"
                                                    }
                                                />
                                                <InfoRow
                                                    label="Serial number"
                                                    value={
                                                        battery.serialNumber ??
                                                        "N/A"
                                                    }
                                                />
                                                <InfoRow
                                                    label="Chemistry"
                                                    value={
                                                        battery.chemistry ??
                                                        "N/A"
                                                    }
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
                                                No battery details were found in
                                                this report.
                                            </p>
                                        )}
                                    </SectionCard>
                                </div>

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
