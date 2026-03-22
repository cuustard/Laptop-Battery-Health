import { useState } from "react";

// Types
import type { BatteryReport } from "./types/battery";

// Utilities
import { parseBatteryReportHtml } from "./lib/parseBatteryReport";
import {
    calculateHealthPercent,
    calculateWearPercent,
    getHealthLabel,
} from "./lib/batteryMetrics";
import { generateInsights } from "./lib/batteryInsights";
import { formatMWh, formatPercent } from "./lib/formatters";

// Components
import { StatCard } from "./components/ui/StatCard";
import { SectionCard } from "./components/ui/SectionCard";
import { InfoRow } from "./components/ui/InfoRow";
import { CapacityHistoryChart } from "./components/charts/CapacityHistoryChart";
import { RecentUsageChart } from "./components/charts/RecentUsageChart";
import { InsightsPanel } from "./components/insights/InsightsPanel";

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
        <div
            style={{
                minHeight: "100vh",
                background: "#f8fafc",
                color: "#101828",
                fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
        >
            <main
                style={{
                    maxWidth: 1120,
                    margin: "0 auto",
                    padding: "40px 20px 56px",
                }}
            >
                <header
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 16,
                        flexWrap: "wrap",
                        marginBottom: 28,
                    }}
                >
                    <div>
                        <h1
                            style={{
                                margin: 0,
                                fontSize: 40,
                                lineHeight: 1.05,
                                fontWeight: 800,
                                letterSpacing: "-0.04em",
                                color: "#101828",
                            }}
                        >
                            Battery Dashboard
                        </h1>
                        <p
                            style={{
                                margin: "10px 0 0",
                                fontSize: 16,
                                lineHeight: 1.6,
                                color: "#475467",
                                maxWidth: 700,
                            }}
                        >
                            View battery health, wear, capacity, and device
                            details from your Windows battery report.
                        </p>
                    </div>

                    <button
                        onClick={loadTest}
                        style={{
                            border: "none",
                            borderRadius: 12,
                            background: "#111827",
                            color: "#ffffff",
                            padding: "12px 16px",
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: "pointer",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                        }}
                    >
                        Load Battery Report
                    </button>
                </header>

                {error && (
                    <div
                        role="alert"
                        style={{
                            marginBottom: 20,
                            padding: 14,
                            borderRadius: 12,
                            background: "#fef3f2",
                            border: "1px solid #fecdca",
                            color: "#b42318",
                            fontSize: 14,
                            fontWeight: 600,
                        }}
                    >
                        {error}
                    </div>
                )}

                {data && (
                    <>
                        <section
                            aria-label="Battery overview"
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(220px, 1fr))",
                                gap: 16,
                                marginBottom: 24,
                            }}
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

                        <section style={{ marginBottom: 24 }}>
                            <SectionCard
                                title="Insights"
                                description="Plain-English analysis based on the current battery report and capacity history."
                            >
                                <InsightsPanel insights={insights} />
                            </SectionCard>
                        </section>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 20,
                            }}
                        >
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
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 15,
                                            color: "#475467",
                                        }}
                                    >
                                        No battery detected in this report.
                                    </p>
                                )}
                            </SectionCard>
                        </div>
                        <div style={{ marginTop: 20 }}>
                            <SectionCard
                                title="Capacity history"
                                description="How full charge capacity compares with design capacity over time."
                            >
                                <CapacityHistoryChart
                                    data={data.capacityHistory}
                                />
                            </SectionCard>
                        </div>
                        <section style={{ marginTop: 20 }}>
                            <SectionCard
                                title="Recent usage"
                                description="Shows how your battery level changed during recent activity sessions. Each point represents a recorded moment when your device was active, suspended, or in connected standby."
                            >
                                <div
                                    style={{
                                        marginBottom: 20,
                                        padding: 16,
                                        background: "#f8fafc",
                                        border: "1px solid #eaecf0",
                                        borderRadius: 14,
                                        textAlign: "left",
                                    }}
                                >
                                    <p
                                        style={{
                                            margin: "0 0 12px",
                                            fontSize: 14,
                                            color: "#475467",
                                            lineHeight: 1.7,
                                        }}
                                    >
                                        This chart shows short-term battery
                                        behavior over recent sessions, not
                                        long-term health.
                                    </p>

                                    <ul
                                        style={{
                                            margin: 0,
                                            paddingLeft: 20,
                                            color: "#475467",
                                            lineHeight: 1.7,
                                        }}
                                    >
                                        <li style={{ marginBottom: 8 }}>
                                            <strong
                                                style={{ color: "#101828" }}
                                            >
                                                Battery level (%)
                                            </strong>{" "}
                                            shows how charge changes over time.
                                        </li>
                                        <li style={{ marginBottom: 8 }}>
                                            <strong
                                                style={{ color: "#101828" }}
                                            >
                                                Steep drops
                                            </strong>{" "}
                                            indicate heavy usage or
                                            power-intensive activity.
                                        </li>
                                        <li style={{ marginBottom: 8 }}>
                                            <strong
                                                style={{ color: "#101828" }}
                                            >
                                                Flat sections
                                            </strong>{" "}
                                            often mean the device was idle or in
                                            standby.
                                        </li>
                                        <li>
                                            <strong
                                                style={{ color: "#101828" }}
                                            >
                                                Charging periods
                                            </strong>{" "}
                                            can be seen where the line
                                            increases.
                                        </li>
                                    </ul>

                                    <p
                                        style={{
                                            margin: "12px 0 0",
                                            fontSize: 13,
                                            color: "#667085",
                                            lineHeight: 1.6,
                                        }}
                                    >
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
