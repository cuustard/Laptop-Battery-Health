export function formatMWh(value?: number | null): string {
    if (value === undefined || value === null) return "N/A";
    return `${value.toLocaleString()} mWh`;
}

export function formatPercent(value: number | null): string {
    if (value === null) return "N/A";
    return `${value.toFixed(1)}%`;
}

export function formatRatePerHour(value: number | null, suffix = "%/hr") {
    if (value === null || !Number.isFinite(value)) return "N/A";
    return `${value.toFixed(1)} ${suffix}`;
}
