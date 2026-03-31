import { SectionCard } from "../ui/SectionCard";
import type { DesktopSettings } from "../../types/settings";

type BackgroundSectionProps = {
    desktopDraft: DesktopSettings;
    updateDesktopDraft: (partial: Partial<DesktopSettings>) => void;
};

export function BackgroundSection({
    desktopDraft,
    updateDesktopDraft,
}: BackgroundSectionProps) {
    return (
        <SectionCard
            title="Background & notifications"
            description="Control startup, tray behavior, scheduled checks, and health alerts."
        >
            <div className="settings-group">
                <label className="settings-toggle">
                    <input
                        type="checkbox"
                        checked={desktopDraft.launchOnStartup}
                        onChange={(event) =>
                            updateDesktopDraft({
                                launchOnStartup: event.target.checked,
                            })
                        }
                    />
                    <span>
                        <strong>Launch on Windows startup</strong>
                        <small>
                            Start Battery Dashboard when you log in to Windows.
                        </small>
                    </span>
                </label>

                <label className="settings-toggle">
                    <input
                        type="checkbox"
                        checked={desktopDraft.minimizeToTrayOnClose}
                        onChange={(event) =>
                            updateDesktopDraft({
                                minimizeToTrayOnClose: event.target.checked,
                            })
                        }
                    />
                    <span>
                        <strong>Hide to tray when X is clicked</strong>
                        <small>
                            Keep the app running in the system tray instead of
                            quitting when the window is closed.
                        </small>
                    </span>
                </label>

                <label className="settings-toggle">
                    <input
                        type="checkbox"
                        checked={desktopDraft.backgroundChecksEnabled}
                        onChange={(event) =>
                            updateDesktopDraft({
                                backgroundChecksEnabled: event.target.checked,
                            })
                        }
                    />
                    <span>
                        <strong>Enable background battery checks</strong>
                        <small>
                            Check battery health on a schedule even while the
                            app is hidden in the tray.
                        </small>
                    </span>
                </label>

                <label
                    className="settings-field"
                    htmlFor="background-check-interval"
                >
                    <span className="settings-field__label">
                        Background check frequency
                    </span>
                    <select
                        id="background-check-interval"
                        className="settings-select"
                        value={String(
                            desktopDraft.backgroundCheckIntervalHours
                        )}
                        onChange={(event) =>
                            updateDesktopDraft({
                                backgroundCheckIntervalHours: Number(
                                    event.target.value
                                ),
                            })
                        }
                    >
                        <option value="1">Every 1 hour</option>
                        <option value="3">Every 3 hours</option>
                        <option value="6">Every 6 hours</option>
                        <option value="12">Every 12 hours</option>
                        <option value="24">Every 24 hours</option>
                    </select>
                </label>

                <label className="settings-toggle">
                    <input
                        type="checkbox"
                        checked={desktopDraft.batteryHealthAlertsEnabled}
                        onChange={(event) =>
                            updateDesktopDraft({
                                batteryHealthAlertsEnabled:
                                    event.target.checked,
                            })
                        }
                    />
                    <span>
                        <strong>
                            Notify when battery health drops below a threshold
                        </strong>
                        <small>
                            Send a desktop notification once when the monitored
                            battery health falls below the chosen threshold.
                        </small>
                    </span>
                </label>

                <label
                    className="settings-field"
                    htmlFor="battery-health-threshold"
                >
                    <span className="settings-field__label">
                        Health alert threshold
                    </span>
                    <select
                        id="battery-health-threshold"
                        className="settings-select"
                        value={String(
                            desktopDraft.batteryHealthThresholdPercent
                        )}
                        onChange={(event) =>
                            updateDesktopDraft({
                                batteryHealthThresholdPercent: Number(
                                    event.target.value
                                ),
                            })
                        }
                    >
                        <option value="95">95%</option>
                        <option value="90">90%</option>
                        <option value="85">85%</option>
                        <option value="80">80%</option>
                        <option value="75">75%</option>
                    </select>
                </label>
            </div>
        </SectionCard>
    );
}
