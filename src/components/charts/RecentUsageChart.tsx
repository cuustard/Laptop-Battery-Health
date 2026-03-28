import { useMemo } from "react";
import {
    ResponsiveContainer,
    LineChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Line,
} from "recharts";
import type { RecentUsageEntry } from "../../types/battery";
import styles from "./RecentUsageChart.module.css";

type RecentUsageChartProps = {
    data: RecentUsageEntry[];
};

type ChartTheme = {
    grid: string;
    axis: string;
    line: string;
    tooltipBackground: string;
    tooltipBorder: string;
    tooltipText: string;
};

function getChartTheme(): ChartTheme {
    if (typeof window === "undefined") {
        return {
            grid: "#eaecf0",
            axis: "#475467",
            line: "#3b82f6",
            tooltipBackground: "#ffffff",
            tooltipBorder: "#d0d5dd",
            tooltipText: "#101828",
        };
    }

    const root = getComputedStyle(document.documentElement);

    const read = (name: string, fallback: string) =>
        root.getPropertyValue(name).trim() || fallback;

    return {
        grid: read("--chart-grid", "#eaecf0"),
        axis: read("--chart-axis", "#475467"),
        line: read("--chart-line", "#3b82f6"),
        tooltipBackground: read("--surface-elevated", "#ffffff"),
        tooltipBorder: read("--border-strong", "#d0d5dd"),
        tooltipText: read("--text-primary", "#101828"),
    };
}

export function RecentUsageChart({ data }: RecentUsageChartProps) {
    const chartData = getRecentUsageChartData(data);
    const chartTheme = useMemo(() => getChartTheme(), []);

    if (chartData.length === 0) {
        return (
            <p className={styles.emptyState}>
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
        <div className={styles.chartFrame}>
            <ResponsiveContainer>
                <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 16, left: 8, bottom: 48 }}
                >
                    <CartesianGrid
                        stroke={chartTheme.grid}
                        strokeOpacity={0.55}
                    />
                    <XAxis
                        dataKey="shortTimestamp"
                        interval="preserveStartEnd"
                        minTickGap={48}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 12, fill: chartTheme.axis }}
                        axisLine={{ stroke: chartTheme.grid }}
                        tickLine={{ stroke: chartTheme.grid }}
                    />
                    <YAxis
                        domain={[
                            Math.max(0, Math.floor(minValue - padding)),
                            Math.min(110, Math.ceil(maxValue + padding)),
                        ]}
                        tickFormatter={(value: number) =>
                            `${Math.round(value)}%`
                        }
                        tick={{ fontSize: 12, fill: chartTheme.axis }}
                        axisLine={{ stroke: chartTheme.grid }}
                        tickLine={{ stroke: chartTheme.grid }}
                        width={70}
                        allowDecimals={false}
                    />
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
