export function formatTrendValue(
    value: number | null,
    suffix: string,
    decimals = 2,
    invertSign = false
): string {
    if (value === null || !Number.isFinite(value)) {
        return "Not enough history";
    }

    const displayed = invertSign ? -value : value;
    return `${displayed.toFixed(decimals)}${suffix}`;
}
