"use client";

import React, { useState } from "react";
import { api } from "@/lib/api-client";

interface PreviewItem {
  label: string;
  assetCode: string;
  type: string;
  brand: string;
  model: string;
  serial: string;
  location: string;
  cost: string;
  warrantyEnd: string;
  status: string;
  loanable: boolean;
  remark: string;
  comment: string;
  isLoaned: boolean;
  loanedTo: string;
}

interface ImportModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export default function ImportModal({ onSuccess, onClose }: ImportModalProps) {
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [err, setErr] = useState("");
  const [importing, setImporting] = useState(false);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split("\n").filter(Boolean);
        const hdrs = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase());
        const rows = lines
          .slice(1)
          .map((line) => {
            const v = line.split(",").map((x) => x.replace(/"/g, "").trim());
            const o: Record<string, string> = {};
            hdrs.forEach((h, i) => (o[h] = v[i] || ""));
            return {
              label: o.label || o.name || "",
              assetCode: o["asset code"] || o.assetcode || "",
              type: o.type || "Projector",
              brand: o.brand || "",
              model: o.model || "",
              serial: o.serial || "",
              location: o.location || "Spare",
              cost: o.cost || "0",
              warrantyEnd: o["warranty end"] || "",
              status: o.status || "Operational",
              loanable: o.loanable === "Yes",
              remark: o.remark || "",
              comment: o.comment || "",
              isLoaned: false,
              loanedTo: "",
            } as PreviewItem;
          })
          .filter((i) => i.label);
        setPreview(rows);
        setErr("");
      } catch {
        setErr("Failed to parse CSV.");
      }
    };
    r.readAsText(f);
  };

  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await api.import.csv(preview);
      if (res.skipped > 0) {
        setResult(res);
      } else {
        onSuccess();
      }
    } catch {
      setErr("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, color: "#4f46e5", marginBottom: 8 }}>
          Bulk Import CSV
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 10 }}>
          Headers: Label, AssetCode, Type, Brand, Model, Serial, Location, Cost, WarrantyEnd, Status, Loanable, Remark, Comment
          <br />
          <a
            href="/api/export/template"
            style={{ color: "#4f46e5", textDecoration: "underline", cursor: "pointer" }}
          >
            Download blank template with sample row
          </a>
        </div>
        <input type="file" accept=".csv" onChange={handle} style={{ marginBottom: 10 }} />
        {err && <div style={{ color: "#dc2626", fontSize: 11, marginBottom: 8 }}>{err}</div>}
        {result && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#16a34a", marginBottom: 4 }}>
              {result.imported} item{result.imported !== 1 ? "s" : ""} imported
            </div>
            <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 6 }}>
              {result.skipped} duplicate{result.skipped !== 1 ? "s" : ""} skipped (matching serial numbers)
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={onSuccess}>
              Done
            </button>
          </div>
        )}
        {!result && preview.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "#16a34a", marginBottom: 6 }}>{preview.length} items ready</div>
            <div style={{ maxHeight: 150, overflow: "auto", marginBottom: 10 }}>
              {preview.slice(0, 8).map((i, idx) => (
                <div key={idx} style={{ fontSize: 10, color: "#475569", padding: "2px 0" }}>
                  {i.label} — {i.brand} {i.model} @ {i.location}
                </div>
              ))}
              {preview.length > 8 && (
                <div style={{ fontSize: 10, color: "#94a3b8" }}>...+{preview.length - 8} more</div>
              )}
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: 6 }}
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? "Importing..." : `Import ${preview.length} Items`}
            </button>
          </div>
        )}
        <button className="btn" onClick={onClose} style={{ width: "100%" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
