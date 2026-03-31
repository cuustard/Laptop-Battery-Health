export function downloadTextFile(
    filename: string,
    content: string,
    mimeType = "text/plain;charset=utf-8"
) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

export function formatDateForFilename(date = new Date()): string {
    return date.toISOString().replace(/[:.]/g, "-");
}

export function downloadCsvFile(filename: string, rows: string[][]) {
    const escapeCell = (value: string) => {
        const safe = value ?? "";
        if (
            safe.includes(",") ||
            safe.includes('"') ||
            safe.includes("\n") ||
            safe.includes("\r")
        ) {
            return `"${safe.replace(/"/g, '""')}"`;
        }
        return safe;
    };

    const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
    downloadTextFile(filename, csv, "text/csv;charset=utf-8");
}
