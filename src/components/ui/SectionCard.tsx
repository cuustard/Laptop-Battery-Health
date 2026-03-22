export function SectionCard({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section
            style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 24,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
        >
            <div style={{ marginBottom: 18 }}>
                <h2
                    style={{
                        margin: 0,
                        fontSize: 22,
                        lineHeight: 1.2,
                        fontWeight: 700,
                        color: "#101828",
                        letterSpacing: "-0.02em",
                    }}
                >
                    {title}
                </h2>
                {description && (
                    <p
                        style={{
                            margin: "8px 0 0",
                            fontSize: 14,
                            color: "#667085",
                        }}
                    >
                        {description}
                    </p>
                )}
            </div>
            {children}
        </section>
    );
}
