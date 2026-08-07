"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { Item } from "@/components/ItemChip";
import {
  getStatusColor,
  getTypeIcon,
  isExpired,
  expiringSoon,
  fmtDate,
  SEV_COLORS,
} from "@/lib/constants";

// --- Internal types -------------------------------------------------------

interface FaultEntry {
  id: string;
  severity: string;
  faultType: string;
  description?: string | null;
  reportedBy?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
  photos?: string[];
  date: string;
  status: string;
}

interface RepairEntry {
  id: string;
  description: string;
  technician?: string;
  startDate?: string;
  completeDate?: string;
  cost?: number | null;
  notes?: string;
  createdAt: string;
}

interface MoveEntry {
  id: string;
  from: string;
  to: string;
  reason: string;
  movedBy?: string;
  date: string;
}

interface LoanEntry {
  id: string;
  borrowerName: string;
  dateOut: string;
  dateIn?: string;
  expectedReturn?: string;
  signature?: string | null;
  status: string;
}

interface DetailPanelProps {
  item: Item;
  detailTab: string;
  setDetailTab: (tab: string) => void;
  onClose: () => void;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onAddRepair: (repair: Record<string, unknown>) => void;
  onReportFault: () => void;
  onUpdateFault: (faultId: string, patch: Record<string, unknown>) => void;
  onMove: () => void;
  onLoanOut: () => void;
  onReturn: () => void;
  setLightbox: (src: string) => void;
  allLocations: string[];
  itemTypes: string[];
  typeIcons?: Record<string, string>;
}

// --- RemarkCommentDisplay (named export) ----------------------------------

export function RemarkCommentDisplay({
  remark,
  comment,
}: {
  remark?: string;
  comment?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
      <div>
        <div style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>REMARK (item info)</div>
        <div
          style={{
            fontSize: 11,
            color: "#475569",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 4,
            padding: "5px 8px",
            minHeight: 26,
          }}
        >
          {remark || <span style={{ color: "#cbd5e1" }}>—</span>}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>COMMENT (admin note)</div>
        <div
          style={{
            fontSize: 11,
            color: "#475569",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 4,
            padding: "5px 8px",
            minHeight: 26,
          }}
        >
          {comment || <span style={{ color: "#cbd5e1" }}>—</span>}
        </div>
      </div>
    </div>
  );
}

// --- RemarkCommentFields (named export) -----------------------------------

export function RemarkCommentFields({
  remark,
  comment,
  onChange,
}: {
  remark: string;
  comment: string;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <label style={{ fontSize: 10, color: "#64748b" }}>Remark (item info)</label>
          <span style={{ fontSize: 9, color: remark.length > 270 ? "#ef4444" : "#64748b" }}>
            {remark.length}/300
          </span>
        </div>
        <textarea
          rows={2}
          maxLength={300}
          value={remark}
          onChange={e => onChange("remark", e.target.value.slice(0, 300))}
          placeholder="Additional info about this item..."
        />
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <label style={{ fontSize: 10, color: "#64748b" }}>Comment (admin note)</label>
          <span style={{ fontSize: 9, color: comment.length > 270 ? "#ef4444" : "#64748b" }}>
            {comment.length}/300
          </span>
        </div>
        <textarea
          rows={2}
          maxLength={300}
          value={comment}
          onChange={e => onChange("comment", e.target.value.slice(0, 300))}
          placeholder="Admin observations..."
        />
      </div>
    </div>
  );
}

// --- DetailPanel (default export) -----------------------------------------

export default function DetailPanel({
  item,
  detailTab,
  setDetailTab,
  onClose,
  onUpdate,
  onDelete,
  onAddRepair,
  onReportFault,
  onUpdateFault,
  onMove,
  onLoanOut,
  onReturn,
  setLightbox,
  allLocations,
  itemTypes,
  typeIcons,
}: DetailPanelProps) {
  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 10, y: 10 };
    const panelW = Math.min(360, window.innerWidth - 20);
    return {
      x: Math.max(10, Math.floor((window.innerWidth - panelW) / 2)),
      y: Math.max(10, Math.floor(window.innerHeight / 2 - 280)),
    };
  });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const winRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".no-drag")) return;
    setDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;
      const panelW = Math.min(360, window.innerWidth - 10);
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - panelW, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 80, e.clientY - dragOffset.current.y)),
      });
    },
    [dragging]
  );

  const onMouseUp = () => setDragging(false);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, onMouseMove]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editing && !showRepair) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editing, showRepair, onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest(".no-drag")) return;
    const t = e.touches[0];
    dragOffset.current = { x: t.clientX - pos.x, y: t.clientY - pos.y };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const panelW = Math.min(360, window.innerWidth - 10);
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - panelW, t.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 80, t.clientY - dragOffset.current.y)),
    });
  };

  const s = getStatusColor(item.status);
  const openF = (item.faults || []).filter(f => f.status !== "Resolved").length;
  const [editing, setEditing] = useState(false);
  const [ed, setEd] = useState<Record<string, unknown>>({});
  const [repairForm, setRepairForm] = useState({
    description: "",
    technician: "",
    cost: "",
    startDate: "",
    completeDate: "",
    notes: "",
  });
  const [showRepair, setShowRepair] = useState(false);

  return (
    <div
      ref={winRef}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: "min(360px, calc(100vw - 20px))",
        maxHeight: "min(82vh, calc(100dvh - 20px))",
        background: "rgba(255,255,255,0.97)",
        border: `1px solid ${s.border}`,
        borderRadius: 12,
        boxShadow: `0 0 0 1px rgba(99,102,241,0.15), 0 8px 40px rgba(15,23,42,0.4), 0 0 20px ${s.border}22`,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        backdropFilter: "blur(12px)",
        userSelect: dragging ? "none" : "auto",
        transition: dragging ? "none" : "box-shadow 0.2s",
      }}
    >
      {/* Title bar — drag handle */}
      <div
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        style={{
          padding: "10px 14px 8px",
          borderBottom: "1px solid #e2e8f0",
          cursor: dragging ? "grabbing" : "grab",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          borderRadius: "12px 12px 0 0",
          background: "linear-gradient(135deg,rgba(248,250,252,0.95),rgba(241,245,249,0.95))",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "#4f46e5",
            fontFamily: "'Space Grotesk',sans-serif",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {item.label}
        </span>
        <span style={{ fontSize: 9, color: "#94a3b8", flexShrink: 0 }}>⠿ drag</span>
        <button
          className="no-drag"
          onClick={onClose}
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid #ef4444",
            color: "#dc2626",
            width: 22,
            height: 22,
            borderRadius: 5,
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontWeight: "bold",
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Status + action bar */}
      <div
        className="no-drag"
        style={{ padding: "8px 14px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}
      >
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          <span className="badge" style={{ background: s.badge, color: s.text }}>
            {item.status}
          </span>
          {openF > 0 && (
            <span className="badge" style={{ background: "#fee2e2", color: "#dc2626" }}>
              ⚠ {openF}
            </span>
          )}
          {item.isLoaned && (
            <span className="badge" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
              📤 {item.loanedTo}
            </span>
          )}
          {item.assetCode && (
            <span className="badge" style={{ background: "#e2e8f0", color: "#64748b" }}>
              #{item.assetCode}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn no-drag" style={{ fontSize: 9, padding: "3px 8px" }} onClick={onMove}>
            ⇄ Move
          </button>
          {item.loanable && !item.isLoaned && (
            <button
              className="btn no-drag"
              style={{
                fontSize: 9,
                padding: "3px 8px",
                background: "#d1fae5",
                borderColor: "#059669",
                color: "#047857",
              }}
              onClick={onLoanOut}
            >
              📤 Loan
            </button>
          )}
          {item.isLoaned && (
            <button
              className="btn no-drag"
              style={{
                fontSize: 9,
                padding: "3px 8px",
                background: "#dbeafe",
                borderColor: "#3b82f6",
                color: "#1d4ed8",
              }}
              onClick={onReturn}
            >
              ↩ Return
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            className="btn no-drag"
            style={{ fontSize: 9, padding: "3px 8px", color: "#b45309", background: "#fffbeb", borderColor: "#fcd34d", fontWeight: 600 }}
            onClick={onReportFault}
          >
            ⚠ Report Fault
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="no-drag"
        style={{
          display: "flex",
          gap: 2,
          padding: "6px 14px 0",
          borderBottom: "1px solid #e2e8f0",
          flexShrink: 0,
        }}
      >
        {(
          [
            ["details", "Details"],
            ["faults", `Faults${openF > 0 ? " (" + openF + ")" : ""}`],
            ["repairs", "Repairs"],
            ["history", "History"],
          ] as [string, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            className="tab-btn no-drag"
            onClick={() => setDetailTab(k)}
            style={{
              padding: "3px 9px",
              fontSize: 10,
              borderRadius: "4px 4px 0 0",
              background: detailTab === k ? "#ede9fe" : "none",
              color: detailTab === k ? "#4338ca" : "#64748b",
              border: detailTab === k ? "1px solid #cbd5e1" : "1px solid transparent",
              borderBottom: "none",
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        className="no-drag"
        style={{ flex: 1, overflowY: "auto", padding: "12px 14px", minHeight: 0 }}
      >
        {/* DETAILS TAB */}
        {detailTab === "details" &&
          (editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {(
                [
                  ["label", "Label"],
                  ["assetCode", "Asset Code"],
                  ["brand", "Brand"],
                  ["model", "Model"],
                  ["serial", "Serial No."],
                  ["cost", "Cost ($)"],
                ] as [string, string][]
              ).map(([k, l]) => (
                <div key={k}>
                  <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>
                    {l}
                  </label>
                  <input
                    value={(ed[k] as string) || ""}
                    onChange={e => setEd(d => ({ ...d, [k]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>
                  Location
                </label>
                <select
                  value={(ed.location as string) || ""}
                  onChange={e => setEd(d => ({ ...d, location: e.target.value }))}
                >
                  {allLocations.map(l => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>
                  Warranty End
                </label>
                <input
                  type="date"
                  value={(ed.warrantyEnd as string) || ""}
                  onChange={e => setEd(d => ({ ...d, warrantyEnd: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>
                  Type
                </label>
                <select
                  value={(ed.type as string) || ""}
                  onChange={e => setEd(d => ({ ...d, type: e.target.value }))}
                >
                  {itemTypes.map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>
                  Status
                </label>
                <select
                  value={(ed.status as string) || ""}
                  onChange={e => setEd(d => ({ ...d, status: e.target.value }))}
                >
                  {[
                    "Operational",
                    "Spare",
                    "Under Maintenance",
                    "Waiting for Condemnation",
                    "Others",
                  ].map(st => (
                    <option key={st}>{st}</option>
                  ))}
                </select>
                {ed.status === "Others" && (
                  <input
                    placeholder="Describe status..."
                    value={(ed.statusNote as string) || ""}
                    onChange={e => setEd(d => ({ ...d, statusNote: e.target.value }))}
                    style={{ marginTop: 4 }}
                  />
                )}
              </div>
              <label
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!ed.loanable}
                  onChange={e => setEd(d => ({ ...d, loanable: e.target.checked }))}
                  style={{ width: "auto" }}
                />{" "}
                Loanable
              </label>
              <RemarkCommentFields
                remark={(ed.remark as string) || ""}
                comment={(ed.comment as string) || ""}
                onChange={(k, v) => setEd(d => ({ ...d, [k]: v }))}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    onUpdate(ed);
                    setEditing(false);
                  }}
                  style={{ flex: 1 }}
                >
                  Save
                </button>
                <button className="btn" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{typeIcons?.[item.type] || getTypeIcon(item.type)}</span> {item.type} · {item.brand} {item.model}
              </div>
              <div style={{ display: "grid", gap: 3, marginBottom: 10 }}>
                {(
                  [
                    ["Asset Code", item.assetCode || "—"],
                    ["Location", item.location],
                    ["Serial", item.serial || "—"],
                    [
                      "Cost",
                      item.cost ? `$${Number(item.cost).toLocaleString()}` : "—",
                    ],
                    [
                      "Warranty",
                      item.warrantyEnd ? (
                        <span
                          style={{
                            color: isExpired(item.warrantyEnd)
                              ? "#ef4444"
                              : expiringSoon(item.warrantyEnd)
                              ? "#d97706"
                              : "#16a34a",
                          }}
                        >
                          {fmtDate(item.warrantyEnd)}
                          {isExpired(item.warrantyEnd)
                            ? " ✗"
                            : expiringSoon(item.warrantyEnd)
                            ? " ⚠"
                            : ""}
                        </span>
                      ) : (
                        "—"
                      ),
                    ],
                    ["Loanable", item.loanable ? "Yes ✓" : "No"],
                  ] as [string, React.ReactNode][]
                ).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "3px 0",
                      borderBottom: "1px solid #ffffff",
                      fontSize: 11,
                    }}
                  >
                    <span style={{ color: "#64748b" }}>{k}</span>
                    <span
                      style={{
                        color: "#1e293b",
                        textAlign: "right",
                        maxWidth: "60%",
                        wordBreak: "break-all",
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
              {(item.statusNote as string | undefined) && (
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                  Status note: {item.statusNote as string}
                </div>
              )}
              <RemarkCommentDisplay
                remark={item.remark as string | undefined}
                comment={item.comment as string | undefined}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button
                  className="btn"
                  onClick={() => {
                    setEd({ ...item });
                    setEditing(true);
                  }}
                  style={{ flex: 1, fontSize: 11 }}
                >
                  ✏ Edit
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    if (confirm("Delete this item?")) onDelete();
                  }}
                  style={{ fontSize: 11 }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}

        {/* FAULTS TAB */}
        {detailTab === "faults" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {(item.faults || []).length === 0 && (
              <div style={{ color: "#cbd5e1", fontSize: 12, textAlign: "center", padding: 20 }}>
                No fault records
              </div>
            )}
            {(item.faults as unknown as FaultEntry[]).map(f => {
              const sc2 = SEV_COLORS[f.severity] || SEV_COLORS.Low;
              return (
                <div
                  key={f.id}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 5,
                    padding: 9,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 5,
                      alignItems: "center",
                      marginBottom: 3,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className="badge"
                      style={{ background: sc2.bg, color: sc2.text, fontSize: 9 }}
                    >
                      {f.severity}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500 }}>{f.faultType}</span>
                    <span style={{ fontSize: 9, color: "#cbd5e1", marginLeft: "auto" }}>
                      {fmtDate(f.date)}
                    </span>
                  </div>
                  {f.description && (
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 3 }}>
                      {f.description}
                    </div>
                  )}
                  {f.reportedBy && (
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>
                      By: {f.reportedBy}
                    </div>
                  )}
                  {f.resolvedBy && (
                    <div style={{ fontSize: 10, color: "#16a34a", marginBottom: 3 }}>
                      Resolved by {f.resolvedBy}: {f.resolutionNote}
                    </div>
                  )}
                  {(f.photos || []).length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        flexWrap: "wrap",
                        marginBottom: 5,
                      }}
                    >
                      {(f.photos || []).map((p, i) => (
                        <img
                          key={i}
                          src={p}
                          alt=""
                          style={{
                            width: 48,
                            height: 48,
                            objectFit: "cover",
                            borderRadius: 3,
                            cursor: "pointer",
                            border: "1px solid #cbd5e1",
                          }}
                          onClick={() => setLightbox(p)}
                        />
                      ))}
                    </div>
                  )}
                  <select
                    value={f.status}
                    onChange={e => {
                      if (e.target.value === "Resolved") {
                        const by = window.prompt("Resolved by:");
                        const note = window.prompt("Resolution note:");
                        onUpdateFault(f.id, {
                          status: "Resolved",
                          resolvedBy: by || "",
                          resolutionNote: note || "",
                        });
                      } else {
                        onUpdateFault(f.id, { status: e.target.value });
                      }
                    }}
                    style={{ fontSize: 10, padding: "2px 5px", width: "auto" }}
                  >
                    <option>Open</option>
                    <option>In Progress</option>
                    <option>Resolved</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}

        {/* REPAIRS TAB */}
        {detailTab === "repairs" && (
          <div>
            <button
              className="btn"
              onClick={() => setShowRepair(!showRepair)}
              style={{ width: "100%", marginBottom: 8, fontSize: 11 }}
            >
              + Log Repair
            </button>
            {showRepair && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 5,
                  padding: 9,
                  marginBottom: 9,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <input
                  placeholder="Description *"
                  value={repairForm.description}
                  onChange={e => setRepairForm(f => ({ ...f, description: e.target.value }))}
                />
                <input
                  placeholder="Technician"
                  value={repairForm.technician}
                  onChange={e => setRepairForm(f => ({ ...f, technician: e.target.value }))}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div>
                    <label style={{ fontSize: 9, color: "#64748b" }}>Start Date</label>
                    <input
                      type="date"
                      value={repairForm.startDate}
                      onChange={e => setRepairForm(f => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: "#64748b" }}>Complete</label>
                    <input
                      type="date"
                      value={repairForm.completeDate}
                      onChange={e => setRepairForm(f => ({ ...f, completeDate: e.target.value }))}
                    />
                  </div>
                </div>
                <input
                  placeholder="Cost ($)"
                  type="number"
                  value={repairForm.cost}
                  onChange={e => setRepairForm(f => ({ ...f, cost: e.target.value }))}
                />
                <textarea
                  placeholder="Notes"
                  rows={2}
                  value={repairForm.notes}
                  onChange={e => setRepairForm(f => ({ ...f, notes: e.target.value }))}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!repairForm.description) return;
                    onAddRepair(repairForm);
                    setRepairForm({
                      description: "",
                      technician: "",
                      cost: "",
                      startDate: "",
                      completeDate: "",
                      notes: "",
                    });
                    setShowRepair(false);
                  }}
                  style={{ fontSize: 11 }}
                >
                  Save
                </button>
              </div>
            )}
            {(item.repairs as unknown as RepairEntry[] | undefined || []).length === 0 && (
              <div style={{ color: "#cbd5e1", fontSize: 12, textAlign: "center", padding: 20 }}>
                No repair records
              </div>
            )}
            {(item.repairs as unknown as RepairEntry[] | undefined || []).map(r => (
              <div
                key={r.id}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 5,
                  padding: 9,
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 500 }}>{r.description}</span>
                  <span style={{ fontSize: 9, color: "#cbd5e1" }}>{fmtDate(r.createdAt)}</span>
                </div>
                {r.technician && (
                  <div style={{ fontSize: 10, color: "#64748b" }}>Tech: {r.technician}</div>
                )}
                {r.startDate && (
                  <div style={{ fontSize: 10, color: "#64748b" }}>
                    Start: {fmtDate(r.startDate)}
                    {r.completeDate ? ` → ${fmtDate(r.completeDate)}` : ""}
                  </div>
                )}
                {r.cost != null && (
                  <div style={{ fontSize: 10, color: "#16a34a" }}>Cost: ${r.cost}</div>
                )}
                {r.notes && (
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>{r.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* HISTORY TAB */}
        {detailTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, color: "#4f46e5", marginBottom: 4 }}>Movement Log</div>
            {(item.moveLog as unknown as MoveEntry[] | undefined || []).length === 0 && (
              <div style={{ color: "#cbd5e1", fontSize: 11, textAlign: "center", padding: 12 }}>
                No movements
              </div>
            )}
            {(item.moveLog as unknown as MoveEntry[] | undefined || []).map(m => (
              <div
                key={m.id}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 5,
                  padding: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>
                    {m.from} → {m.to}
                  </span>
                  <span style={{ fontSize: 9, color: "#cbd5e1" }}>{fmtDate(m.date)}</span>
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>Reason: {m.reason}</div>
                {m.movedBy && (
                  <div style={{ fontSize: 10, color: "#64748b" }}>By: {m.movedBy}</div>
                )}
              </div>
            ))}
            <div style={{ fontSize: 10, color: "#4f46e5", marginTop: 6, marginBottom: 4 }}>
              Loan History
            </div>
            {(item.loanHistory as unknown as LoanEntry[] | undefined || []).length === 0 && (
              <div style={{ color: "#cbd5e1", fontSize: 11, textAlign: "center", padding: 12 }}>
                No loan records
              </div>
            )}
            {(item.loanHistory as unknown as LoanEntry[] | undefined || []).map(l => (
              <div
                key={l.id}
                style={{
                  background: "#f8fafc",
                  border: `1px solid ${l.status === "Active" ? "#6366f1" : "#e2e8f0"}`,
                  borderRadius: 5,
                  padding: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: l.status === "Active" ? "#4f46e5" : "#475569",
                    }}
                  >
                    {l.borrowerName}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: l.status === "Active" ? "#e0e7ff" : "#e2e8f0",
                      color: l.status === "Active" ? "#4338ca" : "#64748b",
                      fontSize: 9,
                    }}
                  >
                    {l.status}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>
                  Out: {fmtDate(l.dateOut)}
                  {l.dateIn ? ` · Returned: ${fmtDate(l.dateIn)}` : ""}
                </div>
                {l.expectedReturn && (
                  <div style={{ fontSize: 10, color: "#64748b" }}>
                    Expected: {fmtDate(l.expectedReturn)}
                  </div>
                )}
                {l.signature && (
                  <div style={{ fontSize: 10, color: "#16a34a", marginTop: 2 }}>✓ Signed</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
