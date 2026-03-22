import { useState } from "react";
import { parseBatteryReportHtml } from "./lib/parseBatteryReport";
import type { BatteryReport, Insight, RecentUsageEntry } from "./types/battery";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

function RecentUsageChart({ data }: { data: RecentUsageEntry[] }) {
    const chartData = getRecentUsageChartData(data);

    if (chartData.length === 0) {
        return (
            <p style={{ margin: 0, fontSize: 15, color: "#475467" }}>
                No recent usage data found in this report.
            </p>
        );
    }

    const values = chartData
        .map((entry) => entry.capacityPercent)
        .filter((value): value is number => typeof value === "number");

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const padding = Math.max(2, Math.ceil((maxValue - minValue) * 0.15));

    return (
        <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
                <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 16, left: 8, bottom: 48 }}
                >
                    <CartesianGrid stroke="#eaecf0" />
                    <XAxis
                        dataKey="shortTimestamp"
                        interval="preserveStartEnd"
                        minTickGap={48}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 12, fill: "#475467" }}
                    />
                    <YAxis
                        domain={[
                            Math.max(0, Math.floor(minValue - padding)),
                            Math.min(110, Math.ceil(maxValue + padding)),
                        ]}
                        tickFormatter={(value: number) =>
                            `${Math.round(value)}%`
                        }
                        tick={{ fontSize: 12, fill: "#475467" }}
                        width={70}
                        allowDecimals={false}
                    />
                    <Tooltip
                        labelFormatter={(label) => `Time: ${String(label)}`}
                        formatter={(value, name, item) => {
                            if (typeof value !== "number") {
                                return [String(value ?? "N/A"), String(name)];
                            }

                            const payload = item?.payload as
                                | {
                                      remainingCapacity_mWh?: number;
                                      state?: string;
                                      source?: string;
                                  }
                                | undefined;

                            const lines = [`${value.toFixed(1)}%`];

                            if (
                                typeof payload?.remainingCapacity_mWh ===
                                "number"
                            ) {
                                lines.push(
                                    `${payload.remainingCapacity_mWh.toLocaleString()} mWh`
                                );
                            }

                            if (payload?.state) {
                                lines.push(`State: ${payload.state}`);
                            }

                            if (payload?.source) {
                                lines.push(`Source: ${payload.source}`);
                            }

                            return [lines.join(" • "), "Battery level"];
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="capacityPercent"
                        name="Battery level"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

function formatRecentUsageDate(timestamp: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;

    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getRecentUsageChartData(entries: RecentUsageEntry[]) {
    return entries
        .filter(
            (entry) =>
                typeof entry.capacityPercent === "number" &&
                Number.isFinite(entry.capacityPercent)
        )
        .map((entry) => ({
            ...entry,
            shortTimestamp: formatRecentUsageDate(entry.timestamp),
        }));
}

function getCapacityTrend(
    history: { fullChargeCapacity_mWh?: number }[]
): number | null {
    const valid = history
        .map((entry) => entry.fullChargeCapacity_mWh)
        .filter((value): value is number => typeof value === "number");

    if (valid.length < 2) return null;

    const first = valid[0];
    const last = valid[valid.length - 1];

    if (first <= 0) return null;

    return ((last - first) / first) * 100;
}

function generateInsights(data: BatteryReport): Insight[] {
    const battery = data.batteries[0];
    const insights: Insight[] = [];

    if (!battery) {
        insights.push({
            title: "No battery detected",
            description: "This report does not include an installed battery.",
            severity: "warning",
        });
        return insights;
    }

    const health = calculateHealthPercent(
        battery.fullChargeCapacity_mWh,
        battery.designCapacity_mWh
    );

    const wear = calculateWearPercent(
        battery.fullChargeCapacity_mWh,
        battery.designCapacity_mWh
    );

    const trend = getCapacityTrend(data.capacityHistory);

    if (health !== null) {
        if (health >= 90) {
            insights.push({
                title: "Battery health is strong",
                description: `Current battery health is ${health.toFixed(
                    1
                )}%, which is in an excellent range.`,
                severity: "good",
            });
        } else if (health >= 80) {
            insights.push({
                title: "Battery health is still good",
                description: `Current battery health is ${health.toFixed(
                    1
                )}%. Some wear is present, but this is still a healthy range.`,
                severity: "neutral",
            });
        } else {
            insights.push({
                title: "Battery health is reduced",
                description: `Current battery health is ${health.toFixed(
                    1
                )}%, which suggests noticeable degradation.`,
                severity: "warning",
            });
        }
    }

    if (wear !== null) {
        insights.push({
            title: "Battery wear estimate",
            description: `The battery has lost about ${wear.toFixed(
                1
            )}% of its original design capacity.`,
            severity: wear >= 20 ? "warning" : "neutral",
        });
    }

    if (battery.cycleCount !== undefined && battery.cycleCount !== null) {
        insights.push({
            title: "Cycle count recorded",
            description: `This battery has completed ${battery.cycleCount} charge cycles.`,
            severity: battery.cycleCount >= 500 ? "warning" : "neutral",
        });
    }

    if (trend !== null) {
        if (trend < -5) {
            insights.push({
                title: "Capacity trend is declining",
                description: `Full charge capacity changed by ${trend.toFixed(
                    1
                )}% across the recorded history.`,
                severity: "warning",
            });
        } else if (trend < 0) {
            insights.push({
                title: "Capacity trend shows mild decline",
                description: `Full charge capacity changed by ${trend.toFixed(
                    1
                )}% across the recorded history.`,
                severity: "neutral",
            });
        } else {
            insights.push({
                title: "Capacity trend looks stable",
                description: `Full charge capacity changed by ${trend.toFixed(
                    1
                )}% across the recorded history.`,
                severity: "good",
            });
        }
    }

    return insights;
}

function getInsightColors(severity: Insight["severity"]) {
    switch (severity) {
        case "good":
            return {
                background: "#ecfdf3",
                border: "#abefc6",
                title: "#067647",
                text: "#085d3a",
            };
        case "warning":
            return {
                background: "#fffaeb",
                border: "#fedf89",
                title: "#b54708",
                text: "#93370d",
            };
        default:
            return {
                background: "#f8f9fc",
                border: "#d0d5dd",
                title: "#344054",
                text: "#475467",
            };
    }
}

function InsightsPanel({ insights }: { insights: Insight[] }) {
    return (
        <div
            style={{
                display: "grid",
                gap: 12,
            }}
        >
            {insights.map((insight, index) => {
                const colors = getInsightColors(insight.severity);

                return (
                    <div
                        key={`${insight.title}-${index}`}
                        style={{
                            background: colors.background,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 14,
                            padding: 16,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: colors.title,
                                marginBottom: 6,
                            }}
                        >
                            {insight.title}
                        </div>
                        <div
                            style={{
                                fontSize: 14,
                                lineHeight: 1.6,
                                color: colors.text,
                            }}
                        >
                            {insight.description}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

type ChartMode = "health" | "capacity-zoomed" | "capacity-full";

function formatChartDate(dateString: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function CapacityHistoryChart({
    data,
}: {
    data: {
        date: string;
        fullChargeCapacity_mWh?: number;
        designCapacity_mWh?: number;
    }[];
}) {
    const [mode, setMode] = useState<ChartMode>("health");

    if (data.length === 0) {
        return (
            <p style={{ margin: 0, fontSize: 15, color: "#475467" }}>
                No capacity history found in this report.
            </p>
        );
    }

    const baseData = data.map((entry) => {
        const full =
            typeof entry.fullChargeCapacity_mWh === "number"
                ? entry.fullChargeCapacity_mWh
                : null;

        const design =
            typeof entry.designCapacity_mWh === "number"
                ? entry.designCapacity_mWh
                : null;

        const healthPercent =
            full !== null && design !== null && design > 0
                ? (full / design) * 100
                : null;

        return {
            date: entry.date,
            shortDate: formatChartDate(entry.date),
            fullChargeCapacity_mWh: full,
            designCapacity_mWh: design,
            healthPercent,
        };
    });

    const healthData = baseData.filter(
        (entry) =>
            typeof entry.healthPercent === "number" &&
            Number.isFinite(entry.healthPercent)
    );

    const capacityData = baseData.filter(
        (entry) =>
            typeof entry.fullChargeCapacity_mWh === "number" &&
            Number.isFinite(entry.fullChargeCapacity_mWh)
    );

    if (mode === "health" && healthData.length === 0) {
        return (
            <div>
                <ChartModeButtons mode={mode} setMode={setMode} />
                <p style={{ margin: 0, fontSize: 15, color: "#475467" }}>
                    No valid battery health history found in this report.
                </p>
            </div>
        );
    }

    if (
        (mode === "capacity-zoomed" || mode === "capacity-full") &&
        capacityData.length === 0
    ) {
        return (
            <div>
                <ChartModeButtons mode={mode} setMode={setMode} />
                <p style={{ margin: 0, fontSize: 15, color: "#475467" }}>
                    No valid capacity history found in this report.
                </p>
            </div>
        );
    }

    const capacityValues = capacityData.flatMap((entry) =>
        [entry.fullChargeCapacity_mWh, entry.designCapacity_mWh].filter(
            (value): value is number =>
                typeof value === "number" && Number.isFinite(value)
        )
    );

    const minCapacity = Math.min(...capacityValues);
    const maxCapacity = Math.max(...capacityValues);
    const capacityPadding = Math.max(
        1000,
        Math.round((maxCapacity - minCapacity) * 0.15)
    );

    const healthValues = healthData
        .map((entry) => entry.healthPercent)
        .filter(
            (value): value is number =>
                typeof value === "number" && Number.isFinite(value)
        );

    const minHealth = Math.min(...healthValues);
    const maxHealth = Math.max(...healthValues);
    const healthPadding = Math.max(1, Math.ceil((maxHealth - minHealth) * 0.2));

    const currentData = mode === "health" ? healthData : capacityData;

    return (
        <div>
            <ChartModeButtons mode={mode} setMode={setMode} />

            <div
                style={{
                    marginBottom: 12,
                    fontSize: 14,
                    color: "#667085",
                }}
            >
                {mode === "health" &&
                    "Shows battery health as a percentage of design capacity. Best for understanding actual battery condition."}
                {mode === "capacity-zoomed" &&
                    "Scaled to the data range so small changes are easier to see."}
                {mode === "capacity-full" &&
                    "Uses a full scale from zero to avoid exaggerating small changes."}
            </div>

            <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                    <LineChart
                        key={mode}
                        data={currentData}
                        margin={{ top: 8, right: 16, left: 8, bottom: 48 }}
                    >
                        <CartesianGrid stroke="#eaecf0" />
                        <XAxis
                            dataKey="shortDate"
                            interval="preserveStartEnd"
                            minTickGap={48}
                            angle={-30}
                            textAnchor="end"
                            height={60}
                            tick={{ fontSize: 12, fill: "#475467" }}
                        />

                        {mode === "health" ? (
                            <YAxis
                                domain={[
                                    Math.max(
                                        0,
                                        Math.floor(minHealth - healthPadding)
                                    ),
                                    Math.min(
                                        100,
                                        Math.ceil(maxHealth + healthPadding)
                                    ),
                                ]}
                                tickFormatter={(value: number) =>
                                    `${value.toFixed(0)}%`
                                }
                                tick={{ fontSize: 12, fill: "#475467" }}
                                width={80}
                                allowDecimals={false}
                            />
                        ) : mode === "capacity-full" ? (
                            <YAxis
                                domain={[0, maxCapacity + capacityPadding]}
                                tickFormatter={(value: number) =>
                                    `${Math.round(value).toLocaleString()}`
                                }
                                tick={{ fontSize: 12, fill: "#475467" }}
                                width={90}
                            />
                        ) : (
                            <YAxis
                                domain={[
                                    minCapacity - capacityPadding,
                                    maxCapacity + capacityPadding,
                                ]}
                                tickFormatter={(value: number) =>
                                    `${Math.round(value).toLocaleString()}`
                                }
                                tick={{ fontSize: 12, fill: "#475467" }}
                                width={90}
                            />
                        )}

                        <Tooltip
                            labelFormatter={(label) => `Date: ${String(label)}`}
                            formatter={(value: ValueType, name: NameType) => {
                                const safeName = String(name);

                                if (typeof value !== "number") {
                                    return [String(value ?? "N/A"), safeName];
                                }

                                if (mode === "health") {
                                    return [
                                        `${value.toFixed(1)}%`,
                                        "Battery health",
                                    ];
                                }

                                return [
                                    `${value.toLocaleString()} mWh`,
                                    safeName,
                                ];
                            }}
                        />

                        {mode === "health" ? (
                            <Line
                                type="monotone"
                                dataKey="healthPercent"
                                name="Battery health"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                                connectNulls={false}
                            />
                        ) : (
                            <>
                                <Line
                                    type="monotone"
                                    dataKey="fullChargeCapacity_mWh"
                                    name="Full charge capacity"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                    connectNulls={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="designCapacity_mWh"
                                    name="Design capacity"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                    connectNulls={false}
                                />
                            </>
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function ChartModeButtons({
    mode,
    setMode,
}: {
    mode: ChartMode;
    setMode: React.Dispatch<React.SetStateAction<ChartMode>>;
}) {
    return (
        <div
            style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 16,
            }}
        >
            <ChartToggleButton
                active={mode === "health"}
                onClick={() => setMode("health")}
                label="Health %"
            />
            <ChartToggleButton
                active={mode === "capacity-zoomed"}
                onClick={() => setMode("capacity-zoomed")}
                label="Capacity (zoomed)"
            />
            <ChartToggleButton
                active={mode === "capacity-full"}
                onClick={() => setMode("capacity-full")}
                label="Capacity (full scale)"
            />
        </div>
    );
}

function ChartToggleButton({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            style={{
                border: active ? "1px solid #111827" : "1px solid #d0d5dd",
                background: active ? "#111827" : "#ffffff",
                color: active ? "#ffffff" : "#344054",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
            }}
        >
            {label}
        </button>
    );
}

function calculateHealthPercent(
    fullCharge?: number,
    design?: number
): number | null {
    if (!fullCharge || !design || design <= 0) return null;
    return (fullCharge / design) * 100;
}

function calculateWearPercent(
    fullCharge?: number,
    design?: number
): number | null {
    const health = calculateHealthPercent(fullCharge, design);
    if (health === null) return null;
    return 100 - health;
}

function getHealthLabel(health: number | null): string {
    if (health === null) return "Unknown";
    if (health >= 90) return "Excellent";
    if (health >= 80) return "Good";
    if (health >= 70) return "Fair";
    return "Poor";
}

function formatMWh(value?: number | null): string {
    if (value === undefined || value === null) return "N/A";
    return `${value.toLocaleString()} mWh`;
}

function formatPercent(value: number | null): string {
    if (value === null) return "N/A";
    return `${value.toFixed(1)}%`;
}

function StatCard({
    label,
    value,
    helper,
}: {
    label: string;
    value: string;
    helper?: string;
}) {
    return (
        <section
            aria-label={label}
            style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
        >
            <div
                style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#475467",
                    marginBottom: 12,
                }}
            >
                {label}
            </div>

            <div
                style={{
                    fontSize: 32,
                    lineHeight: 1.1,
                    fontWeight: 700,
                    color: "#101828",
                    letterSpacing: "-0.02em",
                }}
            >
                {value}
            </div>

            {helper && (
                <div
                    style={{
                        marginTop: 10,
                        fontSize: 14,
                        color: "#667085",
                    }}
                >
                    {helper}
                </div>
            )}
        </section>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid #eaecf0",
            }}
        >
            <div
                style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#475467",
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: 15,
                    color: "#101828",
                    wordBreak: "break-word",
                }}
            >
                {value}
            </div>
        </div>
    );
}

function SectionCard({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section
            style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 24,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
        >
            <div style={{ marginBottom: 18 }}>
                <h2
                    style={{
                        margin: 0,
                        fontSize: 22,
                        lineHeight: 1.2,
                        fontWeight: 700,
                        color: "#101828",
                        letterSpacing: "-0.02em",
                    }}
                >
                    {title}
                </h2>
                {description && (
                    <p
                        style={{
                            margin: "8px 0 0",
                            fontSize: 14,
                            color: "#667085",
                        }}
                    >
                        {description}
                    </p>
                )}
            </div>
            {children}
        </section>
    );
}

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
