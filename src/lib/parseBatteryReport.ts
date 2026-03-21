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

  // 🔥 Find the FIRST table AFTER the section (not just nextElementSibling)
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

  return [battery];
}

function parseNumber(value?: string | null): number | undefined {
  if (!value) return undefined;

  const cleaned = value.replace(/[^0-9]/g, "");
  return cleaned ? parseInt(cleaned, 10) : undefined;
}