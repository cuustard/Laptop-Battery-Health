export function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid #eaecf0",
            }}
        >
            <div
                style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#475467",
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: 15,
                    color: "#101828",
                    wordBreak: "break-word",
                }}
            >
                {value}
            </div>
        </div>
    );
}
