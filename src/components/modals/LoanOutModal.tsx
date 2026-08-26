"use client";

import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { Item } from "@/components/ItemChip";

interface LoanOutForm {
  borrowerName: string;
  borrowerId: string;
  issuedBy: string;
  expectedReturn: string;
  notes: string;
}

interface LoanOutModalProps {
  item: Item;
  borrowerNames?: string[];
  onSubmit: (data: LoanOutForm & { signature: string | null }) => void;
  onClose: () => void;
}

export default function LoanOutModal({ item, borrowerNames = [], onSubmit, onClose }: LoanOutModalProps) {
  const [form, setForm] = useState<LoanOutForm>({
    borrowerName: "",
    borrowerId: "",
    issuedBy: "",
    expectedReturn: "",
    notes: "",
  });
  const sigRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);

  useEffect(() => {
    const c = sigRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const getCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const c = sigRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const scaleX = c.width / r.width;
    const scaleY = c.height / r.height;
    let clientX: number;
    let clientY: number;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return { x: (clientX - r.left) * scaleX, y: (clientY - r.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    const c = sigRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const pt = getCoords(e);
    if (!pt) return;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const c = sigRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const pt = getCoords(e);
    if (!pt) return;
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    setHasSig(true);
  };

  const endDraw = () => setDrawing(false);

  const clearSig = () => {
    const c = sigRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, c.width, c.height);
    setHasSig(false);
  };

  const submit = async () => {
    if (!form.borrowerName) {
      alert("Borrower name required.");
      return;
    }
    let signatureUrl: string | null = null;
    if (hasSig && sigRef.current) {
      try {
        const dataUrl = sigRef.current.toDataURL();
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "signature.png", { type: "image/png" });
        signatureUrl = await api.upload.file(file, "signatures");
      } catch (e) {
        console.error("Signature upload failed:", e);
      }
    }
    onSubmit({ ...form, signature: signatureUrl });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, color: "#4f46e5", marginBottom: 12 }}>
          Loan Out — {item.label}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3 }}>Borrower Name *</label>
            <input
              list="borrower-names"
              placeholder="Select or type a name"
              value={form.borrowerName}
              onChange={(e) => setForm((f) => ({ ...f, borrowerName: e.target.value }))}
            />
            {borrowerNames.length > 0 && (
              <datalist id="borrower-names">
                {borrowerNames.map(n => <option key={n} value={n} />)}
              </datalist>
            )}
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3 }}>Borrower ID / Contact</label>
            <input
              placeholder="Staff ID / phone"
              value={form.borrowerId}
              onChange={(e) => setForm((f) => ({ ...f, borrowerId: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3 }}>Issued By</label>
            <input
              placeholder="Your name"
              value={form.issuedBy}
              onChange={(e) => setForm((f) => ({ ...f, issuedBy: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3 }}>Expected Return</label>
            <input
              type="date"
              value={form.expectedReturn}
              onChange={(e) => setForm((f) => ({ ...f, expectedReturn: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 3 }}>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <label style={{ fontSize: 10, color: "#64748b" }}>Borrower Signature</label>
              <button
                onClick={clearSig}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 10 }}
              >
                Clear
              </button>
            </div>
            <canvas
              ref={sigRef}
              width={440}
              height={100}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 5,
                width: "100%",
                height: 90,
                touchAction: "none",
                cursor: "crosshair",
              }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={(e) => {
                e.preventDefault();
                startDraw(e);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                draw(e);
              }}
              onTouchEnd={endDraw}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit}>
              Confirm Loan Out
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
