import styles from "./StatCard.module.css";

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <section aria-label={label} className={styles.card}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {helper && <div className={styles.helper}>{helper}</div>}
    </section>
  );
}
