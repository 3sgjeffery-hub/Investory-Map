"use client";

import React, { useState, useEffect, useRef } from "react";
import { CONDEMNED_SECTION } from "@/lib/constants";

export interface RoomData {
  id: string;
  name: string;
}

export interface SectionData {
  id: string;
  name: string;
  isProtected: boolean;
  rooms: RoomData[];
}

interface SettingsModalProps {
  sectionsData: SectionData[];
  itemTypes: string[];
  typeIcons: Record<string, string>;
  onAddSection: (name: string) => void;
  onRenameSection: (sectionId: string, name: string, currentName: string) => void;
  onDeleteSection: (sectionId: string, sectionName: string) => void;
  onAddRoom: (sectionId: string, name: string) => void;
  onRenameRoom: (sectionId: string, roomId: string, name: string) => void;
  onDeleteRoom: (sectionId: string, roomId: string, redirectTo: string) => void;
  onMoveRoom: (fromSectionId: string, toSectionId: string, roomId: string) => void;
  onUpdateTypes: (types: string[], icons: Record<string, string>) => Promise<void>;
  faultTypes: string[];
  onUpdateFaultTypes: (types: string[]) => Promise<void>;
  onResetAllData: () => Promise<void>;
  onClose: () => void;
}

export default function SettingsModal({
  sectionsData,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
  onMoveRoom,
  itemTypes,
  typeIcons,
  onUpdateTypes,
  faultTypes,
  onUpdateFaultTypes,
  onResetAllData,
  onClose,
}: SettingsModalProps) {
  const [settingsTab, setSettingsTab] = useState<"sections" | "types" | "faults">("sections");
  const [selSecId, setSelSecId] = useState<string>(sectionsData[0]?.id ?? "");
  const [newSec, setNewSec] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [editSecName, setEditSecName] = useState("");
  const [movingRoom, setMovingRoom] = useState<RoomData | null>(null);
  const [moveRoomTarget, setMoveRoomTarget] = useState("");
  const [editTypes, setEditTypes] = useState<string[]>(itemTypes);
  const [editIcons, setEditIcons] = useState<Record<string, string>>(typeIcons);
  const [newType, setNewType] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const [typesSaved, setTypesSaved] = useState(false);
  const [editFaultTypes, setEditFaultTypes] = useState<string[]>(faultTypes);
  const [newFaultType, setNewFaultType] = useState("");
  const [faultTypesSaved, setFaultTypesSaved] = useState(false);
  const [typesSortDir, setTypesSortDir] = useState<"asc" | "desc" | null>(null);
  const typesSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faultTypesSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (typesSavedTimer.current) clearTimeout(typesSavedTimer.current);
      if (faultTypesSavedTimer.current) clearTimeout(faultTypesSavedTimer.current);
    };
  }, []);

  const selectedSection = sectionsData.find((s) => s.id === selSecId) ?? null;
  const otherSections = sectionsData.filter((s) => s.id !== selSecId);

  const handleDeleteRoom = (room: RoomData) => {
    const redirect = window.prompt(
      `Items in "${room.name}" will be moved to which room?\n(Leave blank for "Spare")`,
      "Spare"
    );
    if (redirect === null) return;
    onDeleteRoom(selSecId, room.id, redirect.trim() || "Spare");
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: "min(580px,100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, color: "#4f46e5" }}>
            Settings
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 20 }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
          {(
            [
              ["sections", "Sections & Rooms"],
              ["types", "Item Types"],
              ["faults", "Fault Types"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSettingsTab(key)}
              style={{
                padding: "4px 12px",
                fontSize: 11,
                borderRadius: "4px 4px 0 0",
                background: settingsTab === key ? "#ede9fe" : "none",
                color: settingsTab === key ? "#4338ca" : "#64748b",
                border: settingsTab === key ? "1px solid #cbd5e1" : "1px solid transparent",
                borderBottom: "none",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {settingsTab === "sections" && (
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, minHeight: 300 }}>
          <div>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>SECTIONS</div>
            {sectionsData.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  setSelSecId(s.id);
                  setEditSecName("");
                  setMovingRoom(null);
                }}
                style={{
                  padding: "5px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 11,
                  marginBottom: 3,
                  background: selSecId === s.id ? "#ede9fe" : "transparent",
                  color: selSecId === s.id ? "#4338ca" : "#475569",
                  border: `1px solid ${selSecId === s.id ? "#94a3b8" : "transparent"}`,
                }}
              >
                {s.name}
              </div>
            ))}
            <div style={{ marginTop: 8, display: "flex", gap: 5 }}>
              <input
                placeholder="New section..."
                value={newSec}
                onChange={(e) => setNewSec(e.target.value)}
                style={{ fontSize: 10 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSec.trim()) {
                    onAddSection(newSec.trim());
                    setNewSec("");
                  }
                }}
              />
              <button
                className="btn"
                onClick={() => {
                  if (newSec.trim()) {
                    onAddSection(newSec.trim());
                    setNewSec("");
                  }
                }}
                style={{ padding: "4px 8px" }}
              >
                +
              </button>
            </div>
          </div>
          <div>
            {selectedSection && (
              <>
                <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
                  <input
                    value={editSecName || selectedSection.name}
                    onChange={(e) => setEditSecName(e.target.value)}
                    style={{ fontSize: 11, flex: 1 }}
                  />
                  <button
                    className="btn"
                    onClick={() => {
                      if (editSecName && editSecName !== selectedSection.name) {
                        onRenameSection(selectedSection.id, editSecName, selectedSection.name);
                        setEditSecName("");
                      }
                    }}
                    style={{ padding: "4px 8px" }}
                  >
                    Rename
                  </button>
                  {selectedSection.name !== CONDEMNED_SECTION && !selectedSection.isProtected && (
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete section "${selectedSection.name}"? All rooms within will be removed.`
                          )
                        ) {
                          onDeleteSection(selectedSection.id, selectedSection.name);
                          setSelSecId(sectionsData[0]?.id ?? "");
                        }
                      }}
                      style={{ padding: "4px 8px" }}
                    >
                      Del
                    </button>
                  )}
                </div>

                {movingRoom && (
                  <div
                    style={{
                      background: "#ede9fe",
                      border: "1px solid #6366f1",
                      borderRadius: 6,
                      padding: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#4338ca", marginBottom: 6 }}>
                      Move &quot;{movingRoom.name}&quot; to:
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        value={moveRoomTarget}
                        onChange={(e) => setMoveRoomTarget(e.target.value)}
                        style={{ flex: 1, fontSize: 11 }}
                      >
                        <option value="">— pick section —</option>
                        {otherSections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-primary"
                        style={{ padding: "4px 8px", fontSize: 11 }}
                        onClick={() => {
                          if (moveRoomTarget) {
                            onMoveRoom(selSecId, moveRoomTarget, movingRoom.id);
                            setMovingRoom(null);
                            setMoveRoomTarget("");
                          }
                        }}
                      >
                        Move
                      </button>
                      <button
                        className="btn"
                        style={{ padding: "4px 8px", fontSize: 11 }}
                        onClick={() => setMovingRoom(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>
                  ROOMS{" "}
                  <span style={{ color: "#cbd5e1" }}>
                    · rename inline · ↗ move to section · × delete
                  </span>
                </div>
                <div
                  style={{
                    maxHeight: 240,
                    overflow: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    marginBottom: 8,
                  }}
                >
                  {selectedSection.rooms.length === 0 && (
                    <div style={{ fontSize: 11, color: "#cbd5e1", padding: "10px 0", textAlign: "center" }}>
                      No rooms yet — add one below
                    </div>
                  )}
                  {selectedSection.rooms.map((room) => (
                    <div key={room.id} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <input
                        defaultValue={room.name}
                        style={{ fontSize: 10, flex: 1 }}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== room.name) onRenameRoom(selSecId, room.id, v);
                        }}
                      />
                      <button
                        title="Move to another section"
                        onClick={() => {
                          setMovingRoom(room);
                          setMoveRoomTarget(otherSections[0]?.id ?? "");
                        }}
                        style={{
                          background: "none",
                          border: "1px solid #94a3b8",
                          cursor: "pointer",
                          color: "#4f46e5",
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 3,
                          flexShrink: 0,
                        }}
                      >
                        ↗
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteRoom(room)}
                        style={{ padding: "3px 7px", fontSize: 10, flexShrink: 0 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <input
                    placeholder="New room name..."
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    style={{ fontSize: 10, flex: 1 }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newRoom.trim()) {
                        onAddRoom(selSecId, newRoom.trim());
                        setNewRoom("");
                      }
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (newRoom.trim()) {
                        onAddRoom(selSecId, newRoom.trim());
                        setNewRoom("");
                      }
                    }}
                    style={{ padding: "4px 8px" }}
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        )}

        {settingsTab === "types" && (
          <div style={{ minHeight: 300 }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>
              Manage equipment types and their icons. Click an icon to change it (paste any emoji).
            </div>
            <div style={{ display: "flex", gap: 5, marginBottom: 6, fontSize: 9, color: "#94a3b8", alignItems: "center" }}>
              <span style={{ width: 36, textAlign: "center" }}>Icon</span>
              <span style={{ flex: 1 }}>Type Name</span>
              <span
                onClick={() => {
                  const dir = typesSortDir === null ? "asc" : typesSortDir === "asc" ? "desc" : null;
                  setTypesSortDir(dir);
                  if (dir) {
                    const sorted = [...editTypes].sort((a, b) =>
                      dir === "asc" ? a.localeCompare(b) : b.localeCompare(a)
                    );
                    setEditTypes(sorted);
                  }
                }}
                style={{
                  cursor: "pointer",
                  padding: "1px 5px",
                  borderRadius: 3,
                  color: typesSortDir ? "#4f46e5" : "#94a3b8",
                  background: typesSortDir ? "#ede9fe" : "transparent",
                  userSelect: "none",
                  fontSize: 9,
                }}
              >
                Sort {typesSortDir === "asc" ? "A→Z" : typesSortDir === "desc" ? "Z→A" : ""}
              </span>
            </div>
            <div
              style={{
                maxHeight: 280,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginBottom: 8,
              }}
            >
              {editTypes.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <input
                    value={editIcons[t] || "📦"}
                    onChange={(e) => {
                      const val = e.target.value;
                      const emoji = [...val].pop() || "📦";
                      setEditIcons({ ...editIcons, [t]: emoji });
                    }}
                    style={{ fontSize: 18, width: 36, textAlign: "center", padding: "2px 0", flexShrink: 0 }}
                  />
                  <input
                    value={t}
                    onChange={(e) => {
                      const oldName = editTypes[i];
                      const next = [...editTypes];
                      next[i] = e.target.value;
                      setEditTypes(next);
                      if (editIcons[oldName]) {
                        const newIcons = { ...editIcons };
                        newIcons[e.target.value] = newIcons[oldName];
                        if (e.target.value !== oldName) delete newIcons[oldName];
                        setEditIcons(newIcons);
                      }
                    }}
                    style={{ fontSize: 10, flex: 1 }}
                  />
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      const removed = editTypes[i];
                      setEditTypes(editTypes.filter((_, j) => j !== i));
                      const newIcons = { ...editIcons };
                      delete newIcons[removed];
                      setEditIcons(newIcons);
                    }}
                    style={{ padding: "3px 7px", fontSize: 10, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
              <input
                placeholder="New type name..."
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                style={{ fontSize: 10, flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newType.trim()) {
                    setEditTypes([...editTypes, newType.trim()]);
                    setNewType("");
                  }
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (newType.trim()) {
                    setEditTypes([...editTypes, newType.trim()]);
                    setNewType("");
                  }
                }}
                style={{ padding: "4px 8px" }}
              >
                Add
              </button>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: 6 }}
              onClick={async () => {
                const cleaned = editTypes.map((t) => t.trim()).filter(Boolean);
                const cleanedIcons: Record<string, string> = {};
                for (const t of cleaned) {
                  if (editIcons[t]) cleanedIcons[t] = editIcons[t];
                }
                await onUpdateTypes(cleaned, cleanedIcons);
                setEditTypes(cleaned);
                setEditIcons(cleanedIcons);
                setTypesSaved(true);
                if (typesSavedTimer.current) clearTimeout(typesSavedTimer.current);
                typesSavedTimer.current = setTimeout(() => setTypesSaved(false), 2500);
              }}
            >
              {typesSaved ? "Saved!" : "Save Types"}
            </button>
          </div>
        )}

        {settingsTab === "faults" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {editFaultTypes.map((ft, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  value={ft}
                  onChange={(e) => {
                    const updated = [...editFaultTypes];
                    updated[i] = e.target.value;
                    setEditFaultTypes(updated);
                  }}
                  style={{ flex: 1, fontSize: 11 }}
                />
                <button
                  onClick={() => setEditFaultTypes(editFaultTypes.filter((_, j) => j !== i))}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#ef4444",
                    fontSize: 14,
                    padding: "0 4px",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <input
                placeholder="New fault type..."
                value={newFaultType}
                onChange={(e) => setNewFaultType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFaultType.trim()) {
                    setEditFaultTypes([...editFaultTypes, newFaultType.trim()]);
                    setNewFaultType("");
                  }
                }}
                style={{ flex: 1, fontSize: 11 }}
              />
              <button
                onClick={() => {
                  if (newFaultType.trim()) {
                    setEditFaultTypes([...editFaultTypes, newFaultType.trim()]);
                    setNewFaultType("");
                  }
                }}
                style={{ padding: "4px 8px" }}
              >
                Add
              </button>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: 6 }}
              onClick={async () => {
                const cleaned = editFaultTypes.map((t) => t.trim()).filter(Boolean);
                await onUpdateFaultTypes(cleaned);
                setEditFaultTypes(cleaned);
                setFaultTypesSaved(true);
                if (faultTypesSavedTimer.current) clearTimeout(faultTypesSavedTimer.current);
                faultTypesSavedTimer.current = setTimeout(() => setFaultTypesSaved(false), 2500);
              }}
            >
              {faultTypesSaved ? "Saved!" : "Save Fault Types"}
            </button>
          </div>
        )}

        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #fca5a5",
            borderRadius: 6,
            background: "#fef2f2",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", marginBottom: 6 }}>
            Clear All Data
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>
            This will permanently delete all items, sections, rooms, faults, loans, and move logs. User accounts will be kept. This cannot be undone.
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              placeholder='Type "RESET" to confirm'
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              style={{ fontSize: 10, flex: 1 }}
            />
            <button
              className="btn btn-danger"
              disabled={resetConfirm !== "RESET" || resetting}
              onClick={async () => {
                setResetting(true);
                try {
                  await onResetAllData();
                  onClose();
                } finally {
                  setResetting(false);
                  setResetConfirm("");
                }
              }}
              style={{ padding: "4px 10px", fontSize: 10, opacity: resetConfirm !== "RESET" ? 0.4 : 1 }}
            >
              {resetting ? "Clearing..." : "Clear All Data"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
