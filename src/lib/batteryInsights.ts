import type { BatteryReport } from "../types/battery";
import type { Insight } from "../types/battery";
import {
    calculateHealthPercent,
    calculateWearPercent,
    calculateRecentDrainRate,
} from "./batteryMetrics";

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

function getCapacityTrendInsight(trend: number, pointCount: number): Insight {
    const historyQualifier =
        pointCount >= 6
            ? "across the recorded history"
            : "across a limited amount of recorded history";

    if (trend >= -2) {
        return {
            title: "Capacity trend looks stable",
            description: `Full charge capacity changed by ${trend.toFixed(
                1
            )}% ${historyQualifier}, which suggests little sign of accelerated long-term degradation.`,
            severity: "good",
        };
    }

    if (trend >= -6) {
        return {
            title: "Capacity trend shows mild decline",
            description: `Full charge capacity changed by ${trend.toFixed(
                1
            )}% ${historyQualifier}, which suggests gradual wear over time.`,
            severity: "neutral",
        };
    }

    if (trend >= -12) {
        return {
            title: "Capacity decline is becoming more noticeable",
            description: `Full charge capacity changed by ${trend.toFixed(
                1
            )}% ${historyQualifier}, which suggests moderate long-term wear.`,
            severity: "warning",
        };
    }

    return {
        title: "Capacity decline looks steep",
        description: `Full charge capacity changed by ${trend.toFixed(
            1
        )}% ${historyQualifier}. If this report covers a meaningful period, that suggests faster-than-ideal long-term degradation.`,
        severity: "warning",
    };
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
    const drain = calculateRecentDrainRate(data.recentUsage);
    const cycleCount =
        typeof battery.cycleCount === "number" ? battery.cycleCount : null;

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
        } else if (health >= 70) {
            insights.push({
                title: "Battery health is reduced",
                description: `Current battery health is ${health.toFixed(
                    1
                )}%, which suggests noticeable degradation.`,
                severity: "warning",
            });
        } else {
            insights.push({
                title: "Battery health is significantly reduced",
                description: `Current battery health is ${health.toFixed(
                    1
                )}%, which suggests the battery may provide noticeably shorter unplugged runtime than when new.`,
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

    if (cycleCount !== null) {
        let severity: Insight["severity"] = "neutral";
        let interpretation =
            "This is a moderate amount of recorded battery cycling.";

        if (cycleCount < 200) {
            severity = "good";
            interpretation =
                "This is still a relatively low number of recorded battery cycles.";
        } else if (cycleCount >= 500) {
            severity = "warning";
            interpretation =
                "This is a fairly high cycle count, so some accumulated wear is expected.";
        }

        insights.push({
            title: "Cycle count recorded",
            description: `This battery has completed ${cycleCount} charge cycles. ${interpretation}`,
            severity,
        });
    }

    if (trend !== null) {
        insights.push(
            getCapacityTrendInsight(trend, data.capacityHistory.length)
        );
    }

    if (drain.averagePercentPerHour !== null) {
        const rate = drain.averagePercentPerHour;

        let severity: "good" | "neutral" | "warning" = "neutral";
        let title = "Recent battery drain looks moderate";
        let interpretation =
            "Recent discharge appears to be within a typical everyday range.";

        if (rate < 8) {
            severity = "good";
            title = "Recent battery drain looks light";
            interpretation =
                "Recent battery-powered usage appears fairly efficient or low intensity.";
        } else if (rate >= 15) {
            severity = "warning";
            title = "Heavy recent battery drain detected";
            interpretation =
                "Recent battery-powered sessions show faster-than-usual discharge, which can happen during gaming, video calls, high brightness, or other demanding workloads.";
        }

        const mWhText =
            drain.averageMWhPerHour !== null
                ? ` (~${Math.round(
                      drain.averageMWhPerHour
                  ).toLocaleString()} mWh per hour)`
                : "";

        insights.push({
            title,
            description: `During recent battery-powered periods, the battery drained at about ${rate.toFixed(
                1
            )}% per hour${mWhText}. ${interpretation}`,
            severity,
        });
    }

    if (health !== null && cycleCount !== null) {
        if (cycleCount < 200 && health < 75) {
            insights.push({
                title: "Wear looks high for the cycle count",
                description:
                    "The battery has relatively few recorded charge cycles, but its health is already noticeably reduced. That can happen with battery age, heat exposure, or long periods spent at high charge levels.",
                severity: "warning",
            });
        } else if (cycleCount >= 500 && health >= 80) {
            insights.push({
                title: "Battery health is holding up well",
                description:
                    "The battery still retains good health despite a fairly high cycle count, which suggests wear has been relatively gradual so far.",
                severity: "good",
            });
        }
    }

    if (health !== null && drain.averagePercentPerHour !== null) {
        const rate = drain.averagePercentPerHour;

        if (health >= 85 && rate >= 15) {
            insights.push({
                title: "Fast drain is likely workload-related",
                description:
                    "Battery health is still fairly strong, so the heavy recent discharge is more likely due to demanding usage such as gaming, video calls, high brightness, or background workload rather than battery wear alone.",
                severity: "neutral",
            });
        } else if (health < 70 && rate >= 12) {
            insights.push({
                title: "Reduced battery endurance is likely noticeable",
                description:
                    "Battery health is already weakened and recent discharge is also fairly heavy, so unplugged runtime may feel noticeably shorter during normal use.",
                severity: "warning",
            });
        }
    }

    if (health !== null && trend !== null) {
        if (health < 75 && trend <= -8) {
            insights.push({
                title: "Battery wear appears both current and ongoing",
                description:
                    "The battery is already below strong health levels, and the historical capacity trend also shows meaningful decline. This suggests the reduced capacity is not just a one-off reading.",
                severity: "warning",
            });
        } else if (health >= 85 && trend >= -2) {
            insights.push({
                title: "Battery condition looks consistently solid",
                description:
                    "Current health remains strong and the historical capacity trend looks stable, which suggests the battery is aging gradually rather than deteriorating unusually quickly.",
                severity: "good",
            });
        }
    }

    return insights;
}
