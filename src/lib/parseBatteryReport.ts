import type { BatteryReport, Battery } from "../types/battery";

export function parseBatteryReportHtml(html: string): BatteryReport {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  return {
    metadata: parseMetadata(doc),
    batteries: parseInstalledBatteries(doc),
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

  const table = section.nextElementSibling as HTMLTableElement | null;
  const rows = table?.querySelectorAll("tr");

  if (!rows) return [];

  const battery: Battery = {};

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length !== 2) return;

    const key = cells[0].textContent?.trim();
    const value = cells[1].textContent?.trim();

    if (!key) return;

    if (key.includes("DESIGN CAPACITY")) {
      battery.designCapacity_mWh = parseNumber(value);
    }

    if (key.includes("FULL CHARGE CAPACITY")) {
      battery.fullChargeCapacity_mWh = parseNumber(value);
    }

    if (key.includes("CYCLE COUNT")) {
      battery.cycleCount = value ? parseInt(value) : null;
    }
  });

  return [battery];
}

function parseNumber(value?: string | null): number | undefined {
  if (!value) return undefined;

  const cleaned = value.replace(/[^0-9]/g, "");
  return cleaned ? parseInt(cleaned, 10) : undefined;
}