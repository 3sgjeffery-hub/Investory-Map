import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-guard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-guard")>(
    "@/lib/auth-guard"
  );
  return {
    ...actual,
    requireSession: vi.fn(),
    requireAdmin: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => {
  const prismaMock = {
    item: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    fault: {
      create: vi.fn(),
      count: vi.fn(),
    },
    faultReport: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(prismaMock)),
  };
  return { prisma: prismaMock };
});

import { requireSession, requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { POST, GET } from "@/app/api/fault-reports/route";
import { PUT } from "@/app/api/fault-reports/[reportId]/route";

describe("POST /api/fault-reports", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a pending fault report for any authenticated user", async () => {
    (requireSession as any).mockResolvedValue({
      id: "user1",
      name: "Ms Tan",
      role: "USER",
      schoolId: "sch_1",
    });

    (prisma.item.findFirst as any).mockResolvedValue({
      id: "item1",
      schoolId: "sch_1",
      label: "Projector P01",
    });

    (prisma.faultReport.create as any).mockImplementation(async (args: any) => ({
      id: "fr_1",
      ...args.data,
      createdAt: new Date(),
    }));

    const req = new NextRequest("http://localhost/api/fault-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: "item1",
        roomName: "Room 3-1",
        faultType: "No display",
        severity: "High",
        description: "Projector won't turn on",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    expect(prisma.faultReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: "sch_1",
        itemId: "item1",
        roomName: "Room 3-1",
        faultType: "No display",
        severity: "High",
        description: "Projector won't turn on",
        reportedBy: "Ms Tan",
        reporterId: "user1",
        status: "Pending",
      }),
    });
  });

  it("returns 404 when item does not exist", async () => {
    (requireSession as any).mockResolvedValue({
      id: "user1", name: "Ms Tan", role: "USER", schoolId: "sch_1",
    });
    (prisma.item.findFirst as any).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/fault-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: "nonexistent",
        roomName: "Room 3-1",
        faultType: "No display",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 when item belongs to another school", async () => {
    (requireSession as any).mockResolvedValue({
      id: "user1", name: "Ms Tan", role: "USER", schoolId: "sch_1",
    });
    (prisma.item.findFirst as any).mockResolvedValue({
      id: "item_other", schoolId: "sch_2",
    });

    const req = new NextRequest("http://localhost/api/fault-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: "item_other",
        roomName: "Room 1",
        faultType: "Broken",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 on missing required fields", async () => {
    (requireSession as any).mockResolvedValue({
      id: "user1", name: "Ms Tan", role: "USER", schoolId: "sch_1",
    });

    const req = new NextRequest("http://localhost/api/fault-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: "item1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/fault-reports", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all reports for admin", async () => {
    (requireSession as any).mockResolvedValue({
      id: "admin1", name: "Admin", role: "SCHOOL_ADMIN", schoolId: "sch_1",
    });

    (prisma.faultReport.findMany as any).mockResolvedValue([
      { id: "fr_1", status: "Pending", item: { id: "item1", label: "P01", type: "Projector", locationName: "Room 3-1" } },
    ]);

    const req = new NextRequest("http://localhost/api/fault-reports");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(prisma.faultReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId: "sch_1" },
      })
    );
  });

  it("returns only own reports for USER role", async () => {
    (requireSession as any).mockResolvedValue({
      id: "user1", name: "Ms Tan", role: "USER", schoolId: "sch_1",
    });

    (prisma.faultReport.findMany as any).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/fault-reports");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(prisma.faultReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId: "sch_1", reporterId: "user1" },
      })
    );
  });
});

describe("PUT /api/fault-reports/[reportId] — approve/reject", () => {
  beforeEach(() => vi.clearAllMocks());

  it("approves a pending report — creates fault + auto-escalates item", async () => {
    (requireAdmin as any).mockResolvedValue({
      id: "admin1", name: "Admin Lee", role: "SCHOOL_ADMIN", schoolId: "sch_1",
    });

    (prisma.faultReport.findFirst as any).mockResolvedValue({
      id: "fr_1",
      schoolId: "sch_1",
      itemId: "item1",
      faultType: "No display",
      severity: "High",
      description: "Won't turn on",
      photos: [],
      reportedBy: "Ms Tan",
      status: "Pending",
    });

    (prisma.item.findFirst as any).mockResolvedValue({
      id: "item1",
      schoolId: "sch_1",
      status: "Operational",
    });

    (prisma.fault.create as any).mockImplementation(async (args: any) => ({
      id: "fault_new",
      ...args.data,
    }));
    (prisma.item.update as any).mockResolvedValue({});
    (prisma.faultReport.update as any).mockImplementation(async (args: any) => ({
      id: "fr_1",
      ...args.data,
    }));

    const req = new NextRequest("http://localhost/api/fault-reports/fr_1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });

    const res = await PUT(req, { params: Promise.resolve({ reportId: "fr_1" }) });
    expect(res.status).toBe(200);

    expect(prisma.fault.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemId: "item1",
        faultType: "No display",
        severity: "High",
      }),
    });
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "item1" },
      data: { status: "Faulty" },
    });
    expect(prisma.faultReport.update).toHaveBeenCalledWith({
      where: { id: "fr_1" },
      data: expect.objectContaining({ status: "Approved" }),
    });
  });

  it("rejects a pending report without creating a fault", async () => {
    (requireAdmin as any).mockResolvedValue({
      id: "admin1", name: "Admin Lee", role: "SCHOOL_ADMIN", schoolId: "sch_1",
    });

    (prisma.faultReport.findFirst as any).mockResolvedValue({
      id: "fr_1",
      schoolId: "sch_1",
      itemId: "item1",
      status: "Pending",
    });

    (prisma.faultReport.update as any).mockImplementation(async (args: any) => ({
      id: "fr_1",
      ...args.data,
    }));

    const req = new NextRequest("http://localhost/api/fault-reports/fr_1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", reviewNote: "Not reproducible" }),
    });

    const res = await PUT(req, { params: Promise.resolve({ reportId: "fr_1" }) });
    expect(res.status).toBe(200);

    expect(prisma.fault.create).not.toHaveBeenCalled();
    expect(prisma.faultReport.update).toHaveBeenCalledWith({
      where: { id: "fr_1" },
      data: expect.objectContaining({
        status: "Rejected",
        reviewNote: "Not reproducible",
      }),
    });
  });

  it("returns 400 when reviewing an already-reviewed report", async () => {
    (requireAdmin as any).mockResolvedValue({
      id: "admin1", name: "Admin Lee", role: "SCHOOL_ADMIN", schoolId: "sch_1",
    });

    (prisma.faultReport.findFirst as any).mockResolvedValue({
      id: "fr_1",
      schoolId: "sch_1",
      status: "Approved",
    });

    const req = new NextRequest("http://localhost/api/fault-reports/fr_1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });

    const res = await PUT(req, { params: Promise.resolve({ reportId: "fr_1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 403 when report belongs to another school", async () => {
    (requireAdmin as any).mockResolvedValue({
      id: "admin1", name: "Admin", role: "SCHOOL_ADMIN", schoolId: "sch_1",
    });

    (prisma.faultReport.findFirst as any).mockResolvedValue({
      id: "fr_other",
      schoolId: "sch_2",
      status: "Pending",
    });

    const req = new NextRequest("http://localhost/api/fault-reports/fr_other", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });

    const res = await PUT(req, { params: Promise.resolve({ reportId: "fr_other" }) });
    expect(res.status).toBe(403);
  });
});
