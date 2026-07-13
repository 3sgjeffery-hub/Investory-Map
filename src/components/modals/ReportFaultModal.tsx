"use client";

import React, { useMemo, useState } from "react";
import { getTypeIcon, getStatusColor } from "@/lib/constants";
import type { Item } from "@/components/ItemChip";

interface ReportFaultModalProps {
  items: Item[];
  typeIcons?: Record<string, string>;
  onPickItem: (item: Item) => void;
  onClose: () => void;
}

const MAX_RESULTS = 30;

export default function ReportFaultModal({ items, typeIcons, onPickItem, onClose }: ReportFaultModalProps) {
  const [search, setSearch] = useState("");

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    return items
      .filter((item) => {
        const haystack = [
          item.label,
          item.assetCode ?? "",
          item.type,
          item.brand,
          item.model,
          item.serial ?? "",
          item.location,
        ]
          .join(" ")
          .toLowerCase();
        return terms.every((t) => haystack.includes(t));
      })
      .slice(0, MAX_RESULTS);
  }, [items, search]);

  const icon = (type: string) => typeIcons?.[type] || getTypeIcon(type);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, color: "#4f46e5", marginBottom: 4 }}>
          ⚠ Report Fault
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
          Which item has a problem? Search by name, room, type, or asset code.
        </div>
        <input
          autoFocus
          placeholder="e.g. projector F3-01"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ marginTop: 8, maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {search.trim() === "" && (
            <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: "18px 0" }}>
              Start typing to find the item
            </div>
          )}
          {search.trim() !== "" && results.length === 0 && (
            <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: "18px 0" }}>
              No items match &ldquo;{search.trim()}&rdquo;
            </div>
          )}
          {results.map((item) => {
            const sc = getStatusColor(item.status);
            return (
              <button
                key={item.id}
                onClick={() => onPickItem(item)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  width: "100%",
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon(item.type)}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                  <span style={{ display: "block", fontSize: 10, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.brand} {item.model} · 📍 {item.location}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 9,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: sc.bg,
                    color: sc.text,
                    border: `1px solid ${sc.border}`,
                    flexShrink: 0,
                  }}
                >
                  {item.status}
                </span>
              </button>
            );
          })}
          {results.length === MAX_RESULTS && (
            <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", padding: "4px 0" }}>
              Showing first {MAX_RESULTS} matches — keep typing to narrow down
            </div>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="btn" style={{ width: "100%" }} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
