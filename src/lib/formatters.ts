export function formatMWh(value?: number | null): string {
    if (value === undefined || value === null) return "N/A";
    return `${value.toLocaleString()} mWh`;
}

export function formatPercent(value: number | null): string {
    if (value === null) return "N/A";
    return `${value.toFixed(1)}%`;
}
