import type { BatteryReport } from "../types/battery";
import type { Insight } from "../types/battery";
import { calculateHealthPercent, calculateWearPercent } from "./batteryMetrics";

export function getCapacityTrend(
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

export function generateInsights(data: BatteryReport): Insight[] {
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

export function getInsightColors(severity: Insight["severity"]) {
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
