"use client";

import React, { useState } from "react";
import type { Item } from "@/components/ItemChip";
import { SEV_COLORS, FAULT_TYPES, fmtDate } from "@/lib/constants";

interface FaultWithItem {
  id: string;
  faultType: string;
  severity: string;
  description?: string | null;
  reportedBy?: string | null;
  resolvedBy?: string | null;
  photos?: string[];
  date: string;
  status: string;
  item: Item;
}

export interface FaultReportData {
  id: string;
  roomName: string;
  faultType: string;
  severity: string;
  description?: string | null;
  reportedBy: string;
  photos?: string[];
  status: string;
  createdAt: string;
  // The GET /api/fault-reports route currently returns the raw Prisma field
  // `locationName` (not remapped to `location` like other item routes) —
  // accept both so the UI keeps working if that's ever normalised.
  item: { id: string; label: string; type: string; location?: string; locationName?: string };
}

interface FaultsViewProps {
  items: Item[];
  onSelectItem: (item: Item) => void;
  onUpdateFault: (itemId: string, faultId: string, patch: { status: string }) => void;
  setLightbox: (src: string) => void;
  isAdmin?: boolean;
  pendingReports?: FaultReportData[];
  onReviewReport?: (reportId: string, data: { action: "approve" | "reject"; severity?: string; faultType?: string; reviewNote?: string }) => void;
  faultTypes?: string[];
}

const SEV_ORDER: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const FAULT_STATUS_ORDER: Record<string, number> = { Open: 1, "In Progress": 2, Resolved: 3 };
const SEVERITY_OPTIONS = ["Low", "Medium", "High", "Critical"];

export default function FaultsView({ items, onSelectItem, onUpdateFault, setLightbox, isAdmin, pendingReports, onReviewReport, faultTypes }: FaultsViewProps) {
  const [sf, setSf] = useState("Open");
  const [sv, setSv] = useState("All");
  const [sortField, setSortField] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingCollapsed, setPendingCollapsed] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [editSeverity, setEditSeverity] = useState("");
  const [editFaultType, setEditFaultType] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  const faultTypeOptions = faultTypes && faultTypes.length > 0 ? faultTypes : [...FAULT_TYPES];

  const startReview = (report: FaultReportData, action: "approve" | "reject") => {
    setReviewingId(report.id);
    setReviewAction(action);
    setEditSeverity(report.severity);
    setEditFaultType(report.faultType);
    setReviewNote("");
  };

  const cancelReview = () => {
    setReviewingId(null);
    setReviewAction(null);
    setEditSeverity("");
    setEditFaultType("");
    setReviewNote("");
  };

  const confirmReview = (reportId: string) => {
    if (!onReviewReport || !reviewAction) return;
    if (reviewAction === "approve") {
      onReviewReport(reportId, {
        action: "approve",
        severity: editSeverity,
        faultType: editFaultType,
        reviewNote: reviewNote.trim() || undefined,
      });
    } else {
      onReviewReport(reportId, {
        action: "reject",
        reviewNote: reviewNote.trim() || undefined,
      });
    }
    cancelReview();
  };

  const all = items
    .flatMap(i =>
      ((i.faults || []) as unknown as FaultWithItem[]).map(f => ({ ...f, item: i }))
    );

  const filtered = all.filter(
    f => (sf === "All" || f.status === sf) && (sv === "All" || f.severity === sv)
  );

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "date") {
      cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortField === "severity") {
      cmp = (SEV_ORDER[a.severity] || 0) - (SEV_ORDER[b.severity] || 0);
    } else if (sortField === "status") {
      cmp = (FAULT_STATUS_ORDER[a.status] || 0) - (FAULT_STATUS_ORDER[b.status] || 0);
    } else if (sortField === "item") {
      cmp = a.item.label.localeCompare(b.item.label);
    } else if (sortField === "faultType") {
      cmp = a.faultType.localeCompare(b.faultType);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div>
      {isAdmin && pendingReports && pendingReports.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            onClick={() => setPendingCollapsed(c => !c)}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: pendingCollapsed ? 0 : 8, userSelect: "none" }}
          >
            <span style={{ fontSize: 10, color: "#d97706", display: "inline-block", transform: pendingCollapsed ? "rotate(-90deg)" : "none", transition: "transform .15s" }}>
              ▾
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#d97706" }}>
              Pending Teacher Reports ({pendingReports.length})
            </span>
          </div>
          {!pendingCollapsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingReports.map(r => {
                const sc = SEV_COLORS[r.severity] ?? SEV_COLORS.Low;
                const isReviewing = reviewingId === r.id;
                const itemLocation = r.item.location ?? r.item.locationName ?? r.roomName;
                const fullItem = items.find(i => i.id === r.item.id);
                return (
                  <div
                    key={r.id}
                    style={{ background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "3px solid #f59e0b", borderRadius: 7, padding: "10px 12px" }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                          <span className="badge" style={{ background: sc.bg, color: sc.text }}>
                            {r.severity}
                          </span>
                          <span
                            style={fullItem ? { fontSize: 12, color: "#4f46e5", cursor: "pointer" } : { fontSize: 12, fontWeight: 500 }}
                            onClick={fullItem ? () => onSelectItem(fullItem) : undefined}
                          >
                            {r.item.label}
                          </span>
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>@ {r.roomName}</span>
                          <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
                            {fmtDate(r.createdAt)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{r.faultType}</div>
                        {r.description && (
                          <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{r.description}</div>
                        )}
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>Reported by: {r.reportedBy}</div>
                        {itemLocation && itemLocation !== r.roomName && (
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>Currently in: {itemLocation}</div>
                        )}
                        {(r.photos || []).length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                            {(r.photos || []).map((p, i) => (
                              <img
                                key={i}
                                src={p}
                                alt=""
                                style={{
                                  width: 52,
                                  height: 52,
                                  objectFit: "cover",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  border: "1px solid #cbd5e1",
                                }}
                                onClick={() => setLightbox(p)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      {!isReviewing && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            className="btn"
                            onClick={() => startReview(r, "approve")}
                            style={{ fontSize: 10, padding: "4px 10px", background: "#dcfce7", borderColor: "#16a34a", color: "#16a34a" }}
                          >
                            ✓ Approve
                          </button>
                          <button
                            className="btn"
                            onClick={() => startReview(r, "reject")}
                            style={{ fontSize: 10, padding: "4px 10px", background: "#fee2e2", borderColor: "#ef4444", color: "#dc2626" }}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {isReviewing && reviewAction === "approve" && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #fde68a", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Severity</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {SEVERITY_OPTIONS.map(s => {
                              const c = SEV_COLORS[s];
                              const active = editSeverity === s;
                              return (
                                <button
                                  key={s}
                                  className="btn"
                                  onClick={() => setEditSeverity(s)}
                                  style={active ? { background: c.bg, borderColor: c.text, color: c.text } : {}}
                                >
                                  {s}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Fault Type</div>
                          <select
                            value={editFaultType}
                            onChange={e => setEditFaultType(e.target.value)}
                            style={{ maxWidth: 240 }}
                          >
                            {faultTypeOptions.map(ft => (
                              <option key={ft}>{ft}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          placeholder="Note (optional)"
                          value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)}
                          style={{ minHeight: 50, resize: "vertical" }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-primary" onClick={() => confirmReview(r.id)} style={{ fontSize: 10, padding: "5px 12px" }}>
                            Confirm Approve
                          </button>
                          <button className="btn" onClick={cancelReview} style={{ fontSize: 10, padding: "5px 12px" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {isReviewing && reviewAction === "reject" && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #fde68a", display: "flex", flexDirection: "column", gap: 8 }}>
                        <textarea
                          placeholder="Reason for rejection (optional)"
                          value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)}
                          style={{ minHeight: 50, resize: "vertical" }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn"
                            onClick={() => confirmReview(r.id)}
                            style={{ fontSize: 10, padding: "5px 12px", background: "#fee2e2", borderColor: "#ef4444", color: "#dc2626" }}
                          >
                            Confirm Reject
                          </button>
                          <button className="btn" onClick={cancelReview} style={{ fontSize: 10, padding: "5px 12px" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        {["All", "Open", "In Progress", "Resolved"].map(s => (
          <button
            key={s}
            className="btn"
            onClick={() => setSf(s)}
            style={sf === s ? { background: "#ede9fe", borderColor: "#6366f1", color: "#4338ca" } : {}}
          >
            {s}
          </button>
        ))}
        <select
          value={sv}
          onChange={e => setSv(e.target.value)}
          style={{ width: 120, marginLeft: "auto" }}
        >
          <option value="All">All Severity</option>
          {["Low", "Medium", "High", "Critical"].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={`${sortField}-${sortDir}`}
          onChange={e => {
            const [f, d] = e.target.value.split("-");
            setSortField(f);
            setSortDir(d as "asc" | "desc");
          }}
          style={{ width: 150 }}
        >
          <option value="date-desc">Date (Newest)</option>
          <option value="date-asc">Date (Oldest)</option>
          <option value="severity-desc">Severity (High→Low)</option>
          <option value="severity-asc">Severity (Low→High)</option>
          <option value="status-asc">Status (Open→Resolved)</option>
          <option value="status-desc">Status (Resolved→Open)</option>
          <option value="item-asc">Item Name (A→Z)</option>
          <option value="item-desc">Item Name (Z→A)</option>
          <option value="faultType-asc">Fault Type (A→Z)</option>
          <option value="faultType-desc">Fault Type (Z→A)</option>
        </select>
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>{sorted.length} faults</div>
      {sorted.length === 0 && (
        <div style={{ textAlign: "center", color: "#94a3b8", padding: 40, fontSize: 13 }}>
          No faults matching filter
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map(f => {
          const sc2 = SEV_COLORS[f.severity] ?? SEV_COLORS.Low;
          return (
            <div
              key={f.id}
              style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 7, padding: "10px 12px" }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                    <span className="badge" style={{ background: sc2.bg, color: sc2.text }}>
                      {f.severity}
                    </span>
                    <span
                      style={{ fontSize: 12, color: "#4f46e5", cursor: "pointer" }}
                      onClick={() => onSelectItem(f.item)}
                    >
                      {f.item.label}
                    </span>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>@ {f.item.location}</span>
                    <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
                      {fmtDate(f.date)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{f.faultType}</div>
                  {f.description && (
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{f.description}</div>
                  )}
                  {f.reportedBy && (
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>By: {f.reportedBy}</div>
                  )}
                  {f.resolvedBy && (
                    <div style={{ fontSize: 10, color: "#16a34a", marginTop: 2 }}>
                      Resolved by {f.resolvedBy}
                    </div>
                  )}
                  {(f.photos || []).length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                      {(f.photos || []).map((p, i) => (
                        <img
                          key={i}
                          src={p}
                          alt=""
                          style={{
                            width: 52,
                            height: 52,
                            objectFit: "cover",
                            borderRadius: 4,
                            cursor: "pointer",
                            border: "1px solid #cbd5e1",
                          }}
                          onClick={() => setLightbox(p)}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <select
                  value={f.status}
                  onChange={e => onUpdateFault(f.item.id, f.id, { status: e.target.value })}
                  style={{ width: 120, fontSize: 10, padding: "3px 6px" }}
                >
                  <option>Open</option>
                  <option>In Progress</option>
                  <option>Resolved</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
