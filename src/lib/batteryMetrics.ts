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
