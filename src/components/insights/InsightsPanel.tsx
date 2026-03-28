import type { Insight } from "../../types/battery";
import styles from "./InsightsPanel.module.css";

type InsightsPanelProps = {
    insights: Insight[];
};

function getSeverityClassName(
    severity: Insight["severity"],
    type: "card" | "title" | "description"
): string {
    switch (severity) {
        case "good":
            return type === "card"
                ? styles.good
                : type === "title"
                ? styles.titleGood
                : styles.descriptionGood;
        case "warning":
            return type === "card"
                ? styles.warning
                : type === "title"
                ? styles.titleWarning
                : styles.descriptionWarning;
        default:
            return type === "card"
                ? styles.neutral
                : type === "title"
                ? styles.titleNeutral
                : styles.descriptionNeutral;
    }
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
    return (
        <div className={styles.grid}>
            {insights.map((insight, index) => (
                <div
                    key={`${insight.title}-${index}`}
                    className={`${styles.card} ${getSeverityClassName(
                        insight.severity,
                        "card"
                    )}`}
                >
                    <div
                        className={`${styles.title} ${getSeverityClassName(
                            insight.severity,
                            "title"
                        )}`}
                    >
                        {insight.title}
                    </div>
                    <div
                        className={`${
                            styles.description
                        } ${getSeverityClassName(
                            insight.severity,
                            "description"
                        )}`}
                    >
                        {insight.description}
                    </div>
                </div>
            ))}
        </div>
    );
}
