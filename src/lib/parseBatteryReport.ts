import type {
    BatteryReport,
    Battery,
    CapacityHistoryEntry,
    RecentUsageEntry,
} from "../types/battery";

export function parseBatteryReportHtml(html: string): BatteryReport {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    return {
        metadata: parseMetadata(doc),
        batteries: parseInstalledBatteries(doc),
        capacityHistory: parseCapacityHistory(doc),
        recentUsage: parseRecentUsage(doc),
    };
}

function parseMetadata(doc: Document): BatteryReport["metadata"] {
    const rows = doc.querySelectorAll("body > table tr");
    const metadata: BatteryReport["metadata"] = {};

    rows.forEach((row) => {
        const cells = row.querySelectorAll("td");

        if (cells.length === 2) {
            const key = cells[0].textContent?.trim();
            const value = cells[1].textContent?.trim();

            if (!key) return;

            switch (key) {
                case "COMPUTER NAME":
                    metadata.computerName = value;
                    break;
                case "SYSTEM PRODUCT NAME":
                    metadata.systemProductName = value;
                    break;
                case "BIOS":
                    metadata.bios = value;
                    break;
                case "OS BUILD":
                    metadata.osBuild = value;
                    break;
                case "REPORT TIME":
                    metadata.reportTime = value;
                    break;
            }
        }
    });

    return metadata;
}

function parseInstalledBatteries(doc: Document): Battery[] {
    const section = Array.from(doc.querySelectorAll("h2")).find((el) =>
        el.textContent?.includes("Installed batteries")
    );

    if (!section) return [];

    let next: Element | null = section.nextElementSibling;

    while (next && next.tagName !== "TABLE") {
        next = next.nextElementSibling;
    }

    if (!next) return [];

    const rows = next.querySelectorAll("tr");
    const battery: Battery = {};

    rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length !== 2) return;

        const key = cells[0].textContent?.trim() || "";
        const value = cells[1].textContent?.trim() || "";
        const normalizedKey = key.toLowerCase();

        if (normalizedKey.includes("design capacity")) {
            battery.designCapacity_mWh = parseNumber(value);
        }

        if (normalizedKey.includes("full charge capacity")) {
            battery.fullChargeCapacity_mWh = parseNumber(value);
        }

        if (normalizedKey.includes("cycle count")) {
            battery.cycleCount = value ? parseInt(value, 10) : null;
        }

        if (normalizedKey.includes("name")) {
            battery.name = value;
        }

        if (normalizedKey.includes("manufacturer")) {
            battery.manufacturer = value;
        }

        if (normalizedKey.includes("serial number")) {
            battery.serialNumber = value;
        }

        if (normalizedKey.includes("chemistry")) {
            battery.chemistry = value;
        }
    });

    return Object.keys(battery).length > 0 ? [battery] : [];
}

function parseCapacityHistory(doc: Document): CapacityHistoryEntry[] {
    const section = Array.from(doc.querySelectorAll("h2")).find((el) =>
        el.textContent?.toLowerCase().includes("battery capacity history")
    );

    if (!section) return [];

    let next: Element | null = section.nextElementSibling;

    while (next && next.tagName !== "TABLE") {
        next = next.nextElementSibling;
    }

    if (!next) return [];

    const rows = Array.from(next.querySelectorAll("tr"));
    const entries: CapacityHistoryEntry[] = [];

    for (const row of rows.slice(1)) {
        const cells = Array.from(row.querySelectorAll("td, th")).map(
            (cell) => cell.textContent?.trim() || ""
        );

        if (cells.length < 3) continue;

        const [date, fullCharge, design] = cells;

        if (!date) continue;

        entries.push({
            date,
            fullChargeCapacity_mWh: parseNumber(fullCharge),
            designCapacity_mWh: parseNumber(design),
        });
    }

    return entries;
}

function parseNumber(value?: string | null): number | undefined {
    if (!value) return undefined;

    const cleaned = value.replace(/[^0-9]/g, "");
    return cleaned ? parseInt(cleaned, 10) : undefined;
}

function parseRecentUsage(doc: Document): RecentUsageEntry[] {
    const section = Array.from(doc.querySelectorAll("h2")).find((el) =>
        el.textContent?.toLowerCase().includes("recent usage")
    );

    if (!section) return [];

    let next: Element | null = section.nextElementSibling;

    while (next && next.tagName !== "TABLE") {
        next = next.nextElementSibling;
    }

    if (!next) return [];

    const rows = Array.from(next.querySelectorAll("tr"));
    const entries: RecentUsageEntry[] = [];

    let currentDate = "";

    for (const row of rows.slice(1)) {
        // Skip separator rows
        if (row.classList.contains("noncontigbreak")) continue;

        const dateSpan = row.querySelector("td.dateTime span.date");
        const timeSpan = row.querySelector("td.dateTime span.time");
        const stateCell = row.querySelector("td.state");
        const sourceCell = row.querySelector("td.acdc");
        const percentCell = row.querySelector("td.percent");
        const mwCell = row.querySelector("td.mw");

        const dateText = dateSpan?.textContent?.trim() || "";
        const timeText = timeSpan?.textContent?.trim() || "";
        const stateText = stateCell?.textContent?.trim() || "";
        const sourceText = sourceCell?.textContent?.trim() || "";
        const percentText = percentCell?.textContent?.trim() || "";
        const mwText = mwCell?.textContent?.trim() || "";

        if (dateText) {
            currentDate = dateText;
        }

        if (!currentDate || !timeText) continue;

        const timestamp = `${currentDate} ${timeText}`.trim();

        let capacityPercent: number | undefined;
        let remainingCapacity_mWh: number | undefined;

        const percentMatch = percentText.match(/-?\d+(?:\.\d+)?/);
        if (percentMatch) {
            capacityPercent = parseFloat(percentMatch[0]);
        }

        const mwMatch = mwText.match(/-?[\d,]+/);
        if (mwMatch) {
            remainingCapacity_mWh = parseInt(mwMatch[0].replace(/,/g, ""), 10);
        }

        entries.push({
            timestamp,
            state: stateText || undefined,
            source: sourceText || undefined,
            capacityPercent,
            remainingCapacity_mWh,
        });
    }

    return entries;
}
