/**
 * Demo seed script — creates a "Demo School" with sections, rooms, and items
 * read from prisma/demo-data.csv.
 *
 * Usage:  npx tsx prisma/seed-demo.ts
 *         (or: npm run seed:demo)
 *
 * Idempotent: deletes all existing data for the demo school before re-seeding.
 */

import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Prisma setup (same adapter pattern as seed.ts)
// ---------------------------------------------------------------------------
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEMO_SCHOOL_CODE = "DEMO";
const DEMO_SCHOOL_NAME = "Demo School";
const DEMO_EMAIL = "demo@investorymap.com";
const DEMO_PASSWORD = "demo";
const CONDEMNED_SECTION = "Condemned / Pending Disposal";

// Valid statuses (from constants.ts)
const VALID_STATUSES = new Set([
  "Operational",
  "Spare",
  "Under Maintenance",
  "Waiting for Condemnation",
  "Others",
  "Faulty",
]);

// ---------------------------------------------------------------------------
// Section → Room mapping (matches the task spec exactly)
// ---------------------------------------------------------------------------
const SECTION_ROOMS: Record<string, string[]> = {
  "PAC & Ground": [
    "HALL", "D1-05 PAC Lobby", "D1-01 Dance Studio", "D1-02 PAL Room 1",
    "D1-02 PAL Room 2", "E1-01 Music Room 1", "E1-02 Band Room",
    "E1-03 Music Room 2", "Conference Room", "B2-06 Teaching lab", "ITLR",
    "Learning Room 1", "Learning Lab 1", "Learning Lab 2", "Learning Lab 3",
    "LSP", "LSM", "LBS1", "Art Room 1", "Art Room 2",
    "Science Lab 1", "Science Lab 2", "Spare", "Meeting Room 2", "Meeting Room 4",
  ],
  "Floor 2": ["F2-01", "F2-02", "F2-03"],
  "Floor 3": [
    "E3-02 SBB Room 1", "E3-03 SBB Room 2", "E3-04 Math Room",
    "F3-01", "F3-02", "G3-01", "G3-02", "G3-03", "G3-04", "G3-05", "G3-06",
  ],
  "Floor 4": [
    "E4-01", "E4-02", "E4-03", "F4-01", "F4-02", "F4-03",
    "G4-01", "G4-02", "G4-03",
  ],
  "Floor 5": [
    "E5-01", "E5-02", "E5-03", "F5-01", "F5-02", "F5-03",
    "G5-01", "G5-02", "G5-03",
  ],
  "Floor 6": ["E6-01", "E6-02", "E6-03", "F6-01", "F6-02", "F6-03"],
  "Floor 7": ["E7-01", "E7-02", "E7-03", "F7-01", "F7-02", "F7-03"],
  "iPad Carts": ["Cart E2-01", "Cart E3-04", "Pencil Cart E2-01", "F4-03"],
  "Teacher Equipment": ["Custody"],
  [CONDEMNED_SECTION]: [CONDEMNED_SECTION],
};

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields with embedded commas and newlines
// ---------------------------------------------------------------------------
function parseCSV(content: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = content.split("\n");
  let headers: string[] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let headerParsed = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          currentField += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          currentRow.push(currentField.trim());
          currentField = "";
        } else {
          currentField += ch;
        }
      }
    }

    // If still inside quotes, the field spans multiple lines
    if (inQuotes) {
      currentField += "\n";
      continue;
    }

    // End of logical row
    currentRow.push(currentField.trim());
    currentField = "";

    if (!headerParsed) {
      headers = currentRow;
      headerParsed = true;
    } else if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
      const record: Record<string, string> = {};
      for (let h = 0; h < headers.length; h++) {
        record[headers[h]] = currentRow[h] ?? "";
      }
      rows.push(record);
    }

    currentRow = [];
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Date parser — handles "20/6/2025", "24-Nov-27", "16-Jun-28", etc.
// ---------------------------------------------------------------------------
const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDate(value: string): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;

  // DD/MM/YYYY
  const slashMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = parseInt(slashMatch[3], 10);
    return new Date(year, month, day);
  }

  // DD-Mon-YY or DD-Mon-YYYY
  const dashMatch = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (dashMatch) {
    const day = parseInt(dashMatch[1], 10);
    const monthStr = dashMatch[2].toLowerCase();
    let year = parseInt(dashMatch[3], 10);
    if (year < 100) {
      // Two-digit year: 00-49 → 2000s, 50-99 → 1900s
      year += year < 50 ? 2000 : 1900;
    }
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }

  // Try native Date parsing as fallback
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d;

  return null;
}

// ---------------------------------------------------------------------------
// Status normaliser — non-standard values become "Operational"
// ---------------------------------------------------------------------------
function normaliseStatus(value: string): string {
  const trimmed = value.trim();
  if (VALID_STATUSES.has(trimmed)) return trimmed;
  // Data issue: warranty date or garbage leaked into status column
  return "Operational";
}

// ---------------------------------------------------------------------------
// Location → section resolver
// ---------------------------------------------------------------------------
function buildLocationLookup(sectionRooms: Record<string, string[]>): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [section, rooms] of Object.entries(sectionRooms)) {
    for (const room of rooms) {
      // First mapping wins (e.g. F4-03 appears in Floor 4 and iPad Carts;
      // iPad Carts is listed after, so it takes priority for items in that room)
      lookup.set(room.toLowerCase(), section);
    }
  }
  return lookup;
}

function isTeacherOrCustody(location: string): boolean {
  const lower = location.toLowerCase().trim();
  if (lower === "custody" || lower === "jeff (custody)") return true;
  if (lower.startsWith("teacher")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Demo Seed ===\n");

  // 1. Read CSV
  const csvPath = path.resolve(__dirname, "demo-data.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    console.error("Please place the demo data CSV at prisma/demo-data.csv");
    process.exit(1);
  }
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(csvContent);
  console.log(`Parsed ${rows.length} rows from CSV\n`);

  // 2. Create/upsert demo school
  const school = await prisma.school.upsert({
    where: { code: DEMO_SCHOOL_CODE },
    update: { name: DEMO_SCHOOL_NAME },
    create: {
      name: DEMO_SCHOOL_NAME,
      code: DEMO_SCHOOL_CODE,
      address: "Demo School Address",
    },
  });
  console.log(`School: ${school.name} (${school.code}) — ${school.id}`);

  // 3. Create/upsert demo user
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash, schoolId: school.id },
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      name: "Demo Admin",
      role: Role.SCHOOL_ADMIN,
      schoolId: school.id,
    },
  });
  console.log(`User: ${user.email} (${user.role})\n`);

  // 4. Delete existing data for this school (order matters for FK constraints)
  console.log("Clearing existing demo school data...");
  await prisma.auditLogEntry.deleteMany({ where: { schoolId: school.id } });
  await prisma.moveLogEntry.deleteMany({ where: { schoolId: school.id } });
  // Faults, repairs, loanEntries are cascaded from items — but delete explicitly to be safe
  const existingItems = await prisma.item.findMany({
    where: { schoolId: school.id },
    select: { id: true },
  });
  if (existingItems.length > 0) {
    const itemIds = existingItems.map((i) => i.id);
    await prisma.loanEntry.deleteMany({ where: { itemId: { in: itemIds } } });
    await prisma.repair.deleteMany({ where: { itemId: { in: itemIds } } });
    await prisma.fault.deleteMany({ where: { itemId: { in: itemIds } } });
  }
  await prisma.item.deleteMany({ where: { schoolId: school.id } });
  // Rooms are cascaded from sections, but delete sections explicitly
  const existingSections = await prisma.section.findMany({
    where: { schoolId: school.id },
    select: { id: true },
  });
  if (existingSections.length > 0) {
    const sectionIds = existingSections.map((s) => s.id);
    await prisma.room.deleteMany({ where: { sectionId: { in: sectionIds } } });
  }
  await prisma.section.deleteMany({ where: { schoolId: school.id } });
  console.log("Cleared.\n");

  // 5. Collect all unique locations from CSV and determine rooms per section
  const locationLookup = buildLocationLookup(SECTION_ROOMS);
  const dynamicTeacherRooms = new Set<string>();
  const unknownRooms = new Set<string>();

  for (const row of rows) {
    const loc = (row["Location"] ?? "").trim();
    if (!loc) continue;

    if (isTeacherOrCustody(loc)) {
      dynamicTeacherRooms.add(loc);
    } else if (!locationLookup.has(loc.toLowerCase())) {
      // Unknown location — goes to Teacher Equipment as catch-all
      unknownRooms.add(loc);
    }
  }

  // Build final section-rooms map including dynamic teacher rooms
  const finalSectionRooms: Record<string, string[]> = { ...SECTION_ROOMS };

  // Merge dynamic teacher rooms (Custody is already in the static map)
  const teacherRoomSet = new Set(finalSectionRooms["Teacher Equipment"] ?? []);
  for (const r of dynamicTeacherRooms) {
    teacherRoomSet.add(r);
  }
  for (const r of unknownRooms) {
    teacherRoomSet.add(r);
  }
  finalSectionRooms["Teacher Equipment"] = Array.from(teacherRoomSet).sort((a, b) => {
    // Sort: "Custody" first, then "Teacher N" by number, then alphabetical
    if (a === "Custody") return -1;
    if (b === "Custody") return 1;
    const aMatch = a.match(/^teacher\s*(\d+)$/i);
    const bMatch = b.match(/^teacher\s*(\d+)$/i);
    if (aMatch && bMatch) return parseInt(aMatch[1]) - parseInt(bMatch[1]);
    if (aMatch) return -1;
    if (bMatch) return 1;
    return a.localeCompare(b);
  });

  // Rebuild the lookup with the final rooms
  const finalLookup = buildLocationLookup(finalSectionRooms);

  // 6. Create sections and rooms
  console.log("Creating sections and rooms...");
  const roomIdByName = new Map<string, string>(); // room name (lowercase) → roomId (unused, but for reference)
  const sectionIdByName = new Map<string, string>();
  let sectionOrder = 0;
  let totalRooms = 0;

  for (const [sectionName, rooms] of Object.entries(finalSectionRooms)) {
    const section = await prisma.section.create({
      data: {
        schoolId: school.id,
        name: sectionName,
        sortOrder: sectionOrder++,
        isProtected: sectionName === CONDEMNED_SECTION,
      },
    });
    sectionIdByName.set(sectionName, section.id);

    for (let i = 0; i < rooms.length; i++) {
      const room = await prisma.room.create({
        data: {
          sectionId: section.id,
          name: rooms[i],
          sortOrder: i,
        },
      });
      roomIdByName.set(rooms[i].toLowerCase(), room.id);
      totalRooms++;
    }
  }

  console.log(`  ${sectionIdByName.size} sections, ${totalRooms} rooms\n`);

  // 7. Create items from CSV
  console.log("Creating items...");
  let itemCount = 0;
  let skipped = 0;

  for (const row of rows) {
    const type = (row["Type"] ?? "").trim();
    if (!type) {
      skipped++;
      continue;
    }

    const location = (row["Location"] ?? "").trim() || "Spare";
    const statusRaw = (row["Status"] ?? "").trim();
    const status = normaliseStatus(statusRaw || "Operational");
    const loanedTo = (row["LoanedTo"] ?? "").trim() || null;
    const costStr = (row["Cost"] ?? "").trim();
    const warrantyStr = (row["WarrantyEnd"] ?? "").trim();
    const loanableStr = (row["Loanable"] ?? "").trim();
    const remarkStr = (row["Remark"] ?? "").trim() || null;
    const commentStr = (row["Comment"] ?? "").trim() || null;
    const labelStr = (row["Label"] ?? "").trim() || "-";
    const assetCode = (row["AssetCode"] ?? "").trim() || null;
    const brand = (row["Brand"] ?? "").trim() || null;
    const modelStr = (row["Model"] ?? "").trim() || null;
    const serial = (row["Serial"] ?? "").trim() || null;

    // Parse cost
    let cost: number | null = null;
    if (costStr) {
      const parsed = parseFloat(costStr.replace(/[,$]/g, ""));
      if (!isNaN(parsed)) cost = parsed;
    }

    // Parse warranty date
    const warrantyEnd = parseDate(warrantyStr);

    // Parse loanable
    const loanable = loanableStr.toLowerCase() === "yes";

    await prisma.item.create({
      data: {
        schoolId: school.id,
        label: labelStr,
        assetCode,
        type,
        brand,
        model: modelStr,
        serial,
        locationName: location,
        cost: cost !== null ? cost : undefined,
        warrantyEnd,
        status,
        loanable,
        isLoaned: !!loanedTo,
        loanedTo,
        remark: remarkStr ? remarkStr.substring(0, 300) : null,
        comment: commentStr ? commentStr.substring(0, 300) : null,
      },
    });
    itemCount++;
  }

  if (unknownRooms.size > 0) {
    console.log(`\n  Note: ${unknownRooms.size} unknown locations added to "Teacher Equipment":`);
    for (const r of unknownRooms) {
      console.log(`    - "${r}"`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Sections: ${sectionIdByName.size}`);
  console.log(`  Rooms:    ${totalRooms}`);
  console.log(`  Items:    ${itemCount}`);
  if (skipped > 0) console.log(`  Skipped:  ${skipped} (no type)`);
  console.log(`\n--- Demo seed complete ---`);
  console.log(`Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
