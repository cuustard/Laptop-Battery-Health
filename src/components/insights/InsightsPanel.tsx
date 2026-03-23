import { getInsightColors } from "../../lib/batteryInsights";
import type { Insight } from "../../types/battery";
import styles from "./InsightsPanel.module.css";

type InsightsPanelProps = {
  insights: Insight[];
};

export function InsightsPanel({ insights }: InsightsPanelProps) {
  return (
    <div className={styles.grid}>
      {insights.map((insight, index) => {
        const colors = getInsightColors(insight.severity);

        return (
          <div
            key={`${insight.title}-${index}`}
            className={styles.card}
            style={{
              background: colors.background,
              borderColor: colors.border,
            }}
          >
            <div className={styles.title} style={{ color: colors.title }}>
              {insight.title}
            </div>
            <div className={styles.description} style={{ color: colors.text }}>
              {insight.description}
            </div>
          </div>
        );
      })}
    </div>
  );
}
