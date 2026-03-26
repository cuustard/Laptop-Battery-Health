export type BatterySnapshot = {
    capturedAt: string;
    healthPercent: number | null;
    wearPercent: number | null;
    fullChargeCapacity_mWh: number | null;
    designCapacity_mWh: number | null;
    cycleCount: number | null;
};

export type BatteryHistoryComparison = {
    previous: BatterySnapshot | null;
    latest: BatterySnapshot | null;
    healthDelta: number | null;
    wearDelta: number | null;
    fullChargeDelta_mWh: number | null;
    cycleCountDelta: number | null;
};
