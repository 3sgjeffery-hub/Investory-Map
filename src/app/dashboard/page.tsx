"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import StatsBar from "@/components/StatsBar";
import TabNav from "@/components/TabNav";
import SectionsView from "@/components/SectionsView";
import ListView from "@/components/ListView";
import FaultsView from "@/components/FaultsView";
import LoansView from "@/components/LoansView";
import DetailPanel from "@/components/DetailPanel";
import MoveModal from "@/components/modals/MoveModal";
import FaultModal from "@/components/modals/FaultModal";
import ReportFaultModal from "@/components/modals/ReportFaultModal";
import LoanOutModal from "@/components/modals/LoanOutModal";
import ReturnModal from "@/components/modals/ReturnModal";
import ReportModal from "@/components/modals/ReportModal";
import MoveLogModal from "@/components/modals/MoveLogModal";
import AddItemModal from "@/components/modals/AddItemModal";
import ImportModal from "@/components/modals/ImportModal";
import BulkMoveModal from "@/components/modals/BulkMoveModal";
import SettingsModal from "@/components/modals/SettingsModal";
import ChangePasswordModal from "@/components/modals/ChangePasswordModal";
import { api } from "@/lib/api-client";
import { DEFAULT_ITEM_TYPES, FAULT_TYPES } from "@/lib/constants";
import type { Item } from "@/components/ItemChip";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<unknown[]>([]);
  const [sections, setSections] = useState<Record<string, string[]>>({});
  const [sectionsRaw, setSectionsRaw] = useState<Array<{ id: string; name: string; isProtected: boolean; rooms: Array<{ id: string; name: string; sortOrder: number }> }>>([]);
  const [moveLog, setMoveLog] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("sections");
  const [activeSection, setActiveSection] = useState("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailTab, setDetailTab] = useState("details");
  const [modal, setModal] = useState<{ type: string; [key: string]: unknown } | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState(new Set<string>());
  const [dragItem, setDragItem] = useState<Item | null>(null);
  const [dragRoom, setDragRoom] = useState<string | null>(null);
  const [dragOverRoom, setDragOverRoom] = useState<string | null>(null);
  const [itemTypes, setItemTypes] = useState<string[]>(DEFAULT_ITEM_TYPES);
  const [typeIcons, setTypeIcons] = useState<Record<string, string>>({});
  const [faultTypes, setFaultTypes] = useState<string[]>([...FAULT_TYPES]);


  useEffect(() => {
    async function loadData() {
      try {
        const [fetchedItems, fetchedSections, fetchedLog, fetchedTypesData, fetchedFaultTypesData] = await Promise.all([
          api.items.list(),
          api.sections.list(),
          api.moveLog.list(),
          api.types.list(),
          api.faultTypes.list(),
        ]);
        setItems(fetchedItems);
        setItemTypes(fetchedTypesData.types);
        setTypeIcons(fetchedTypesData.icons);
        setFaultTypes(fetchedFaultTypesData.types);
        // Sections API returns array of { id, name, rooms: [...] } — reshape to Record<name, roomNames[]>
        const sectionMap: Record<string, string[]> = {};
        if (Array.isArray(fetchedSections)) {
          (fetchedSections as Array<{ name: string; rooms?: Array<{ name: string }> }>).forEach(s => {
            sectionMap[s.name] = (s.rooms ?? []).map(r => r.name);
          });
        }
        setSections(sectionMap);
        setSectionsRaw(fetchedSections as Array<{ id: string; name: string; isProtected: boolean; rooms: Array<{ id: string; name: string; sortOrder: number }> }>);
        const firstSection = Object.keys(sectionMap)[0];
        if (firstSection) setActiveSection(firstSection);
        setMoveLog(fetchedLog);
      } catch (e) {
        console.error("Failed to load data:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // ── Item selection helpers ──────────────────────────────────────────────────
  const openItem = (item: Item) => { setSelectedItem(item); setDetailTab("details"); };

  const toggleSelectItem = (id: string, _shiftHeld: boolean) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedItems(new Set());

  // ── Stats card click handler ────────────────────────────────────────────────
  const handleStatClick = (key: string) => {
    switch (key) {
      case "Total":        setModal({ type: "report" }); break;
      case "OK":           setTab("list"); setFilterStatus("Operational"); setFilterType("All"); break;
      case "Faulty":       setTab("list"); setFilterStatus("Faulty"); setFilterType("All"); break;
      case "Maint.":       setTab("list"); setFilterStatus("Under Maintenance"); setFilterType("All"); break;
      case "Condemned":    setTab("list"); setFilterStatus("Waiting for Condemnation"); setFilterType("All"); break;
      case "On Loan":      setTab("loans"); break;
      case "Open Faults":  setTab("faults"); break;
      case "Expiring ⚠":  setTab("list"); setFilterStatus("__expiring__"); setFilterType("All"); break;
      case "Expired ✗":   setTab("list"); setFilterStatus("__expired__"); setFilterType("All"); break;
    }
  };

  // ── Drag & drop handlers ────────────────────────────────────────────────────
  const onDragItemStart = (e: React.DragEvent, item: Item) => {
    setDragItem(item);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragItemEnd = () => {
    setDragItem(null);
    setDragOverRoom(null);
  };
  const onRoomDragOver = (e: React.DragEvent, room: string) => {
    e.preventDefault();
    setDragOverRoom(room);
  };
  const onRoomDrop = (e: React.DragEvent, room: string) => {
    e.preventDefault();
    if (dragItem && (dragItem as Item).location !== room) {
      setModal({ type: "move", item: dragItem as unknown, pendingLocation: room });
    }
    setDragOverRoom(null);
    setDragItem(null);
  };
  const onRoomCardDragStart = (e: React.DragEvent, room: string) => {
    setDragRoom(room);
    e.dataTransfer.effectAllowed = "move";
  };
  const onRoomCardDrop = async (e: React.DragEvent, targetRoomName: string, sectionName: string) => {
    e.preventDefault();
    if (!dragRoom || dragRoom === targetRoomName) { setDragRoom(null); setDragOverRoom(null); return; }
    const sectionData = sectionsRaw.find(s => s.name === sectionName);
    if (!sectionData) { setDragRoom(null); setDragOverRoom(null); return; }
    const fromIdx = sectionData.rooms.findIndex(r => r.name === dragRoom);
    const toIdx = sectionData.rooms.findIndex(r => r.name === targetRoomName);
    if (fromIdx < 0 || toIdx < 0) { setDragRoom(null); setDragOverRoom(null); return; }
    // Build new order
    const newRooms = [...sectionData.rooms];
    const [moved] = newRooms.splice(fromIdx, 1);
    newRooms.splice(toIdx, 0, moved);
    // Optimistic UI update
    setSections(prev => ({ ...prev, [sectionName]: newRooms.map(r => r.name) }));
    // Persist only changed sortOrders
    try {
      await Promise.all(
        newRooms
          .map((r, i) => ({ room: r, newOrder: i }))
          .filter(({ room, newOrder }) => {
            const old = sectionData.rooms.findIndex(cr => cr.id === room.id);
            return old !== newOrder;
          })
          .map(({ room, newOrder }) => api.sections.updateRoomOrder(sectionData.id, room.id, newOrder))
      );
      setSectionsRaw(prev => prev.map(s =>
        s.id === sectionData.id ? { ...s, rooms: newRooms.map((r, i) => ({ ...r, sortOrder: i })) } : s
      ));
    } catch (err) {
      console.error("Room reorder failed:", err);
      await refreshSections();
    }
    setDragRoom(null);
    setDragOverRoom(null);
  };

  // ── Fault update handler ────────────────────────────────────────────────────
  const onUpdateFault = async (itemId: string, faultId: string, patch: { status: string }) => {
    void itemId;
    try {
      await api.faults.update(faultId, patch);
      const fetchedItems = await api.items.list();
      setItems(fetchedItems);
    } catch (e) {
      console.error("Failed to update fault:", e);
    }
  };

  // ── DetailPanel API handlers ────────────────────────────────────────────────
  const refreshItems = async () => {
    const fetchedItems = await api.items.list();
    setItems(fetchedItems);
  };

  const handleUpdateItem = async (patch: Record<string, unknown>) => {
    if (!selectedItem) return;
    const item = selectedItem as Item;
    try {
      await api.items.update(item.id, patch);
      await refreshItems();
      setSelectedItem({ ...item, ...patch });
    } catch (e) { console.error(e); }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    const item = selectedItem as Item;
    try {
      await api.items.delete(item.id);
      setSelectedItem(null);
      await refreshItems();
    } catch (e) { console.error(e); }
  };

  const handleAddRepair = async (repair: Record<string, unknown>) => {
    if (!selectedItem) return;
    const item = selectedItem as Item;
    try {
      await api.items.addRepair(item.id, repair);
      await refreshItems();
    } catch (e) { console.error(e); }
  };

  const handleUpdateFaultInPanel = async (faultId: string, patch: Record<string, unknown>) => {
    try {
      await api.faults.update(faultId, patch);
      await refreshItems();
    } catch (e) { console.error(e); }
  };

  // ── Section refresh helper ──────────────────────────────────────────────────
  const refreshSections = async () => {
    const fetchedSections = await api.sections.list();
    const raw = fetchedSections as Array<{ id: string; name: string; isProtected: boolean; rooms: Array<{ id: string; name: string; sortOrder: number }> }>;
    setSectionsRaw(raw);
    const sectionMap: Record<string, string[]> = {};
    raw.forEach(s => { sectionMap[s.name] = (s.rooms ?? []).map(r => r.name); });
    setSections(sectionMap);
  };

  // ── Modal action handlers ───────────────────────────────────────────────────
  const handleMove = async (toLocation: string, reason: string, movedBy: string) => {
    const item = modal?.item as Item | undefined;
    if (!item) return;
    try {
      await api.items.move(item.id, { toLocation, reason, movedBy });
      await refreshItems();
      setModal(null);
    } catch (e) { console.error(e); }
  };

  const handleFaultSubmit = async (form: { faultType: string; severity: string; description: string; reportedBy: string; photos: string[] }) => {
    const item = modal?.item as Item | undefined;
    if (!item) return;
    try {
      await api.items.addFault(item.id, form);
      await refreshItems();
      setModal(null);
    } catch (e) { console.error(e); }
  };

  const handleLoanOut = async (data: { borrowerName: string; borrowerId: string; issuedBy: string; expectedReturn: string; notes: string; signature: string | null }) => {
    const item = modal?.item as Item | undefined;
    if (!item) return;
    try {
      await api.items.loanOut(item.id, data);
      await refreshItems();
      setModal(null);
    } catch (e) { console.error(e); }
  };

  const handleReturn = async (data: { returnLocation: string; condition: string; returnedBy: string; notes: string }) => {
    const item = modal?.item as Item | undefined;
    if (!item) return;
    try {
      await api.items.returnItem(item.id, data);
      await refreshItems();
      setModal(null);
    } catch (e) { console.error(e); }
  };

  const handleAddItem = async (form: Record<string, unknown>) => {
    try {
      await api.items.create(form);
      await refreshItems();
      setModal(null);
    } catch (e) { console.error(e); }
  };

  const handleBulkMove = async (toLocation: string, reason: string, movedBy: string) => {
    try {
      await Promise.all(
        Array.from(selectedItems).map(id => api.items.move(id, { toLocation, reason, movedBy }))
      );
      await refreshItems();
      clearSelection();
      setModal(null);
    } catch (e) { console.error(e); }
  };

  const handleAddSection = async (name: string) => {
    try { await api.sections.create({ name }); await refreshSections(); } catch (e) { console.error(e); }
  };
  const handleRenameSection = async (sectionId: string, name: string, currentName: string) => {
    try { await api.sections.update(sectionId, { name }); await refreshSections(); if (activeSection === currentName) setActiveSection(name); } catch (e) { console.error(e); }
  };
  const handleDeleteSection = async (sectionId: string, sectionName: string) => {
    try { await api.sections.delete(sectionId); await refreshSections(); if (activeSection === sectionName) setActiveSection(""); } catch (e) { console.error(e); }
  };
  const handleAddRoom = async (sectionId: string, name: string) => {
    try { await api.sections.addRoom(sectionId, name); await refreshSections(); } catch (e) { console.error(e); }
  };
  const handleRenameRoom = async (sectionId: string, roomId: string, name: string) => {
    try { await api.sections.renameRoom(sectionId, roomId, name); await refreshSections(); } catch (e) { console.error(e); }
  };
  const handleDeleteRoom = async (sectionId: string, roomId: string, redirectTo: string) => {
    void redirectTo; // redirectTo is handled server-side or by items re-fetch
    try { await api.sections.deleteRoom(sectionId, roomId); await refreshSections(); await refreshItems(); } catch (e) { console.error(e); }
  };
  const handleMoveRoom = async (fromSectionId: string, toSectionId: string, roomId: string) => {
    // No dedicated API — implement as delete from old + add to new section
    const room = sectionsRaw.find(s => s.id === fromSectionId)?.rooms.find(r => r.id === roomId);
    if (!room) return;
    try {
      await api.sections.deleteRoom(fromSectionId, roomId);
      await api.sections.addRoom(toSectionId, room.name);
      await refreshSections();
    } catch (e) { console.error(e); }
  };

  // Compute stats from items (items have status/isLoaned/warrantyEnd/faults fields)
  const typedItems = items as Array<{
    status: string;
    isLoaned: boolean;
    warrantyEnd: string | null;
    faults: Array<{ status: string }>;
  }>;

  const now = new Date();
  const stats = {
    total: typedItems.length,
    operational: typedItems.filter(i => i.status === "Operational").length,
    faulty: typedItems.filter(i => i.status === "Faulty").length,
    maintenance: typedItems.filter(i => i.status === "Under Maintenance").length,
    condemned: typedItems.filter(i => i.status === "Waiting for Condemnation").length,
    loaned: typedItems.filter(i => i.isLoaned).length,
    openFaults: typedItems.reduce((n, i) => n + (i.faults ?? []).filter(f => f.status !== "Resolved").length, 0),
    warrantyExpired: typedItems.filter(i => i.warrantyEnd && new Date(i.warrantyEnd) < now).length,
    expiringSoon: typedItems.filter(i => {
      if (!i.warrantyEnd) return false;
      const diff = (new Date(i.warrantyEnd).getTime() - now.getTime()) / 86400000;
      return diff > 0 && diff < 90;
    }).length,
  };

  const userRole = (session?.user as { role?: string })?.role ?? "USER";
  const isAdmin = userRole === "SCHOOL_ADMIN" || userRole === "SUPER_ADMIN";

  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Mono','Courier New',monospace", background: "#f8fafc", minHeight: "100vh", color: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748b", fontSize: 13 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Mono','Courier New',monospace", background: "#f8fafc", minHeight: "100vh", color: "#1e293b", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#ffffff}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px}
        .btn{background:#f1f5f9;border:1px solid #cbd5e1;color:#1e293b;padding:6px 12px;border-radius:5px;cursor:pointer;font-family:inherit;font-size:11px;transition:all .15s}
        .btn:hover{background:#e2e8f0;border-color:#6366f1}
        .btn-primary{background:#3730a3!important;border-color:#6366f1!important;color:#fff!important}
        .btn-primary:hover{background:#4338ca!important}
        .btn-danger{background:#fee2e2!important;border-color:#ef4444!important;color:#fff!important}
        .modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:150;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;padding:20px;width:min(480px,100%);max-height:88vh;overflow-y:auto}
        input,select,textarea{background:#f8fafc;border:1px solid #cbd5e1;color:#1e293b;border-radius:5px;padding:7px 10px;font-family:inherit;font-size:12px;width:100%;outline:none;transition:border .15s}
        input:focus,select:focus,textarea:focus{border-color:#6366f1}
        select option{background:#ffffff}
        .chip{border-radius:4px;transition:all .1s;cursor:grab;user-select:none}
        .chip:hover{opacity:.85}
        .chip:active{cursor:grabbing}
        .room-card{border-radius:8px;transition:border-color .15s}
        .drop-target{box-shadow:0 0 0 2px #6366f1!important}
        .badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:500;white-space:nowrap}
        .lightbox{position:fixed;inset:0;background:rgba(15,23,42,0.8);z-index:300;display:flex;align-items:center;justify-content:center;cursor:zoom-out}
        .lightbox img{max-width:90vw;max-height:90vh;border-radius:6px}
        .tab-btn{background:none;border:none;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap}
        .sec-btn{background:none;border:1px solid transparent;cursor:pointer;font-family:inherit;transition:all .15s;border-radius:5px;padding:5px 10px;font-size:11px;white-space:nowrap}
        .sec-btn.active{background:#f1f5f9;border-color:#6366f1;color:#4338ca}
        .sec-btn:not(.active){color:#64748b}
        .sec-btn:not(.active):hover{color:#475569;border-color:#94a3b8}
        .float-entry{animation:floatIn .18s cubic-bezier(.34,1.56,.64,1)}
        @keyframes floatIn{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
      `}</style>

      <Header
        moveLogCount={(moveLog as unknown[]).length}
        isAdmin={isAdmin}
        onReportFault={() => setModal({ type: "reportfault" })}
        onReport={() => setModal({ type: "report" })}
        onExportCSV={() => { const a = document.createElement("a"); a.href = "/api/export"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
        onImport={() => setModal({ type: "import" })}
        onMoveLog={() => setModal({ type: "movelog" })}
        onSettings={() => setModal({ type: "settings" })}
        onProfile={() => setModal({ type: "changepassword" })}
        userName={(session?.user as { name?: string })?.name ?? ""}
        schoolName={(session?.user as { schoolName?: string })?.schoolName ?? ""}
        onResetDemo={async () => {
          if (!confirm("Reset demo to default state? All changes will be lost.")) return;
          await fetch("/api/demo/reset", { method: "POST" });
          window.location.reload();
        }}
      />

      <StatsBar stats={stats} onClickStat={handleStatClick} />

      <TabNav tab={tab} setTab={setTab} />

      <div style={{ flex: 1, overflow: "auto", padding: "14px 16px" }}>
        {tab === "sections" && (
          <SectionsView
            items={items as Item[]}
            sections={sections}
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            onSelectItem={openItem}
            onAddItem={loc => setModal({ type: "additem", location: loc })}
            onDragItemStart={onDragItemStart}
            onDragItemEnd={onDragItemEnd}
            onRoomDragOver={onRoomDragOver}
            onRoomDrop={onRoomDrop}
            dragOverRoom={dragOverRoom}
            onRoomCardDragStart={onRoomCardDragStart}
            onRoomCardDrop={onRoomCardDrop}
            onMoveItem={item => setModal({ type: "move", item: item as unknown, pendingLocation: null })}
            dragItem={dragItem}
            dragRoom={dragRoom}
            selectedItems={selectedItems}
            onToggleSelect={toggleSelectItem}
            typeIcons={typeIcons}
          />
        )}
        {tab === "list" && (
          <ListView
            items={items as Item[]}
            search={search}
            setSearch={setSearch}
            filterType={filterType}
            setFilterType={setFilterType}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            onSelectItem={openItem}
            typeIcons={typeIcons}
          />
        )}
        {tab === "faults" && (
          <FaultsView
            items={items as Item[]}
            onSelectItem={openItem}
            onUpdateFault={onUpdateFault}
            setLightbox={setLightbox}
          />
        )}
        {tab === "loans" && (
          <LoansView
            items={items as Item[]}
            onSelectItem={openItem}
            onReturn={item => setModal({ type: "return", item: item as unknown })}
            onLoanOut={item => setModal({ type: "loanout", item: item as unknown })}
          />
        )}
      </div>

      {selectedItem && (
        <div className="float-entry">
          <DetailPanel
            item={selectedItem as Item}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            onClose={() => setSelectedItem(null)}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
            onAddRepair={handleAddRepair}
            onReportFault={() => setModal({ type: "fault", item: selectedItem })}
            onUpdateFault={handleUpdateFaultInPanel}
            onMove={() => setModal({ type: "move", item: selectedItem, pendingLocation: null })}
            onLoanOut={() => setModal({ type: "loanout", item: selectedItem })}
            onReturn={() => setModal({ type: "return", item: selectedItem })}
            setLightbox={setLightbox}
            allLocations={Object.values(sections).flat()}
            itemTypes={itemTypes}
            typeIcons={typeIcons}
          />
        </div>
      )}

      {modal?.type === "move" && (
        <MoveModal
          item={(modal.item as Item) ?? ({} as Item)}
          pendingLocation={modal.pendingLocation as string | null}
          allLocations={Object.values(sections).flat()}
          onMove={handleMove}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "reportfault" && (
        <ReportFaultModal
          items={items as Item[]}
          typeIcons={typeIcons}
          onPickItem={(item) => setModal({ type: "fault", item })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "fault" && (
        <FaultModal
          item={(modal.item as Item) ?? ({} as Item)}
          faultTypes={faultTypes}
          onSubmit={handleFaultSubmit}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "loanout" && (
        <LoanOutModal
          item={(modal.item as Item) ?? ({} as Item)}
          onSubmit={handleLoanOut}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "return" && (
        <ReturnModal
          item={(modal.item as Item) ?? ({} as Item)}
          allLocations={Object.values(sections).flat()}
          onSubmit={handleReturn}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "report" && (
        <ReportModal items={items as Item[]} onClose={() => setModal(null)} />
      )}
      {modal?.type === "movelog" && (
        <MoveLogModal
          log={moveLog as Array<{ id: string; itemLabel: string; from: string; to: string; reason: string; movedBy?: string; date: string }>}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "additem" && (
        <AddItemModal
          location={(modal.location as string) ?? ""}
          onAdd={handleAddItem}
          itemTypes={itemTypes}
          typeIcons={typeIcons}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "import" && (
        <ImportModal
          onSuccess={async () => { setModal(null); await refreshItems(); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "bulkmove" && (
        <BulkMoveModal
          count={selectedItems.size}
          allLocations={Object.values(sections).flat()}
          onMove={handleBulkMove}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "changepassword" && (
        <ChangePasswordModal onClose={() => setModal(null)} />
      )}
      {modal?.type === "settings" && (
        <SettingsModal
          sectionsData={sectionsRaw}
          onAddSection={handleAddSection}
          onRenameSection={handleRenameSection}
          onDeleteSection={handleDeleteSection}
          onAddRoom={handleAddRoom}
          onRenameRoom={handleRenameRoom}
          onDeleteRoom={handleDeleteRoom}
          onMoveRoom={handleMoveRoom}
          itemTypes={itemTypes}
          typeIcons={typeIcons}
          onUpdateTypes={async (types: string[], icons: Record<string, string>) => {
            await api.types.update(types, icons);
            setItemTypes(types);
            setTypeIcons(icons);
          }}
          faultTypes={faultTypes}
          onUpdateFaultTypes={async (types: string[]) => {
            await api.faultTypes.update(types);
            setFaultTypes(types);
          }}
          onResetAllData={async () => {
            await api.reset();
            await refreshItems();
            await refreshSections();
          }}
          onClose={() => setModal(null)}
        />
      )}

      {selectedItems.size > 0 && (
        <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "#ffffff", border: "1px solid #6366f1", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, zIndex: 190, boxShadow: "0 4px 20px rgba(15,23,42,0.3)" }}>
          <span style={{ fontSize: 11, color: "#4338ca" }}>{selectedItems.size} items selected</span>
          <button className="btn" onClick={() => setModal({ type: "bulkmove" })} style={{ fontSize: 10, padding: "3px 10px" }}>⇄ Move All</button>
          <button onClick={clearSelection} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 12 }}>✕ Clear</button>
        </div>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}
