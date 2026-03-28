import { useMemo, useState } from "react";
import {
    ResponsiveContainer,
    LineChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Line,
} from "recharts";
import type {
    ValueType,
    NameType,
} from "recharts/types/component/DefaultTooltipContent";
import styles from "./CapacityHistoryChart.module.css";

type ChartMode = "health" | "capacity-zoomed" | "capacity-full";

type CapacityHistoryEntry = {
    date: string;
    fullChargeCapacity_mWh?: number;
    designCapacity_mWh?: number;
};

type CapacityHistoryChartProps = {
    data: CapacityHistoryEntry[];
};

type ChartTheme = {
    grid: string;
    axis: string;
    line: string;
    reference: string;
    tooltipBackground: string;
    tooltipBorder: string;
    tooltipText: string;
    tooltipMuted: string;
};

function getChartTheme(): ChartTheme {
    if (typeof window === "undefined") {
        return {
            grid: "#eaecf0",
            axis: "#475467",
            line: "#3b82f6",
            reference: "#94a3b8",
            tooltipBackground: "#ffffff",
            tooltipBorder: "#d0d5dd",
            tooltipText: "#101828",
            tooltipMuted: "#475467",
        };
    }

    const root = getComputedStyle(document.documentElement);

    const read = (name: string, fallback: string) =>
        root.getPropertyValue(name).trim() || fallback;

    return {
        grid: read("--chart-grid", "#eaecf0"),
        axis: read("--chart-axis", "#475467"),
        line: read("--chart-line", "#3b82f6"),
        reference: read("--chart-reference", "#94a3b8"),
        tooltipBackground: read("--surface-elevated", "#ffffff"),
        tooltipBorder: read("--border-strong", "#d0d5dd"),
        tooltipText: read("--text-primary", "#101828"),
        tooltipMuted: read("--text-secondary", "#475467"),
    };
}

function formatChartDate(dateString: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function CapacityHistoryChart({ data }: CapacityHistoryChartProps) {
    const [mode, setMode] = useState<ChartMode>("health");

    const chartTheme = useMemo(() => getChartTheme(), []);

    if (data.length === 0) {
        return (
            <p className={styles.emptyState}>
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
                <p className={styles.emptyState}>
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
                <p className={styles.emptyState}>
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

            <div className={styles.chartDescription}>
                {mode === "health" &&
                    "Shows battery health as a percentage of design capacity. Best for understanding actual battery condition."}
                {mode === "capacity-zoomed" &&
                    "Scaled to the data range so small changes are easier to see."}
                {mode === "capacity-full" &&
                    "Uses a full scale from zero to avoid exaggerating small changes."}
            </div>

            <div className={styles.chartFrame}>
                <ResponsiveContainer>
                    <LineChart
                        key={mode}
                        data={currentData}
                        margin={{ top: 8, right: 16, left: 8, bottom: 48 }}
                    >
                        <CartesianGrid
                            stroke={chartTheme.grid}
                            strokeOpacity={0.55}
                        />
                        <XAxis
                            dataKey="shortDate"
                            interval="preserveStartEnd"
                            minTickGap={48}
                            angle={-30}
                            textAnchor="end"
                            height={60}
                            tick={{ fontSize: 12, fill: chartTheme.axis }}
                            axisLine={{ stroke: chartTheme.grid }}
                            tickLine={{ stroke: chartTheme.grid }}
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
                                tick={{ fontSize: 12, fill: chartTheme.axis }}
                                axisLine={{ stroke: chartTheme.grid }}
                                tickLine={{ stroke: chartTheme.grid }}
                                width={80}
                                allowDecimals={false}
                            />
                        ) : mode === "capacity-full" ? (
                            <YAxis
                                domain={[0, maxCapacity + capacityPadding]}
                                tickFormatter={(value: number) =>
                                    `${Math.round(value).toLocaleString()}`
                                }
                                tick={{ fontSize: 12, fill: chartTheme.axis }}
                                axisLine={{ stroke: chartTheme.grid }}
                                tickLine={{ stroke: chartTheme.grid }}
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
                                tick={{ fontSize: 12, fill: chartTheme.axis }}
                                axisLine={{ stroke: chartTheme.grid }}
                                tickLine={{ stroke: chartTheme.grid }}
                                width={90}
                            />
                        )}

                        <Tooltip
                            contentStyle={{
                                background: chartTheme.tooltipBackground,
                                border: `1px solid ${chartTheme.tooltipBorder}`,
                                borderRadius: 12,
                                color: chartTheme.tooltipText,
                                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18)",
                            }}
                            itemStyle={{ color: chartTheme.tooltipText }}
                            labelStyle={{
                                color: chartTheme.tooltipText,
                                fontWeight: 700,
                                marginBottom: 6,
                            }}
                            cursor={{
                                stroke: chartTheme.grid,
                                strokeOpacity: 0.45,
                            }}
                            labelFormatter={(label) => `Date: ${String(label)}`}
                            formatter={(
                                value: ValueType | undefined,
                                name: NameType | undefined
                            ) => {
                                const safeName = String(name ?? "Unknown");

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
                                stroke={chartTheme.line}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{
                                    r: 5,
                                    stroke: chartTheme.tooltipBackground,
                                    strokeWidth: 2,
                                    fill: chartTheme.line,
                                }}
                                isAnimationActive={false}
                                connectNulls={false}
                            />
                        ) : (
                            <>
                                <Line
                                    type="monotone"
                                    dataKey="fullChargeCapacity_mWh"
                                    name="Full charge capacity"
                                    stroke={chartTheme.line}
                                    strokeWidth={2.5}
                                    dot={false}
                                    activeDot={{
                                        r: 5,
                                        stroke: chartTheme.tooltipBackground,
                                        strokeWidth: 2,
                                        fill: chartTheme.line,
                                    }}
                                    isAnimationActive={false}
                                    connectNulls={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="designCapacity_mWh"
                                    name="Design capacity"
                                    stroke={chartTheme.reference}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{
                                        r: 5,
                                        stroke: chartTheme.tooltipBackground,
                                        strokeWidth: 2,
                                        fill: chartTheme.reference,
                                    }}
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

type ChartModeButtonsProps = {
    mode: ChartMode;
    setMode: (mode: ChartMode) => void;
};

function ChartModeButtons({ mode, setMode }: ChartModeButtonsProps) {
    return (
        <div className={styles.modeButtons}>
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

type ChartToggleButtonProps = {
    label: string;
    active: boolean;
    onClick: () => void;
};

function ChartToggleButton({ label, active, onClick }: ChartToggleButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`${styles.toggleButton} ${
                active ? styles.toggleButtonActive : ""
            }`.trim()}
        >
            {label}
        </button>
    );
}
