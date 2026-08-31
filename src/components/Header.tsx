"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";

interface HeaderProps {
  moveLogCount: number;
  isAdmin: boolean;
  onReportFault: () => void;
  onReport: () => void;
  onExportCSV: () => void;
  onImport: () => void;
  onMoveLog: () => void;
  onSettings: () => void;
  onProfile: () => void;
  userName: string;
  schoolName?: string;
  onResetDemo?: () => void;
}

const APP_TITLE = "Inventory Map";
const APP_SUBTITLE = "Room-based Asset & Inventory Manager";

function CsvDropdown({ onExportCSV }: { onExportCSV: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(!open);
  };

  return (
    <div ref={ref} style={{ flexShrink: 0 }}>
      <button ref={btnRef} className="btn" onClick={toggle}>⬇ CSV ▾</button>
      {open && (
        <div style={{
          position: "fixed", top: pos.top, left: pos.left,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,.1)", zIndex: 300, minWidth: 180,
          overflow: "hidden",
        }}>
          <button
            onClick={() => { onExportCSV(); setOpen(false); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontSize: 11, color: "#1e293b" }}
          >
            <strong>Export Inventory</strong>
            <div style={{ fontSize: 9, color: "#64748b" }}>Download current inventory as CSV</div>
          </button>
          <div style={{ borderTop: "1px solid #e2e8f0" }} />
          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = "/api/export/template";
              a.click();
              setOpen(false);
            }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontSize: 11, color: "#1e293b" }}
          >
            <strong>Download Template</strong>
            <div style={{ fontSize: 9, color: "#64748b" }}>Blank CSV with sample row to get started</div>
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header({
  moveLogCount, isAdmin, onReportFault, onReport, onExportCSV, onImport, onMoveLog, onSettings, onProfile, userName, schoolName, onResetDemo,
}: HeaderProps) {
  return (
    <div style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
      {schoolName === "Demo School" && (
        <div style={{
          background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
          color: "#fff",
          padding: "6px 16px",
          fontSize: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          <span>Demo Mode — Explore all features freely</span>
          <button
            onClick={onResetDemo}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 4,
              color: "#fff",
              fontSize: 10,
              padding: "3px 10px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reset Demo
          </button>
        </div>
      )}
      {/* Row 1: Logo + user (clickable) + sign out */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 0 12px rgba(99,102,241,0.2)", flexShrink: 0 }}>◈</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 16, color: "#4338ca", letterSpacing: "-.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{APP_TITLE}</div>
            <div style={{ fontSize: 9, color: "#94a3b8" }}>{APP_SUBTITLE}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {userName && (
            <button
              className="btn"
              onClick={onProfile}
              title="Profile / Change Password"
              style={{ fontSize: 11, color: "#4338ca", padding: "4px 10px" }}
            >
              👤 {userName}
            </button>
          )}
          <button className="btn" onClick={() => signOut({ callbackUrl: "/login" })} style={{ color: "#ef4444" }}>Sign Out</button>
        </div>
      </div>
      {/* Row 2: Action buttons — scroll horizontally on small screens */}
      <div style={{ display: "flex", gap: 6, padding: "0 16px 8px", overflowX: "auto", scrollbarWidth: "none" }}>
        <button
          className="btn"
          onClick={onReportFault}
          style={{ color: "#b45309", background: "#fffbeb", borderColor: "#fcd34d", fontWeight: 600, flexShrink: 0 }}
        >
          ⚠ Report Fault
        </button>
        <button className="btn" onClick={onReport} style={{ color: "#4338ca", flexShrink: 0 }}>📊 Report</button>
        <CsvDropdown onExportCSV={onExportCSV} />
        {isAdmin && <button className="btn" onClick={onImport} style={{ flexShrink: 0 }}>⬆ Import</button>}
        <button className="btn" onClick={onMoveLog} style={{ flexShrink: 0 }}>📋 Log ({moveLogCount})</button>
        {isAdmin && <button className="btn" onClick={onSettings} style={{ flexShrink: 0 }}>⚙ Sections</button>}
      </div>
    </div>
  );
}
