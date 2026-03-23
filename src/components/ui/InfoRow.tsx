import styles from "./InfoRow.module.css";

type InfoRowProps = {
    label: string;
    value: string;
};

export function InfoRow({ label, value }: InfoRowProps) {
    return (
        <div className={styles.row}>
            <div className={styles.label}>{label}</div>
            <div className={styles.value}>{value}</div>
        </div>
    );
}
