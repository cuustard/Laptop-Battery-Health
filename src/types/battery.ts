export type BatteryReport = {
    metadata: {
        computerName?: string;
        systemProductName?: string;
        bios?: string;
        osBuild?: string;
        reportTime?: string;
    };
    batteries: Battery[];
    capacityHistory: CapacityHistoryEntry[];
    recentUsage: RecentUsageEntry[];
};

export type Battery = {
    name?: string;
    manufacturer?: string;
    serialNumber?: string;
    chemistry?: string;
    designCapacity_mWh?: number;
    fullChargeCapacity_mWh?: number;
    cycleCount?: number | null;
};

export type CapacityHistoryEntry = {
    date: string;
    fullChargeCapacity_mWh?: number;
    designCapacity_mWh?: number;
};

export type RecentUsageEntry = {
    timestamp: string;
    state?: string;
    source?: string;
    capacityPercent?: number;
    remainingCapacity_mWh?: number;
};

export type Insight = {
    title: string;
    description: string;
    severity: "good" | "neutral" | "warning";
};
