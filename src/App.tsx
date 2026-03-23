import { useState } from "react";
import "./App.css";

import type { BatteryReport } from "./types/battery";

import { parseBatteryReportHtml } from "./lib/parseBatteryReport";
import {
    calculateHealthPercent,
    calculateWearPercent,
    getHealthLabel,
} from "./lib/batteryMetrics";
import { generateInsights } from "./lib/batteryInsights";
import { formatMWh, formatPercent } from "./lib/formatters";

import { StatCard } from "../src/components/ui/statCard";
import { SectionCard } from "../src/components/ui/SectionCard";
import { InfoRow } from "../src/components/ui/InfoRow";
import { CapacityHistoryChart } from "../src/components/charts/CapacityHistoryChart";
import { RecentUsageChart } from "../src/components/charts/RecentUsageChart";
import { InsightsPanel } from "../src/components/insights/InsightsPanel";

function App() {
    const [data, setData] = useState<BatteryReport | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function loadTest() {
        setError(null);

        try {
            const res = await fetch("/battery-report.html");
            if (!res.ok) {
                throw new Error(
                    `Failed to load report: ${res.status} ${res.statusText}`
                );
            }

            const html = await res.text();
            const parsed = parseBatteryReportHtml(html);

            console.log("Parsed data:", parsed);
            setData(parsed);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Unknown error");
        }
    }

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

                    <button className="app-button" onClick={loadTest}>
                        Load Battery Report
                    </button>
                </header>

                {error && (
                    <div role="alert" className="app-alert">
                        {error}
                    </div>
                )}

                {data && (
                    <>
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
                                    battery?.fullChargeCapacity_mWh
                                )}
                                helper={`Design: ${formatMWh(
                                    battery?.designCapacity_mWh
                                )}`}
                            />
                            <StatCard
                                label="Cycle count"
                                value={
                                    battery?.cycleCount !== undefined &&
                                    battery?.cycleCount !== null
                                        ? String(battery.cycleCount)
                                        : "N/A"
                                }
                            />
                        </section>

                        <section className="section-spacing">
                            <SectionCard
                                title="Insights"
                                description="Plain-English analysis based on the current battery report and capacity history."
                            >
                                <InsightsPanel insights={insights} />
                            </SectionCard>
                        </section>

                        <div className="details-grid">
                            <SectionCard
                                title="System information"
                                description="Basic metadata extracted from the battery report."
                            >
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
                                    value={data.metadata.reportTime ?? "N/A"}
                                />
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
                                        No battery detected in this report.
                                    </p>
                                )}
                            </SectionCard>
                        </div>

                        <div className="section-spacing">
                            <SectionCard
                                title="Capacity history"
                                description="How full charge capacity compares with design capacity over time."
                            >
                                <CapacityHistoryChart
                                    data={data.capacityHistory}
                                />
                            </SectionCard>
                        </div>

                        <section className="section-spacing">
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
                                            <strong>Battery level (%)</strong>{" "}
                                            shows how charge changes over time.
                                        </li>
                                        <li>
                                            <strong>Steep drops</strong>{" "}
                                            indicate heavy usage or
                                            power-intensive activity.
                                        </li>
                                        <li>
                                            <strong>Flat sections</strong> often
                                            mean the device was idle or in
                                            standby.
                                        </li>
                                        <li>
                                            <strong>Charging periods</strong>{" "}
                                            can be seen where the line
                                            increases.
                                        </li>
                                    </ul>

                                    <p className="usage-note__footer">
                                        Data is based on recent system activity
                                        logs and may not be continuous.
                                    </p>
                                </div>

                                <RecentUsageChart data={data.recentUsage} />
                            </SectionCard>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}

export default App;
