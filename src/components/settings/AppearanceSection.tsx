import { SectionCard } from "../ui/SectionCard";
import type { AppPreferences, ThemeMode } from "../../types/settings";

type AppearanceSectionProps = {
    preferences: AppPreferences;
    setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
};

export function AppearanceSection({
    preferences,
    setPreferences,
}: AppearanceSectionProps) {
    return (
        <SectionCard
            title="Appearance"
            description="Control the app theme and how the interface looks."
        >
            <div className="settings-group">
                <label className="settings-field" htmlFor="theme-select">
                    <span className="settings-field__label">Theme</span>
                    <select
                        id="theme-select"
                        className="settings-select"
                        value={preferences.theme}
                        onChange={(event) =>
                            setPreferences((current) => ({
                                ...current,
                                theme: event.target.value as ThemeMode,
                            }))
                        }
                    >
                        <option value="system">System</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </label>
            </div>
        </SectionCard>
    );
}
