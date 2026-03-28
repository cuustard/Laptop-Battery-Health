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

function formatRate(
    value: number | null,
    suffix: string,
    decimals = 2,
    invertSign = false
): string {
    if (value === null || !Number.isFinite(value)) {
        return "N/A";
    }

    const displayed = invertSign ? -value : value;
    return `${displayed.toFixed(decimals)}${suffix}`;
}

function getDegradationHelper(
    ratePerMonth: number | null,
    daysTracked: number | null,
    snapshotCount: number
): string {
    if (
        ratePerMonth === null ||
        !Number.isFinite(ratePerMonth) ||
        daysTracked === null
    ) {
        return "Need more history";
    }

    const magnitude = Math.abs(ratePerMonth);

    let label = "Stable";
    if (magnitude >= 1.5) {
        label = "Faster decline";
    } else if (magnitude >= 0.5) {
        label = "Moderate decline";
    } else if (magnitude > 0.05) {
        label = "Slow decline";
    }

    return `${label} • ${Math.round(
        daysTracked
    )} days • ${snapshotCount} snapshots`;
}

function App() {
    const [data, setData] = useState<BatteryReport | null>(null);
    const [history, setHistory] = useState<BatterySnapshot[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const hasAutoLoadedRef = useRef(false);

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

    async function loadBatteryReport(options?: { silent?: boolean }) {
        const silent = options?.silent ?? false;

        setError(null);
        setIsLoading(true);

        try {
            const html = await invoke<string>("get_battery_report_html");
            const parsed = parseBatteryReportHtml(html);

            setData(parsed);

            const snapshot = createSnapshot(parsed);
            if (snapshot) {
                await invoke<SaveSnapshotResult>("save_battery_snapshot", {
                    snapshot,
                });
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

    useEffect(() => {
        if (hasAutoLoadedRef.current) return;
        hasAutoLoadedRef.current = true;

        void loadBatteryReport({ silent: false });
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

                    <button
                        className="app-button"
                        onClick={() => void loadBatteryReport()}
                        disabled={isLoading}
                    >
                        {isLoading ? "Loading..." : "Load Battery Report"}
                    </button>
                </header>

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
                            Click <strong>Load Battery Report</strong> to parse
                            your Windows battery report and view battery health,
                            capacity history, recent usage, and insights.
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
                                    label="Degradation rate"
                                    value={formatRate(
                                        degradationTrend.healthPercentPerMonth,
                                        "% / month"
                                    )}
                                    helper={getDegradationHelper(
                                        degradationTrend.healthPercentPerMonth,
                                        degradationTrend.daysTracked,
                                        degradationTrend.snapshotCount
                                    )}
                                />
                                <StatCard
                                    label="Cycle count"
                                    value={
                                        battery.cycleCount !== undefined &&
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
                                    The report loaded, but Windows did not
                                    include any installed battery entries.
                                </p>
                            </section>
                        )}

                        <SectionCard
                            title="Since last scan"
                            description="Changes compared with the previous saved battery snapshot."
                        >
                            {comparison.previous && comparison.latest ? (
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
                                            value={formatRate(
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
                                            value={formatRate(
                                                degradationTrend.capacityLoss_mWhPerDay,
                                                " mWh / day",
                                                0
                                            )}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <p className="app-empty-state">
                                    Load at least two distinct reports on this
                                    device to see change over time.
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
                                    No insights could be generated from this
                                    report.
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
                                                data.metadata.computerName ??
                                                "N/A"
                                            }
                                        />
                                        <InfoRow
                                            label="System product"
                                            value={
                                                data.metadata
                                                    .systemProductName ?? "N/A"
                                            }
                                        />
                                        <InfoRow
                                            label="BIOS"
                                            value={data.metadata.bios ?? "N/A"}
                                        />
                                        <InfoRow
                                            label="OS build"
                                            value={
                                                data.metadata.osBuild ?? "N/A"
                                            }
                                        />
                                        <InfoRow
                                            label="Report time"
                                            value={
                                                data.metadata.reportTime ??
                                                "N/A"
                                            }
                                        />
                                    </>
                                ) : (
                                    <p className="app-empty-state">
                                        No system metadata was found in this
                                        report.
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
                                            value={
                                                battery.manufacturer ?? "N/A"
                                            }
                                        />
                                        <InfoRow
                                            label="Serial number"
                                            value={
                                                battery.serialNumber ?? "N/A"
                                            }
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
                                        No battery details were found in this
                                        report.
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
                                    No capacity history was found in this
                                    report.
                                </p>
                            )}
                        </SectionCard>

                        <SectionCard
                            title="Recent usage"
                            description="Shows how your battery level changed during recent activity sessions. Each point represents a recorded moment when your device was active, suspended, or in connected standby."
                        >
                            <div className="usage-note">
                                <p className="usage-note__intro">
                                    This chart shows short-term battery behavior
                                    over recent sessions, not long-term health.
                                </p>

                                <ul className="usage-note__list">
                                    <li>
                                        <strong>Battery level (%)</strong> shows
                                        how charge changes over time.
                                    </li>
                                    <li>
                                        <strong>Steep drops</strong> indicate
                                        heavy usage or power-intensive activity.
                                    </li>
                                    <li>
                                        <strong>Flat sections</strong> often
                                        mean the device was idle or in standby.
                                    </li>
                                    <li>
                                        <strong>Charging periods</strong> can be
                                        seen where the line increases.
                                    </li>
                                </ul>

                                <p className="usage-note__footer">
                                    Data is based on recent system activity logs
                                    and may not be continuous.
                                </p>
                            </div>

                            {hasRecentUsage ? (
                                <RecentUsageChart data={data.recentUsage} />
                            ) : (
                                <p className="app-empty-state">
                                    No recent usage entries were found in this
                                    report.
                                </p>
                            )}
                        </SectionCard>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
