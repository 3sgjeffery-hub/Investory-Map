import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-guard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-guard")>(
    "@/lib/auth-guard"
  );
  return { ...actual, requireSession: vi.fn() };
});

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    item: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    fault: { count: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/import/route";
import { GET as GET_EXPORT } from "@/app/api/export/route";
import { GET as GET_REPORTS } from "@/app/api/reports/route";

const adminUser = { id: "user1", role: "SCHOOL_ADMIN", schoolId: "sch_1" };
const regularUser = { id: "user2", role: "USER", schoolId: "sch_1" };

describe("POST /api/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 with imported count on success", async () => {
    (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminUser);
    (prisma.item.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.item.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 3,
    });

    const req = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { label: "Projector A", type: "Projector", location: "HALL" },
          { label: "Projector B", type: "Projector", location: "ROOM_1" },
          { label: "iPad 1", type: "iPad", location: "Spare" },
        ],
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual({ imported: 3, skipped: 0 });
    expect(prisma.item.createMany).toHaveBeenCalledOnce();
  });

  it("returns 403 for non-admin USER role", async () => {
    (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(regularUser);

    const req = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ label: "X" }] }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Forbidden");
    expect(prisma.item.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when items is empty array", async () => {
    (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminUser);

    const req = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("No items provided");
    expect(prisma.item.createMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with Content-Type text/csv", async () => {
    (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminUser);
    (prisma.item.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "item1",
        label: "Projector A",
        assetCode: "ASS001",
        type: "Projector",
        brand: "Epson",
        model: "EB-X51",
        serial: "SN123",
        locationName: "HALL",
        cost: 1200,
        warrantyEnd: new Date("2025-12-31"),
        status: "Operational",
        loanable: false,
        loanedTo: null,
        remark: null,
        comment: null,
        faults: [],
        repairs: [],
      },
    ]);

    const req = new NextRequest("http://localhost/api/export");
    const res = await GET_EXPORT(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");

    const text = await res.text();
    expect(text).toContain("Label");
    expect(text).not.toContain('"ID"');
    expect(text).toContain("Projector A");
  });
});

describe("GET /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with stats, byType, byBrand, warrantyExpired", async () => {
    (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminUser);

    const pastDate = new Date("2020-01-01");
    (prisma.item.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "item1",
        label: "Projector A",
        type: "Projector",
        brand: "Epson",
        model: "EB-X51",
        status: "Operational",
        isLoaned: false,
        warrantyEnd: pastDate,
        locationName: "HALL",
      },
      {
        id: "item2",
        label: "iPad 1",
        type: "iPad",
        brand: "Apple",
        model: "iPad 10",
        status: "Faulty",
        isLoaned: true,
        warrantyEnd: null,
        locationName: "Jeff",
      },
    ]);
    (prisma.fault.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const req = new NextRequest("http://localhost/api/reports");
    const res = await GET_REPORTS(req);
    const data = await res.json();

    expect(res.status).toBe(200);

    // stats shape
    expect(data).toHaveProperty("stats");
    expect(data).toHaveProperty("byType");
    expect(data).toHaveProperty("byBrand");
    expect(data).toHaveProperty("warrantyExpired");

    // stats values
    expect(data.stats.total).toBe(2);
    expect(data.stats.operational).toBe(1);
    expect(data.stats.faulty).toBe(1);
    expect(data.stats.loaned).toBe(1);
    expect(data.stats.openFaults).toBe(1);
    expect(data.stats.warrantyExpired).toBe(1);
    expect(data.stats.expiringSoon).toBe(0);

    // byType / byBrand
    expect(data.byType["Projector"]).toBe(1);
    expect(data.byType["iPad"]).toBe(1);
    expect(data.byBrand["Epson"]).toBe(1);
    expect(data.byBrand["Apple"]).toBe(1);

    // warrantyExpired list
    expect(data.warrantyExpired).toHaveLength(1);
    expect(data.warrantyExpired[0].label).toBe("Projector A");
  });

  it("counts expiringSoon items within 90 days", async () => {
    (requireSession as any).mockResolvedValue({
      id: "user1",
      role: "SCHOOL_ADMIN",
      schoolId: "sch_1",
    });

    const soon = new Date();
    soon.setDate(soon.getDate() + 30);

    (prisma.item.findMany as any).mockResolvedValue([
      { id: "i1", type: "Projector", brand: "Sony", status: "Operational", isLoaned: false, warrantyEnd: soon, label: "P01", model: "M1", locationName: "Room A" },
    ]);
    (prisma.fault.count as any).mockResolvedValue(0);

    const req = new NextRequest("http://localhost/api/reports");
    const res = await GET_REPORTS(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stats.expiringSoon).toBe(1);
    expect(data.stats.warrantyExpired).toBe(0);
  });
});
