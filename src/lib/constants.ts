// App-wide constants migrated from InventoryMap.jsx (canonical source).
// Keep in sync with that file until the full migration is complete.

export const APP_TITLE = "Inventory Map";
export const APP_SUBTITLE = "Room-based Asset & Inventory Manager";

export const STATUS_LIST = [
  "Operational",
  "Spare",
  "Under Maintenance",
  "Waiting for Condemnation",
  "Others",
] as const;

// Full set of acceptable status strings for server-side validation.
// Includes "Faulty" — not user-selectable in create forms, but auto-derived
// by fault-escalation logic (see CLAUDE.md "Fault auto-escalation") and
// therefore must round-trip through PUT.
export const STATUS_ENUM_FOR_VALIDATION = [
  ...STATUS_LIST,
  "Faulty",
] as const;

export const STATUS_COLORS: Record<
  string,
  { bg: string; border: string; text: string; badge: string }
> = {
  Operational: {
    bg: "#dcfce7",
    border: "#16a34a",
    text: "#16a34a",
    badge: "#dcfce7",
  },
  Spare: {
    bg: "#e0e7ff",
    border: "#6366f1",
    text: "#4338ca",
    badge: "#e0e7ff",
  },
  "Waiting for Condemnation": {
    bg: "#fee2e2",
    border: "#dc2626",
    text: "#dc2626",
    badge: "#fee2e2",
  },
  Others: {
    bg: "#f1f5f9",
    border: "#78716c",
    text: "#64748b",
    badge: "#f1f5f9",
  },
  "Under Maintenance": {
    bg: "#fef3c7",
    border: "#f59e0b",
    text: "#d97706",
    badge: "#fef3c7",
  },
  Faulty: {
    bg: "#fee2e2",
    border: "#ef4444",
    text: "#dc2626",
    badge: "#fee2e2",
  },
};

export const DEFAULT_ITEM_TYPES = [
  "Projector",
  "Visualiser",
  "Patch Panel",
  "MIC",
  "iPad",
  "iPad Cart",
  "Portable HD",
  "DSLR",
  "Monitor",
  "PRINTER",
  "Mobile Charging Cart",
  "S-Max",
  "Old iPAD",
  "Owned iPAD",
  "DESKTOP",
  "Camera",
  "IPAD",
];

export const TYPE_ICON: Record<string, string> = {
  Projector: "📽",
  Visualiser: "📷",
  "Patch Panel": "🔌",
  PatchPanel: "🔌",
  iPad: "📱",
  "iPad Cart": "🛒",
  "Portable HD": "💾",
  MIC: "🎤",
  DSLR: "📸",
  Monitor: "🖥",
  PRINTER: "🖨",
  "Mobile Charging Cart": "🔋",
  "S-Max": "📱",
  "Old iPAD": "📱",
  "Owned iPAD": "📱",
  DESKTOP: "💻",
  Camera: "📸",
  IPAD: "📱",
  default: "📦",
};

export const FAULT_TYPES = [
  "Lamp burnt out",
  "No display",
  "Colour distortion",
  "Overheating",
  "No power",
  "Remote not working",
  "Lens issue",
  "Fan noise",
  "Connection error",
  "Physical damage",
  "Other",
] as const;

export const SEV_COLORS: Record<string, { bg: string; text: string }> = {
  Low: { bg: "#dcfce7", text: "#16a34a" },
  Medium: { bg: "#fef3c7", text: "#d97706" },
  High: { bg: "#fff7ed", text: "#c2410c" },
  Critical: { bg: "#fee2e2", text: "#dc2626" },
};

export const CONDEMNED_SECTION = "Condemned / Pending Disposal";

export function getTypeIcon(type: string): string {
  return TYPE_ICON[type] || TYPE_ICON.default;
}

export function getStatusColor(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.Others;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Converts a stored date (ISO string or Date) into the `yyyy-MM-dd` value that
// `<input type="date">` requires. Anything else — including the full ISO
// datetime the API returns — makes the browser render the field blank, which
// looks to the user like no date was ever set.
// Uses local date parts so the edit field matches what fmtDate() displays.
export function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isExpired(d: string | Date | null | undefined): boolean {
  if (!d) return false;
  return new Date(d) < new Date();
}

export function expiringSoon(d: string | Date | null | undefined): boolean {
  if (!d) return false;
  const diff =
    (new Date(d).getTime() - new Date().getTime()) / (86400 * 1000);
  return diff > 0 && diff < 90;
}
