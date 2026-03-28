import type { BatteryReport } from "../types/battery";
import type {
    BatteryHistoryComparison,
    BatterySnapshot,
} from "../types/history";
import { calculateHealthPercent, calculateWearPercent } from "./batteryMetrics";

export type BatteryDegradationTrend = {
    first: BatterySnapshot | null;
    latest: BatterySnapshot | null;
    snapshotCount: number;
    daysTracked: number | null;
    healthDelta: number | null;
    wearDelta: number | null;
    fullChargeDelta_mWh: number | null;
    healthPercentPerDay: number | null;
    healthPercentPerMonth: number | null;
    wearPercentPerDay: number | null;
    wearPercentPerMonth: number | null;
    capacityLoss_mWhPerDay: number | null;
    capacityLoss_mWhPerMonth: number | null;
};

function resolveCapturedAt(reportTime?: string): string {
    if (typeof reportTime === "string" && reportTime.trim() !== "") {
        const parsed = new Date(reportTime);
        if (Number.isFinite(parsed.getTime())) {
            return parsed.toISOString();
        }
    }

    return new Date().toISOString();
}

function sortSnapshots(snapshots: BatterySnapshot[]): BatterySnapshot[] {
    return [...snapshots].sort(
        (a, b) =>
            new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
}

function safeDaysBetween(start: string, end: string): number | null {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
        return null;
    }

    const diffMs = endMs - startMs;
    if (diffMs <= 0) {
        return null;
    }

    return diffMs / (1000 * 60 * 60 * 24);
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

    const sorted = sortSnapshots(snapshots);

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

export function calculateDegradationTrend(
    snapshots: BatterySnapshot[]
): BatteryDegradationTrend {
    if (snapshots.length === 0) {
        return {
            first: null,
            latest: null,
            snapshotCount: 0,
            daysTracked: null,
            healthDelta: null,
            wearDelta: null,
            fullChargeDelta_mWh: null,
            healthPercentPerDay: null,
            healthPercentPerMonth: null,
            wearPercentPerDay: null,
            wearPercentPerMonth: null,
            capacityLoss_mWhPerDay: null,
            capacityLoss_mWhPerMonth: null,
        };
    }

    const sorted = sortSnapshots(snapshots);
    const first = sorted[0] ?? null;
    const latest = sorted[sorted.length - 1] ?? null;

    if (!first || !latest || sorted.length < 2) {
        return {
            first,
            latest,
            snapshotCount: sorted.length,
            daysTracked: null,
            healthDelta: null,
            wearDelta: null,
            fullChargeDelta_mWh: null,
            healthPercentPerDay: null,
            healthPercentPerMonth: null,
            wearPercentPerDay: null,
            wearPercentPerMonth: null,
            capacityLoss_mWhPerDay: null,
            capacityLoss_mWhPerMonth: null,
        };
    }

    const daysTracked = safeDaysBetween(first.capturedAt, latest.capturedAt);

    const healthDelta =
        first.healthPercent !== null && latest.healthPercent !== null
            ? latest.healthPercent - first.healthPercent
            : null;

    const wearDelta =
        first.wearPercent !== null && latest.wearPercent !== null
            ? latest.wearPercent - first.wearPercent
            : null;

    const fullChargeDelta_mWh =
        first.fullChargeCapacity_mWh !== null &&
        latest.fullChargeCapacity_mWh !== null
            ? latest.fullChargeCapacity_mWh - first.fullChargeCapacity_mWh
            : null;

    const healthPercentPerDay =
        daysTracked && healthDelta !== null ? healthDelta / daysTracked : null;

    const wearPercentPerDay =
        daysTracked && wearDelta !== null ? wearDelta / daysTracked : null;

    const capacityLoss_mWhPerDay =
        daysTracked && fullChargeDelta_mWh !== null
            ? -fullChargeDelta_mWh / daysTracked
            : null;

    return {
        first,
        latest,
        snapshotCount: sorted.length,
        daysTracked,
        healthDelta,
        wearDelta,
        fullChargeDelta_mWh,
        healthPercentPerDay,
        healthPercentPerMonth:
            healthPercentPerDay !== null ? healthPercentPerDay * 30 : null,
        wearPercentPerDay,
        wearPercentPerMonth:
            wearPercentPerDay !== null ? wearPercentPerDay * 30 : null,
        capacityLoss_mWhPerDay,
        capacityLoss_mWhPerMonth:
            capacityLoss_mWhPerDay !== null
                ? capacityLoss_mWhPerDay * 30
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
