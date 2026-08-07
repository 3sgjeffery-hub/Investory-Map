"use client";

import React, { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { api } from "@/lib/api-client";
import { SEV_COLORS, fmtDate } from "@/lib/constants";

interface SectionData {
  name: string;
  rooms: Array<{ name: string }>;
}

interface ItemData {
  id: string;
  label: string;
  type: string;
  status: string;
  location: string;
}

interface FaultReportData {
  id: string;
  roomName: string;
  faultType: string;
  severity: string;
  description?: string | null;
  status: string;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  createdAt: string;
  item: { label: string; type: string };
}

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  Pending: { bg: "#fef3c7", text: "#92400e" },
  Approved: { bg: "#dcfce7", text: "#166534" },
  Rejected: { bg: "#fee2e2", text: "#991b1b" },
};

export default function ReportPage() {
  const { data: session } = useSession();
  const userName = (session?.user as { name?: string })?.name ?? "";
  const schoolName = (session?.user as { schoolName?: string })?.schoolName ?? "";

  const [sections, setSections] = useState<SectionData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [faultTypes, setFaultTypes] = useState<string[]>([]);
  const [myReports, setMyReports] = useState<FaultReportData[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [faultType, setFaultType] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [itemSearch, setItemSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [sec, itm, ft, reports] = await Promise.all([
          api.sections.list(),
          api.items.list(),
          api.faultTypes.list(),
          api.faultReports.list(),
        ]);
        setSections(sec as SectionData[]);
        setItems(itm as ItemData[]);
        setFaultTypes((ft as { types: string[] }).types);
        setMyReports(reports as FaultReportData[]);
      } catch (e) {
        console.error("Failed to load:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const roomItems = items.filter(i => i.location === selectedRoom);
  const filteredRoomItems = itemSearch
    ? roomItems.filter(i => i.label.toLowerCase().includes(itemSearch.toLowerCase()))
    : roomItems;

  const resetForm = () => {
    setSelectedRoom("");
    setSelectedItem(null);
    setFaultType("");
    setSeverity("Medium");
    setDescription("");
    setPhotos([]);
    setSuccess(false);
    setError("");
    setItemSearch("");
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(
        Array.from(files).map(f => api.upload.file(f, "photos"))
      );
      setPhotos(prev => [...prev, ...urls]);
    } catch {
      setError("Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedItem || !faultType) return;
    setSubmitting(true);
    setError("");
    try {
      await api.faultReports.create({
        itemId: selectedItem.id,
        roomName: selectedRoom,
        faultType,
        severity,
        description: description || undefined,
        photos: photos.length > 0 ? photos : undefined,
      });
      setSuccess(true);
      const reports = await api.faultReports.list();
      setMyReports(reports as FaultReportData[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm("Reset demo to default state? All changes will be lost.")) return;
    await fetch("/api/demo/reset", { method: "POST" });
    window.location.reload();
  };

  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Mono','Courier New',monospace", background: "#f8fafc", minHeight: "100vh", color: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748b", fontSize: 13 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Mono','Courier New',monospace", background: "#f8fafc", minHeight: "100vh", color: "#1e293b" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,select,textarea{background:#f8fafc;border:1px solid #cbd5e1;color:#1e293b;border-radius:5px;padding:7px 10px;font-family:inherit;font-size:12px;width:100%;outline:none;transition:border .15s}
        input:focus,select:focus,textarea:focus{border-color:#6366f1}
        .btn{background:#f1f5f9;border:1px solid #cbd5e1;color:#1e293b;padding:6px 12px;border-radius:5px;cursor:pointer;font-family:inherit;font-size:11px;transition:all .15s}
        .btn:hover{background:#e2e8f0;border-color:#6366f1}
        .btn-primary{background:#3730a3!important;border-color:#6366f1!important;color:#fff!important}
        .badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:500;white-space:nowrap}
      `}</style>

      {/* Demo banner */}
      {schoolName === "Demo School" && (
        <div style={{
          background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff", padding: "6px 16px", fontSize: 11,
          display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "'Space Grotesk', sans-serif",
        }}>
          <span>Demo Mode — Teacher Fault Reporting</span>
          <button onClick={handleResetDemo} style={{
            background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 4,
            color: "#fff", fontSize: 10, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit",
          }}>
            Reset Demo
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 0 12px rgba(99,102,241,0.2)", flexShrink: 0 }}>◈</div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 14, color: "#4338ca" }}>
              {schoolName || "Investory Map"}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>Fault Report</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#64748b" }}>👤 {userName}</span>
          <button className="btn" onClick={() => signOut({ callbackUrl: "/login" })} style={{ color: "#ef4444", fontSize: 10 }}>Sign Out</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
        {success ? (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: "#166534", marginBottom: 8 }}>
              Report Submitted
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
              Your report has been submitted. The admin team will review it.
            </div>
            <button className="btn btn-primary" onClick={resetForm} style={{ padding: "8px 20px" }}>
              Report Another
            </button>
          </div>
        ) : (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 600, color: "#4338ca", marginBottom: 16 }}>
              ⚠ Report a Fault
            </div>

            {error && (
              <div style={{ background: "#fee2e2", border: "1px solid #ef4444", borderRadius: 6, padding: "8px 12px", color: "#dc2626", fontSize: 12, marginBottom: 12 }}>
                {error}
              </div>
            )}

            {/* Step 1: Location */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, fontWeight: 500 }}>
                1. Where are you?
              </label>
              <select
                value={selectedRoom}
                onChange={e => { setSelectedRoom(e.target.value); setSelectedItem(null); setItemSearch(""); }}
              >
                <option value="">Select a room...</option>
                {sections.map(s => (
                  <optgroup key={s.name} label={s.name}>
                    {(s.rooms || []).map(r => (
                      <option key={r.name} value={r.name}>{r.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Step 2: Item selection */}
            {selectedRoom && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, fontWeight: 500 }}>
                  2. Which item is faulty?
                </label>
                {roomItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#94a3b8", padding: "12px 0" }}>No items found in this room.</div>
                ) : (
                  <>
                    {roomItems.length > 5 && (
                      <input
                        placeholder="Search items..."
                        value={itemSearch}
                        onChange={e => setItemSearch(e.target.value)}
                        style={{ marginBottom: 6 }}
                      />
                    )}
                    <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                      {filteredRoomItems.map(item => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          style={{
                            padding: "8px 10px",
                            cursor: "pointer",
                            borderBottom: "1px solid #f1f5f9",
                            background: selectedItem?.id === item.id ? "#ede9fe" : "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ fontSize: 12, color: "#1e293b", fontWeight: selectedItem?.id === item.id ? 600 : 400 }}>
                            {item.label}
                          </span>
                          <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Fault details */}
            {selectedItem && (
              <div>
                <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, fontWeight: 500 }}>
                  3. What&apos;s wrong?
                </label>

                <select
                  value={faultType}
                  onChange={e => setFaultType(e.target.value)}
                  style={{ marginBottom: 8 }}
                >
                  <option value="">Select fault type...</option>
                  {faultTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Severity</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {SEVERITIES.map(s => {
                      const sc = SEV_COLORS[s] ?? SEV_COLORS.Low;
                      return (
                        <button
                          key={s}
                          onClick={() => setSeverity(s)}
                          style={{
                            flex: 1,
                            padding: "5px 0",
                            borderRadius: 4,
                            border: severity === s ? `2px solid ${sc.text}` : "1px solid #e2e8f0",
                            background: severity === s ? sc.bg : "#ffffff",
                            color: severity === s ? sc.text : "#64748b",
                            fontSize: 10,
                            fontWeight: severity === s ? 600 : 400,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <textarea
                  placeholder="Describe the issue (optional)"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  style={{ marginBottom: 8, resize: "vertical" }}
                />

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Photos (optional)</div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    style={{ fontSize: 11 }}
                  />
                  {photos.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                      {photos.map((p, i) => (
                        <img key={i} src={p} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4, border: "1px solid #cbd5e1" }} />
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={!faultType || submitting || uploading}
                  style={{ width: "100%", padding: "10px 0", fontSize: 13, opacity: (!faultType || submitting) ? 0.6 : 1 }}
                >
                  {submitting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* My Reports */}
        {myReports.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: "#4338ca", marginBottom: 10 }}>
              My Reports
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {myReports.map(r => {
                const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.Pending;
                return (
                  <div key={r.id} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 7, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span className="badge" style={{ background: badge.bg, color: badge.text }}>{r.status}</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{r.item.label}</span>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>@ {r.roomName}</span>
                      <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>{fmtDate(r.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{r.faultType} — {r.severity}</div>
                    {r.description && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{r.description}</div>}
                    {r.reviewNote && (
                      <div style={{ fontSize: 10, color: r.status === "Rejected" ? "#991b1b" : "#166534", marginTop: 4, fontStyle: "italic" }}>
                        Admin: {r.reviewNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
