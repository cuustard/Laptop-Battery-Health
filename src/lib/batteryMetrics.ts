import type { RecentUsageEntry } from "../types/battery";

export function calculateHealthPercent(
    fullCharge?: number,
    design?: number
): number | null {
    if (!fullCharge || !design || design <= 0) return null;
    return (fullCharge / design) * 100;
}

export function calculateWearPercent(
    fullCharge?: number,
    design?: number
): number | null {
    const health = calculateHealthPercent(fullCharge, design);
    if (health === null) return null;
    return 100 - health;
}

export function getHealthLabel(health: number | null): string {
    if (health === null) return "Unknown";
    if (health >= 90) return "Excellent";
    if (health >= 80) return "Good";
    if (health >= 70) return "Fair";
    return "Poor";
}

export type DrainRateSummary = {
    averagePercentPerHour: number | null;
    averageMWhPerHour: number | null;
    sampleCount: number;
};

function toTimestamp(value: string): number | null {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
}

export function calculateRecentDrainRate(
    entries: RecentUsageEntry[]
): DrainRateSummary {
    if (entries.length < 2) {
        return {
            averagePercentPerHour: null,
            averageMWhPerHour: null,
            sampleCount: 0,
        };
    }

    const sorted = [...entries]
        .filter(
            (entry) =>
                typeof entry.timestamp === "string" &&
                entry.timestamp.trim() !== ""
        )
        .sort((a, b) => {
            const aTime = toTimestamp(a.timestamp) ?? 0;
            const bTime = toTimestamp(b.timestamp) ?? 0;
            return aTime - bTime;
        });

    let totalPercentDrop = 0;
    let totalMWhDrop = 0;
    let totalHours = 0;
    let mWhHours = 0;
    let sampleCount = 0;

    for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const curr = sorted[i];

        const prevTime = toTimestamp(prev.timestamp);
        const currTime = toTimestamp(curr.timestamp);

        if (prevTime === null || currTime === null || currTime <= prevTime) {
            continue;
        }

        const hours = (currTime - prevTime) / (1000 * 60 * 60);
        if (!Number.isFinite(hours) || hours <= 0) {
            continue;
        }

        // Skip very large gaps so disconnected logs do not distort the result
        if (hours > 6) {
            continue;
        }

        const onBattery =
            prev.source?.toLowerCase() === "battery" &&
            curr.source?.toLowerCase() === "battery";

        if (!onBattery) {
            continue;
        }

        const prevPercent =
            typeof prev.capacityPercent === "number"
                ? prev.capacityPercent
                : null;
        const currPercent =
            typeof curr.capacityPercent === "number"
                ? curr.capacityPercent
                : null;

        if (
            prevPercent !== null &&
            currPercent !== null &&
            prevPercent > currPercent
        ) {
            totalPercentDrop += prevPercent - currPercent;
            totalHours += hours;
            sampleCount += 1;
        }

        const prevMWh =
            typeof prev.remainingCapacity_mWh === "number"
                ? prev.remainingCapacity_mWh
                : null;
        const currMWh =
            typeof curr.remainingCapacity_mWh === "number"
                ? curr.remainingCapacity_mWh
                : null;

        if (prevMWh !== null && currMWh !== null && prevMWh > currMWh) {
            totalMWhDrop += prevMWh - currMWh;
            mWhHours += hours;
        }
    }

    return {
        averagePercentPerHour:
            totalHours > 0 ? totalPercentDrop / totalHours : null,
        averageMWhPerHour: mWhHours > 0 ? totalMWhDrop / mWhHours : null,
        sampleCount,
    };
}
