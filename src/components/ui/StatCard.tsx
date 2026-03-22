export function StatCard({
    label,
    value,
    helper,
}: {
    label: string;
    value: string;
    helper?: string;
}) {
    return (
        <section
            aria-label={label}
            style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
        >
            <div
                style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#475467",
                    marginBottom: 12,
                }}
            >
                {label}
            </div>

            <div
                style={{
                    fontSize: 32,
                    lineHeight: 1.1,
                    fontWeight: 700,
                    color: "#101828",
                    letterSpacing: "-0.02em",
                }}
            >
                {value}
            </div>

            {helper && (
                <div
                    style={{
                        marginTop: 10,
                        fontSize: 14,
                        color: "#667085",
                    }}
                >
                    {helper}
                </div>
            )}
        </section>
    );
}
