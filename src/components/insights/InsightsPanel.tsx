import { getInsightColors } from "../../lib/batteryInsights";
import type { Insight } from "../../types/battery";

export function InsightsPanel({ insights }: { insights: Insight[] }) {
    return (
        <div
            style={{
                display: "grid",
                gap: 12,
            }}
        >
            {insights.map((insight, index) => {
                const colors = getInsightColors(insight.severity);

                return (
                    <div
                        key={`${insight.title}-${index}`}
                        style={{
                            background: colors.background,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 14,
                            padding: 16,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: colors.title,
                                marginBottom: 6,
                            }}
                        >
                            {insight.title}
                        </div>
                        <div
                            style={{
                                fontSize: 14,
                                lineHeight: 1.6,
                                color: colors.text,
                            }}
                        >
                            {insight.description}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
