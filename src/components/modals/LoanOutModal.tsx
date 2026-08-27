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
  onSubmit: (data: LoanOutForm & { signature: string | null; issuerSignature: string | null }) => void;
  onClose: () => void;
}

function useSignaturePad() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const getCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const c = ref.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const scaleX = c.width / r.width;
    const scaleY = c.height / r.height;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      return { x: (e.touches[0].clientX - r.left) * scaleX, y: (e.touches[0].clientY - r.top) * scaleY };
    }
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  };

  const start = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    const ctx = ref.current?.getContext("2d");
    const pt = getCoords(e);
    if (!ctx || !pt) return;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const move = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const ctx = ref.current?.getContext("2d");
    const pt = getCoords(e);
    if (!ctx || !pt) return;
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    setHasSig(true);
  };

  const end = () => setDrawing(false);

  const clear = () => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, c.width, c.height);
    setHasSig(false);
  };

  return { ref, hasSig, start, move, end, clear };
}

function SignatureCanvas({
  label,
  pad,
}: {
  label: string;
  pad: ReturnType<typeof useSignaturePad>;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <label style={{ fontSize: 10, color: "#64748b" }}>{label}</label>
        <button
          onClick={pad.clear}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 10 }}
        >
          Clear
        </button>
      </div>
      <canvas
        ref={pad.ref}
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
        onMouseDown={pad.start}
        onMouseMove={pad.move}
        onMouseUp={pad.end}
        onMouseLeave={pad.end}
        onTouchStart={(e) => { e.preventDefault(); pad.start(e); }}
        onTouchMove={(e) => { e.preventDefault(); pad.move(e); }}
        onTouchEnd={pad.end}
      />
    </div>
  );
}

async function uploadCanvas(canvas: HTMLCanvasElement | null, folder: string): Promise<string | null> {
  if (!canvas) return null;
  try {
    const dataUrl = canvas.toDataURL();
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], "signature.png", { type: "image/png" });
    return await api.upload.file(file, folder);
  } catch (e) {
    console.error("Signature upload failed:", e);
    return null;
  }
}

export default function LoanOutModal({ item, borrowerNames = [], onSubmit, onClose }: LoanOutModalProps) {
  const [form, setForm] = useState<LoanOutForm>({
    borrowerName: "",
    borrowerId: "",
    issuedBy: "",
    expectedReturn: "",
    notes: "",
  });

  const borrowerSig = useSignaturePad();
  const issuerSig = useSignaturePad();

  const submit = async () => {
    if (!form.borrowerName) {
      alert("Borrower name required.");
      return;
    }
    const [signatureUrl, issuerSignatureUrl] = await Promise.all([
      borrowerSig.hasSig ? uploadCanvas(borrowerSig.ref.current, "signatures") : null,
      issuerSig.hasSig ? uploadCanvas(issuerSig.ref.current, "signatures") : null,
    ]);
    onSubmit({ ...form, signature: signatureUrl, issuerSignature: issuerSignatureUrl });
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
          <SignatureCanvas label="Borrower Signature" pad={borrowerSig} />
          <SignatureCanvas label="Authorised Personnel Signature" pad={issuerSig} />
          <div style={{ fontSize: 9, color: "#94a3b8", textAlign: "center" }}>
            Signature images are retained for up to 5 years.
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
