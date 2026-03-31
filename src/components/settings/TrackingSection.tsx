import { SectionCard } from "../ui/SectionCard";
import type { TrackingSettings } from "../../types/settings";

type TrackingSectionProps = {
    trackingDraft: TrackingSettings;
    updateTrackingDraft: (partial: Partial<TrackingSettings>) => void;
};

export function TrackingSection({
    trackingDraft,
    updateTrackingDraft,
}: TrackingSectionProps) {
    return (
        <SectionCard
            title="Tracking"
            description="Control when new battery snapshots are saved."
        >
            <div className="settings-group">
                <label className="settings-toggle">
                    <input
                        type="checkbox"
                        checked={trackingDraft.autoSaveOnLoad}
                        onChange={(event) =>
                            updateTrackingDraft({
                                autoSaveOnLoad: event.target.checked,
                            })
                        }
                    />
                    <span>
                        <strong>Auto-save snapshot on load</strong>
                        <small>
                            Save a snapshot automatically when a report is
                            loaded.
                        </small>
                    </span>
                </label>

                <label className="settings-toggle">
                    <input
                        type="checkbox"
                        checked={trackingDraft.onlySaveWhenChanged}
                        onChange={(event) =>
                            updateTrackingDraft({
                                onlySaveWhenChanged: event.target.checked,
                            })
                        }
                    />
                    <span>
                        <strong>Only save when values change</strong>
                        <small>
                            Skip saving when the latest snapshot is effectively
                            identical.
                        </small>
                    </span>
                </label>

                <label className="settings-field" htmlFor="interval-select">
                    <span className="settings-field__label">
                        Minimum time between saved snapshots
                    </span>
                    <select
                        id="interval-select"
                        className="settings-select"
                        value={String(trackingDraft.minHoursBetweenSnapshots)}
                        onChange={(event) =>
                            updateTrackingDraft({
                                minHoursBetweenSnapshots: Number(
                                    event.target.value
                                ),
                            })
                        }
                    >
                        <option value="0">No minimum</option>
                        <option value="6">6 hours</option>
                        <option value="12">12 hours</option>
                        <option value="24">24 hours</option>
                        <option value="48">48 hours</option>
                        <option value="72">72 hours</option>
                    </select>
                </label>
            </div>
        </SectionCard>
    );
}
