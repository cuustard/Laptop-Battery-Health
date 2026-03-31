import { SectionCard } from "../ui/SectionCard";
import { InfoRow } from "../ui/InfoRow";

type DataSectionProps = {
    historyLength: number;
    trackingStartedAt: string | null;
    lastSnapshotAt: string | null;
    formatDateTime: (
        value: string | null | undefined,
        options?: { includeRelative?: boolean }
    ) => string;
    handleExportSummary: () => void;
    handleExportRawData: () => void;
    handleExportCsv: () => void;
    handleResetAllData: () => Promise<void>;
    isResettingData: boolean;
    settingsMessage: string | null;
};

export function DataSection({
    historyLength,
    trackingStartedAt,
    lastSnapshotAt,
    formatDateTime,
    handleExportSummary,
    handleExportRawData,
    handleExportCsv,
    handleResetAllData,
    isResettingData,
    settingsMessage,
}: DataSectionProps) {
    return (
        <SectionCard
            title="Data & storage"
            description="Export battery data or remove saved history from this device."
        >
            <div className="settings-stats">
                <InfoRow
                    label="Snapshots stored"
                    value={String(historyLength)}
                />
                <InfoRow
                    label="Tracking since"
                    value={formatDateTime(trackingStartedAt)}
                />
                <InfoRow
                    label="Last snapshot"
                    value={formatDateTime(lastSnapshotAt)}
                />
            </div>

            <div className="settings-actions">
                <button className="app-button" onClick={handleExportSummary}>
                    Export summary
                </button>
                <button
                    className="app-button app-button--secondary"
                    onClick={handleExportRawData}
                >
                    Export raw JSON
                </button>
                <button
                    className="app-button app-button--secondary"
                    onClick={handleExportCsv}
                >
                    Export CSV
                </button>
                <button
                    className="app-button app-button--danger"
                    onClick={() => void handleResetAllData()}
                    disabled={isResettingData}
                >
                    {isResettingData ? "Deleting..." : "Delete all saved data"}
                </button>
            </div>

            {settingsMessage && (
                <p className="settings-message">{settingsMessage}</p>
            )}
        </SectionCard>
    );
}
