import { SectionCard } from "../ui/SectionCard";
import type { AppPreferences } from "../../types/settings";

type AccessibilitySectionProps = {
    preferences: AppPreferences;
    setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
};

export function AccessibilitySection({
    preferences,
    setPreferences,
}: AccessibilitySectionProps) {
    return (
        <SectionCard
            title="Accessibility"
            description="Adjust readability and colour accessibility."
        >
            <div className="settings-group">
                <label className="settings-toggle">
                    <input
                        type="checkbox"
                        checked={preferences.highContrast}
                        onChange={(event) =>
                            setPreferences((current) => ({
                                ...current,
                                highContrast: event.target.checked,
                            }))
                        }
                    />
                    <span>
                        <strong>High contrast mode</strong>
                        <small>
                            Increase contrast for text, cards, and controls.
                        </small>
                    </span>
                </label>

                <label className="settings-toggle">
                    <input
                        type="checkbox"
                        checked={preferences.largeText}
                        onChange={(event) =>
                            setPreferences((current) => ({
                                ...current,
                                largeText: event.target.checked,
                            }))
                        }
                    />
                    <span>
                        <strong>Larger text</strong>
                        <small>Increase font sizes across the app.</small>
                    </span>
                </label>

                <label className="settings-toggle">
                    <input
                        type="checkbox"
                        checked={preferences.colorBlindFriendly}
                        onChange={(event) =>
                            setPreferences((current) => ({
                                ...current,
                                colorBlindFriendly: event.target.checked,
                            }))
                        }
                    />
                    <span>
                        <strong>Colour-blind friendly palette</strong>
                        <small>
                            Use safer accent colours for charts and highlights.
                        </small>
                    </span>
                </label>
            </div>
        </SectionCard>
    );
}
