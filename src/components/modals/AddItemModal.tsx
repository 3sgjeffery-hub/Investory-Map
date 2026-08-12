"use client";

import React, { useState } from "react";
import { STATUS_LIST, TYPE_ICON, getTypeIcon } from "@/lib/constants";

interface AddItemForm {
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
  statusNote: string;
  [key: string]: unknown;
}

interface AddItemModalProps {
  location: string;
  onAdd: (form: Record<string, unknown>) => void;
  onClose: () => void;
  itemTypes?: string[];
  typeIcons?: Record<string, string>;
}

export default function AddItemModal({ location, onAdd, onClose, itemTypes, typeIcons }: AddItemModalProps) {
  const [form, setForm] = useState<AddItemForm>({
    label: "",
    assetCode: "",
    type: "Projector",
    brand: "",
    model: "",
    serial: "",
    location,
    cost: "",
    warrantyEnd: "",
    status: "Operational",
    loanable: false,
    remark: "",
    comment: "",
    statusNote: "",
  });

  const textFields: Array<[keyof AddItemForm, string]> = [
    ["label", "Label *"],
    ["assetCode", "Asset Code"],
    ["brand", "Brand"],
    ["model", "Model"],
    ["serial", "Serial Number"],
    ["cost", "Cost ($)"],
  ];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, color: "#4f46e5", marginBottom: 12 }}>
          Add Equipment — {location}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {textFields.map(([k, l]) => (
            <div key={k}>
              <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>{l}</label>
              <input
                value={form[k] as string}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {(itemTypes || Object.keys(TYPE_ICON).filter((k) => k !== "default")).map((t) => (
                  <option key={t} value={t}>{typeIcons?.[t] || getTypeIcon(t)} {t}</option>
                ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>Warranty End</label>
            <input
              type="date"
              value={form.warrantyEnd}
              onChange={(e) => setForm((f) => ({ ...f, warrantyEnd: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUS_LIST.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {form.status === "Others" && (
              <input
                placeholder="Describe..."
                value={form.statusNote}
                onChange={(e) => setForm((f) => ({ ...f, statusNote: e.target.value }))}
                style={{ marginTop: 4 }}
              />
            )}
          </div>
          <label
            style={{ fontSize: 10, color: "#64748b", display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={form.loanable}
              onChange={(e) => setForm((f) => ({ ...f, loanable: e.target.checked }))}
              style={{ width: "auto" }}
            />{" "}
            Loanable item
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                if (!form.label.trim()) return;
                onAdd({ ...form });
              }}
            >
              Add Item
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
