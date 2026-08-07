import Link from "next/link";
import DemoButton from "@/components/DemoButton";

const features = [
  {
    icon: "◈",
    title: "Room-based Layout",
    desc: "Organise assets across sections, floors, and rooms. Drag and drop items between locations with a live visual map of your building.",
  },
  {
    icon: "⚡",
    title: "Fault Tracking",
    desc: "Report equipment faults with photo evidence. Severity-based auto-escalation updates item status so nothing slips through the cracks.",
  },
  {
    icon: "📤",
    title: "Loan Management",
    desc: "Log equipment loans with borrower names and digital signatures drawn on-screen. One-tap returns with full history.",
  },
  {
    icon: "📊",
    title: "Reports & Export",
    desc: "Generate printable asset reports and export the full inventory as CSV at any time — ready to share with leadership.",
  },
  {
    icon: "🔍",
    title: "Search & Filter",
    desc: "Find any item instantly by name, type, tag, or status across the entire school — no more scrolling through spreadsheets.",
  },
  {
    icon: "🛠",
    title: "Repair Log",
    desc: "Attach repair records to each item with cost and technician notes, building a complete service history over time.",
  },
];

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#1e293b",
        fontFamily: "'Space Grotesk', sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          height: 60,
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              boxShadow: "0 0 12px rgba(99,102,241,0.2)",
              flexShrink: 0,
            }}
          >
            ◈
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#4338ca", lineHeight: 1.2 }}>
              Investory Map
            </div>
            <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.2 }}>
              School Asset Management
            </div>
          </div>
        </div>

        <Link
          href="/login"
          style={{
            padding: "8px 20px",
            background: "#3730a3",
            border: "1px solid #6366f1",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 13,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            textDecoration: "none",
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
        >
          Login →
        </Link>
      </nav>

      {/* Hero */}
      <section
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "80px 32px 60px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "4px 14px",
            background: "rgba(79,70,229,0.15)",
            border: "1px solid rgba(99,102,241,0.35)",
            borderRadius: 20,
            fontSize: 11,
            color: "#4f46e5",
            marginBottom: 28,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.08em",
          }}
        >
          v2.0 — Production Platform
        </div>

        <h1
          style={{
            fontSize: "clamp(36px, 6vw, 56px)",
            fontWeight: 600,
            margin: "0 0 20px",
            lineHeight: 1.15,
            background: "linear-gradient(135deg, #1e293b 30%, #4338ca)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Your school&apos;s AV &amp; IT gear,<br />always accounted for.
        </h1>

        <p
          style={{
            fontSize: 16,
            color: "#94a3b8",
            lineHeight: 1.7,
            margin: "0 0 36px",
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Investory Map replaces spreadsheets with a live, room-by-room map of
          every projector, camera, microphone, and device in your building.
          Track faults, loans, repairs, and movement — all in one place.
        </p>

        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              padding: "13px 36px",
              background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
              borderRadius: 8,
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              textDecoration: "none",
              boxShadow: "0 0 24px rgba(99,102,241,0.35)",
            }}
          >
            Go to Dashboard →
          </Link>
          <DemoButton />
          <DemoButton variant="teacher" />
        </div>
      </section>

      {/* Divider */}
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "0 32px",
          borderTop: "1px solid #e2e8f0",
        }}
      />

      {/* Features */}
      <section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "56px 32px 80px",
        }}
      >
        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#64748b",
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.1em",
            marginBottom: 40,
          }}
        >
          WHAT IT DOES
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "22px 20px",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 10 }}>{f.icon}</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#4338ca",
                  marginBottom: 8,
                }}
              >
                {f.title}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #e2e8f0",
          padding: "20px 32px",
          textAlign: "center",
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "'DM Mono', monospace",
        }}
      >
        Investory Map — Built for Damai Primary School AV/IT · 2026
      </footer>
    </div>
  );
}
