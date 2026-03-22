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

export function RecentUsageChart({ data }: { data: RecentUsageEntry[] }) {
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
