import type { BatteryReport } from "../types/battery";
import type {
    BatteryHistoryComparison,
    BatterySnapshot,
} from "../types/history";
import { calculateHealthPercent, calculateWearPercent } from "./batteryMetrics";

function resolveCapturedAt(reportTime?: string): string {
    if (typeof reportTime === "string" && reportTime.trim() !== "") {
        const parsed = new Date(reportTime);
        if (Number.isFinite(parsed.getTime())) {
            return parsed.toISOString();
        }
    }

    return new Date().toISOString();
}

export function createSnapshot(data: BatteryReport): BatterySnapshot | null {
    const battery = data.batteries[0];
    if (!battery) return null;

    const healthPercent = calculateHealthPercent(
        battery.fullChargeCapacity_mWh,
        battery.designCapacity_mWh
    );

    const wearPercent = calculateWearPercent(
        battery.fullChargeCapacity_mWh,
        battery.designCapacity_mWh
    );

    return {
        capturedAt: resolveCapturedAt(data.metadata.reportTime),
        healthPercent,
        wearPercent,
        fullChargeCapacity_mWh: battery.fullChargeCapacity_mWh ?? null,
        designCapacity_mWh: battery.designCapacity_mWh ?? null,
        cycleCount: battery.cycleCount ?? null,
    };
}

export function compareHistory(
    snapshots: BatterySnapshot[]
): BatteryHistoryComparison {
    if (snapshots.length === 0) {
        return {
            previous: null,
            latest: null,
            healthDelta: null,
            wearDelta: null,
            fullChargeDelta_mWh: null,
            cycleCountDelta: null,
        };
    }

    const sorted = [...snapshots].sort(
        (a, b) =>
            new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );

    const latest = sorted[sorted.length - 1] ?? null;
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

    if (!latest || !previous) {
        return {
            previous,
            latest,
            healthDelta: null,
            wearDelta: null,
            fullChargeDelta_mWh: null,
            cycleCountDelta: null,
        };
    }

    return {
        previous,
        latest,
        healthDelta:
            latest.healthPercent !== null && previous.healthPercent !== null
                ? latest.healthPercent - previous.healthPercent
                : null,
        wearDelta:
            latest.wearPercent !== null && previous.wearPercent !== null
                ? latest.wearPercent - previous.wearPercent
                : null,
        fullChargeDelta_mWh:
            latest.fullChargeCapacity_mWh !== null &&
            previous.fullChargeCapacity_mWh !== null
                ? latest.fullChargeCapacity_mWh -
                  previous.fullChargeCapacity_mWh
                : null,
        cycleCountDelta:
            latest.cycleCount !== null && previous.cycleCount !== null
                ? latest.cycleCount - previous.cycleCount
                : null,
    };
}

export function formatDelta(
    value: number | null,
    suffix = "",
    decimals = 1
): string {
    if (value === null || !Number.isFinite(value)) return "N/A";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(decimals)}${suffix}`;
}
