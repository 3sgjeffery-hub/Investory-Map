import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

/* ------------------------------------------------------------------ */
/*  Section → Room mapping for the demo school                        */
/* ------------------------------------------------------------------ */

const DEMO_SECTIONS: Record<string, string[]> = {
  "PAC & Ground": [
    "HALL", "D1-05 PAC Lobby", "D1-01 Dance Studio", "D1-02 PAL Room 1",
    "D1-02 PAL Room 2", "E1-01 Music Room 1", "E1-02 Band Room",
    "E1-03 Music Room 2", "Conference Room", "B2-06 Teaching lab", "ITLR",
    "Learning Room 1", "Learning Lab 1", "Learning Lab 2", "Learning Lab 3",
    "LSP", "LSM", "LBS1", "Art Room 1", "Art Room 2", "Science Lab 1",
    "Science Lab 2", "Spare", "Meeting Room 2", "Meeting Room 4",
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
  "Floor 6": [
    "E6-01", "E6-02", "E6-03", "F6-01", "F6-02", "F6-03",
  ],
  "Floor 7": [
    "E7-01", "E7-02", "E7-03", "F7-01", "F7-02", "F7-03",
  ],
  "iPad Carts": ["Cart E2-01", "Cart E3-04", "Pencil Cart E2-01"],
  "Teacher Equipment": [
    "Custody",
    ...Array.from({ length: 16 }, (_, i) => `Teacher ${i + 1}`),
  ],
  "Condemned / Pending Disposal": ["Condemned / Pending Disposal"],
};

/* ------------------------------------------------------------------ */
/*  Valid statuses — anything else defaults to "Operational"           */
/* ------------------------------------------------------------------ */

const VALID_STATUSES = new Set([
  "Operational",
  "Spare",
  "Under Maintenance",
  "Waiting for Condemnation",
  "Faulty",
  "Others",
]);

/* ------------------------------------------------------------------ */
/*  CSV parser — handles quoted fields with commas and newlines        */
/* ------------------------------------------------------------------ */

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        current.push(field);
        field = "";
        i++;
      } else if (ch === "\n" || (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n")) {
        current.push(field);
        field = "";
        rows.push(current);
        current = [];
        i += ch === "\r" ? 2 : 1;
      } else if (ch === "\r") {
        // Bare \r (old Mac line ending)
        current.push(field);
        field = "";
        rows.push(current);
        current = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Push final field / row
  if (field || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/*  Date parser — handles multiple formats                            */
/* ------------------------------------------------------------------ */

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseWarrantyDate(raw: string | undefined): Date | null {
  if (!raw || raw.trim() === "") return null;
  const s = raw.trim();

  // DD/MM/YYYY  (e.g. "20/6/2025")
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }

  // DD-Mon-YY or DD-Mon-YYYY  (e.g. "24-Nov-27", "16-Jun-28", "5-Jul-23")
  const dashMonMatch = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (dashMonMatch) {
    const [, dd, mon, yrStr] = dashMonMatch;
    const monthIdx = MONTH_MAP[mon.toLowerCase()];
    if (monthIdx !== undefined) {
      let year = Number(yrStr);
      if (year < 100) {
        // Two-digit year: 00-49 → 2000-2049, 50-99 → 1950-1999
        year += year < 50 ? 2000 : 1900;
      }
      return new Date(year, monthIdx, Number(dd));
    }
  }

  // Fallback: try native Date parsing
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  return null;
}

/* ------------------------------------------------------------------ */
/*  Normalise status — non-valid values become "Operational"           */
/* ------------------------------------------------------------------ */

function normaliseStatus(raw: string | undefined): string {
  if (!raw || raw.trim() === "") return "Operational";
  const s = raw.trim();
  if (VALID_STATUSES.has(s)) return s;
  return "Operational";
}

/* ------------------------------------------------------------------ */
/*  POST handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST() {
  try {
    // 1. Create or find the demo school and user
    const school = await prisma.school.upsert({
      where: { code: "DEMO" },
      update: {},
      create: { name: "Demo School", code: "DEMO", address: "Demo" },
      select: { id: true },
    });
    const schoolId = school.id;

    const passwordHash = await bcrypt.hash("demo", 12);
    await prisma.user.upsert({
      where: { email: "demo@investorymap.com" },
      update: { passwordHash, schoolId },
      create: {
        email: "demo@investorymap.com",
        passwordHash,
        name: "Demo Admin",
        role: "SCHOOL_ADMIN",
        schoolId,
      },
    });

    await prisma.user.upsert({
      where: { email: "teacher@demo.investorymap.com" },
      update: { passwordHash, schoolId },
      create: {
        email: "teacher@demo.investorymap.com",
        passwordHash,
        name: "Demo Teacher",
        role: "USER",
        schoolId,
      },
    });

    // 2. Delete all existing data for the demo school
    await prisma.$transaction([
      prisma.faultReport.deleteMany({ where: { schoolId } }),
      prisma.moveLogEntry.deleteMany({ where: { schoolId } }),
      prisma.auditLogEntry.deleteMany({ where: { schoolId } }),
      prisma.item.deleteMany({ where: { schoolId } }),
      prisma.section.deleteMany({ where: { schoolId } }),
    ]);

    // 3. Read and parse the CSV file
    const csvPath = path.join(process.cwd(), "prisma", "demo-data.csv");
    if (!fs.existsSync(csvPath)) {
      console.error("[api/demo/reset] CSV not found at:", csvPath, "cwd:", process.cwd());
      return NextResponse.json(
        { error: "Demo data file not found" },
        { status: 500 }
      );
    }
    const csvText = fs.readFileSync(csvPath, "utf-8");
    const allRows = parseCSV(csvText);

    if (allRows.length < 2) {
      return NextResponse.json(
        { error: "CSV file is empty or has no data rows" },
        { status: 400 }
      );
    }

    // First row is headers
    const headers = allRows[0].map((h) => h.trim().toLowerCase());
    const dataRows = allRows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));

    // Build header index
    const col = (name: string): number => headers.indexOf(name);

    // 4. Build a set of all known rooms across all sections
    const knownRooms = new Set<string>();
    for (const rooms of Object.values(DEMO_SECTIONS)) {
      for (const room of rooms) {
        knownRooms.add(room);
      }
    }

    // 5. Parse items from CSV and collect unknown locations
    const items: Array<{
      label: string;
      assetCode: string | null;
      type: string;
      brand: string | null;
      model: string | null;
      serial: string | null;
      locationName: string;
      cost: number | null;
      warrantyEnd: Date | null;
      status: string;
      loanable: boolean;
      loanedTo: string | null;
      isLoaned: boolean;
      remark: string | null;
      comment: string | null;
    }> = [];

    const unknownLocations = new Set<string>();

    for (const row of dataRows) {
      const get = (name: string): string => {
        const idx = col(name);
        return idx >= 0 && idx < row.length ? row[idx].trim() : "";
      };

      const location = get("location") || "Spare";
      if (!knownRooms.has(location)) {
        unknownLocations.add(location);
      }

      const costStr = get("cost");
      const loanableStr = get("loanable");
      const loanedToStr = get("loanedto") || get("loaned_to") || get("loanedto");
      const isLoanedStr = get("isloaned") || get("is_loaned") || get("isloaned");

      items.push({
        label: get("label") || "Unnamed",
        assetCode: get("assetcode") || get("asset_code") || null,
        type: get("type") || "Projector",
        brand: get("brand") || null,
        model: get("model") || null,
        serial: get("serialnumber") || get("serial_number") || get("serial") || null,
        locationName: location,
        cost: costStr ? parseFloat(costStr) || null : null,
        warrantyEnd: parseWarrantyDate(get("warrantyend") || get("warranty_end")),
        status: normaliseStatus(get("status")),
        loanable: loanableStr === "Yes" || loanableStr === "true" || loanableStr === "TRUE",
        loanedTo: loanedToStr || null,
        isLoaned: isLoanedStr === "true" || isLoanedStr === "TRUE" || isLoanedStr === "Yes",
        remark: get("remark") || null,
        comment: get("comment") || null,
      });
    }

    // 6. Add unknown locations to "Teacher Equipment" section
    const sectionsToCreate = { ...DEMO_SECTIONS };
    if (unknownLocations.size > 0) {
      const teacherRooms = [...sectionsToCreate["Teacher Equipment"]];
      for (const loc of unknownLocations) {
        if (!teacherRooms.includes(loc)) {
          teacherRooms.push(loc);
        }
      }
      sectionsToCreate["Teacher Equipment"] = teacherRooms;
    }

    // 7. Create sections and rooms
    let sectionOrder = 0;
    for (const [sectionName, roomNames] of Object.entries(sectionsToCreate)) {
      const isProtected = sectionName === "Condemned / Pending Disposal";
      await prisma.section.create({
        data: {
          schoolId,
          name: sectionName,
          sortOrder: sectionOrder++,
          isProtected,
          rooms: {
            create: roomNames.map((roomName, idx) => ({
              name: roomName,
              sortOrder: idx,
            })),
          },
        },
      });
    }

    // 8. Create items
    if (items.length > 0) {
      await prisma.item.createMany({
        data: items.map((item) => ({
          schoolId,
          label: item.label,
          assetCode: item.assetCode,
          type: item.type,
          brand: item.brand,
          model: item.model,
          serial: item.serial,
          locationName: item.locationName,
          cost: item.cost,
          warrantyEnd: item.warrantyEnd,
          status: item.status,
          loanable: item.loanable,
          loanedTo: item.loanedTo,
          isLoaned: item.isLoaned,
          remark: item.remark,
          comment: item.comment,
        })),
      });
    }

    // 9. Seed sample fault reports for demo
    const teacherUser = await prisma.user.findFirst({
      where: { email: "teacher@demo.investorymap.com" },
    });
    const sampleItems = await prisma.item.findMany({
      where: { schoolId },
      take: 2,
    });
    if (teacherUser && sampleItems.length >= 2) {
      await prisma.faultReport.createMany({
        data: [
          {
            schoolId,
            itemId: sampleItems[0].id,
            roomName: sampleItems[0].locationName,
            faultType: "No display",
            severity: "High",
            description: "Projector not turning on when power button is pressed",
            reportedBy: "Demo Teacher",
            reporterId: teacherUser.id,
            status: "Pending",
          },
          {
            schoolId,
            itemId: sampleItems[1].id,
            roomName: sampleItems[1].locationName,
            faultType: "Loose connection",
            severity: "Low",
            description: "HDMI cable loose, intermittent signal",
            reportedBy: "Demo Teacher",
            reporterId: teacherUser.id,
            status: "Pending",
          },
        ],
      });
    }

    return NextResponse.json({ success: true, items: items.length });
  } catch (e: unknown) {
    console.error("[api/demo/reset] unexpected error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
