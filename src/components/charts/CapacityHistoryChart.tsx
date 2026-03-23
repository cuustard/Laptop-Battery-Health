import { useState } from "react";
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
