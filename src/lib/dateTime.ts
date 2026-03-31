function getOrdinalDay(day: number): string {
    const mod100 = day % 100;
    if (mod100 >= 11 && mod100 <= 13) {
        return `${day}th`;
    }

    switch (day % 10) {
        case 1:
            return `${day}st`;
        case 2:
            return `${day}nd`;
        case 3:
            return `${day}rd`;
        default:
            return `${day}th`;
    }
}

export function parseDateValue(value: string | null | undefined): Date | null {
    if (!value) return null;

    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
        return parsed;
    }

    const normalised = value.replace(" ", "T");
    const fallback = new Date(normalised);

    return Number.isFinite(fallback.getTime()) ? fallback : null;
}

export function formatRelativeTimeFromNow(
    value: string | null | undefined
): string | null {
    const parsed = parseDateValue(value);
    if (!parsed) return null;

    const diffMs = Date.now() - parsed.getTime();
    if (!Number.isFinite(diffMs)) return null;

    if (diffMs < 60_000) {
        return "just now";
    }

    if (diffMs < 0) {
        return "in the future";
    }

    const totalMinutes = Math.floor(diffMs / 60_000);
    const totalHours = Math.floor(diffMs / 3_600_000);
    const totalDays = Math.floor(diffMs / 86_400_000);

    if (totalHours < 1) {
        return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"} ago`;
    }

    if (totalDays < 1) {
        return `${totalHours} hour${totalHours === 1 ? "" : "s"} ago`;
    }

    if (totalDays < 7) {
        const remainingHours = totalHours % 24;
        if (remainingHours === 0) {
            return `${totalDays} day${totalDays === 1 ? "" : "s"} ago`;
        }

        return `${totalDays} day${
            totalDays === 1 ? "" : "s"
        } and ${remainingHours} hour${remainingHours === 1 ? "" : "s"} ago`;
    }

    return `${totalDays} day${totalDays === 1 ? "" : "s"} ago`;
}

export function formatDateTime(
    value: string | null | undefined,
    options?: { includeRelative?: boolean }
): string {
    if (!value) return "N/A";

    const parsed = parseDateValue(value);
    if (!parsed) {
        return value;
    }

    const formatted = `${getOrdinalDay(
        parsed.getDate()
    )} ${parsed.toLocaleString(undefined, {
        month: "long",
    })} ${parsed.getFullYear()} at ${parsed.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })}`;

    if (options?.includeRelative === false) {
        return formatted;
    }

    const relative = formatRelativeTimeFromNow(value);
    return relative ? `${formatted} (${relative})` : formatted;
}
