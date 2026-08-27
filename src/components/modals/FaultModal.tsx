"use client";

import React, { useRef, useState } from "react";
import { SEV_COLORS } from "@/lib/constants";
import { api } from "@/lib/api-client";
import type { Item } from "@/components/ItemChip";

interface FaultForm {
  faultType: string;
  severity: string;
  description: string;
  reportedBy: string;
  photos: string[];
}

interface FaultModalProps {
  item: Item;
  faultTypes: string[];
  onSubmit: (form: FaultForm) => void;
  onClose: () => void;
}

export default function FaultModal({ item, faultTypes, onSubmit, onClose }: FaultModalProps) {
  const [form, setForm] = useState<FaultForm>({
    faultType: faultTypes[0] || "",
    severity: "Medium",
    description: "",
    reportedBy: "",
    photos: [],
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    try {
      const uploads = await Promise.all(
        Array.from(files).map((f) => api.upload.file(f, "photos"))
      );
      setForm((prev) => ({ ...prev, photos: [...prev.photos, ...uploads] }));
    } catch (e) {
      console.error("Upload failed:", e);
    }
  };

  const severityOptions = ["Low", "Medium", "High", "Critical"];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, color: "#4f46e5", marginBottom: 12 }}>
          Report Fault — {item.label}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3 }}>Fault Type</label>
            <select value={form.faultType} onChange={(e) => setForm((f) => ({ ...f, faultType: e.target.value }))}>
              {faultTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3 }}>Severity</label>
            <div style={{ display: "flex", gap: 5 }}>
              {severityOptions.map((s) => {
                const sc2 = SEV_COLORS[s];
                const selected = form.severity === s;
                return (
                  <button
                    key={s}
                    onClick={() => setForm((f) => ({ ...f, severity: s }))}
                    style={{
                      flex: 1,
                      padding: "5px 3px",
                      border: `1px solid ${selected ? sc2.text : "#cbd5e1"}`,
                      borderRadius: 4,
                      cursor: "pointer",
                      background: selected ? sc2.bg : "#f8fafc",
                      color: selected ? sc2.text : "#64748b",
                      fontSize: 10,
                      fontFamily: "inherit",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3 }}>Description</label>
            <textarea
              rows={3}
              placeholder="Describe the fault..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3 }}>Reported By</label>
            <input
              placeholder="Your name"
              value={form.reportedBy}
              onChange={(e) => setForm((f) => ({ ...f, reportedBy: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3 }}>Photos</label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: "1px dashed #cbd5e1",
                borderRadius: 5,
                padding: 10,
                textAlign: "center",
                cursor: "pointer",
                fontSize: 11,
                color: "#64748b",
              }}
            >
              Tap to capture / browse / drag photos
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                style={{ display: "none" }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {form.photos.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                {form.photos.map((p, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p}
                      alt=""
                      style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 4, border: "1px solid #cbd5e1" }}
                    />
                    <button
                      onClick={() =>
                        setForm((f) => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))
                      }
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        background: "#ef4444",
                        border: "none",
                        borderRadius: "50%",
                        width: 14,
                        height: 14,
                        cursor: "pointer",
                        color: "white",
                        fontSize: 9,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: 52,
                    height: 52,
                    border: "1px dashed #cbd5e1",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#64748b",
                    fontSize: 18,
                  }}
                >
                  +
                </div>
              </div>
            )}
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 4 }}>
              Uploaded images are retained for up to 5 years.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSubmit(form)}>
              Submit
            </button>
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
