# Teacher Fault Reports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers (USER role) submit fault reports from a dedicated `/report` page, reviewed by admins in the existing Faults tab before becoming confirmed faults.

**Architecture:** New `FaultReport` Prisma model stores pending teacher submissions. Three new API routes handle CRUD. Middleware redirects USER role away from `/dashboard` to `/report`. Approval atomically creates a real `Fault` (with auto-escalation) inside a transaction. Admin review UI is added as a collapsible section at the top of `FaultsView`.

**Tech Stack:** Next.js 16 App Router, Prisma 7, PostgreSQL, NextAuth v5, Zod 4, Vitest

## Global Constraints

- All styles are inline — no CSS framework, no CSS files, no CSS variables
- Light theme palette from CLAUDE.md: page bg `#f8fafc`, card bg `#ffffff`, primary text `#1e293b`, muted `#64748b`, indigo accent `#4f46e5`, border `#e2e8f0`
- Font families: `'DM Mono','Courier New',monospace` for body, `'Space Grotesk',sans-serif` for headings
- Multi-tenant: every query scoped by `schoolId` from session — never from request params
- API routes use `requireSession()` / `requireAdmin()` from `src/lib/auth-guard.ts` + `handleApiError()` from `src/lib/api-errors.ts`
- Zod 4 for input validation
- Test pattern: Vitest with mocked Prisma (see `tests/api/faults.test.ts` for exact mock setup)
- TypeScript strict — no `any` except where unavoidable in test mocks
- No comments unless the WHY is non-obvious

## File Structure

| File | Role |
|---|---|
| `prisma/schema.prisma` | Add `FaultReport` model + relations |
| `src/lib/validation/fault-reports.ts` | Zod schemas for create + review |
| `src/app/api/fault-reports/route.ts` | `GET` (list) + `POST` (create) |
| `src/app/api/fault-reports/[reportId]/route.ts` | `PUT` (approve/reject) |
| `src/lib/api-client.ts` | Add `faultReports` namespace |
| `src/middleware.ts` | Redirect USER from `/dashboard` to `/report`, protect `/report` |
| `src/lib/auth.config.ts` | Route USER to `/report` post-login via `authorized` callback |
| `src/app/report/layout.tsx` | Auth guard layout for `/report` |
| `src/app/report/page.tsx` | Teacher report page (server component shell) |
| `src/components/ReportPage.tsx` | Client component — header, form, my-reports |
| `src/components/FaultsView.tsx` | Add pending reports section (admin only) |
| `src/components/TabNav.tsx` | Badge count on Faults tab |
| `src/app/dashboard/page.tsx` | Fetch fault reports, pass to FaultsView + TabNav |
| `src/app/api/demo/reset/route.ts` | Add teacher user + seed FaultReports |
| `prisma/seed-demo.ts` | Same demo changes for CLI seeding |
| `src/app/page.tsx` | Add "Try as Teacher" demo button |
| `src/components/DemoButton.tsx` | Accept props for teacher variant |
| `tests/api/fault-reports.test.ts` | Tests for all three endpoints |

---

### Task 1: Data Model + Validation Schemas

**Files:**
- Modify: `prisma/schema.prisma:15-31` (School model), `prisma/schema.prisma:45-78` (Item model) — add relations
- Modify: `prisma/schema.prisma` — add FaultReport model after AuditLogEntry (line 187)
- Create: `src/lib/validation/fault-reports.ts`

**Interfaces:**
- Produces: `FaultReport` Prisma model, `FaultReportCreateSchema`, `FaultReportReviewSchema`, `FaultReportCreateInput`, `FaultReportReviewInput` types

- [ ] **Step 1: Add FaultReport model to Prisma schema**

Add the following to `prisma/schema.prisma` after the `AuditLogEntry` model (after line 187):

```prisma
model FaultReport {
  id          String    @id @default(cuid())
  schoolId    String
  school      School    @relation(fields: [schoolId], references: [id])
  itemId      String
  item        Item      @relation(fields: [itemId], references: [id], onDelete: Cascade)
  roomName    String
  faultType   String
  severity    String    @default("Medium")
  description String?
  photos      String[]  @default([])
  reportedBy  String
  reporterId  String
  status      String    @default("Pending")
  reviewedBy  String?
  reviewNote  String?
  reviewedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([schoolId])
  @@index([status])
}
```

- [ ] **Step 2: Add relation arrays to School and Item models**

In the `School` model (around line 30), add after `auditLog AuditLogEntry[]`:

```prisma
  faultReports FaultReport[]
```

In the `Item` model (around line 73), add after `loanHistory LoanEntry[]`:

```prisma
  faultReports FaultReport[]
```

- [ ] **Step 3: Run prisma generate to verify schema**

Run: `npx prisma generate`

Expected: Prisma Client generated successfully, no errors.

- [ ] **Step 4: Create Zod validation schemas**

Create `src/lib/validation/fault-reports.ts`:

```typescript
import { z } from "zod";
import { FAULT_SEVERITIES } from "./faults";

export const FAULT_REPORT_STATUSES = ["Pending", "Approved", "Rejected"] as const;

export const FaultReportCreateSchema = z.object({
  itemId: z.string().min(1),
  roomName: z.string().min(1),
  faultType: z.string().min(1),
  severity: z
    .enum(FAULT_SEVERITIES as unknown as [string, ...string[]])
    .default("Medium"),
  description: z.string().optional().nullable(),
  photos: z.array(z.string()).optional().default([]),
});

export const FaultReportReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  severity: z
    .enum(FAULT_SEVERITIES as unknown as [string, ...string[]])
    .optional(),
  faultType: z.string().min(1).optional(),
  reviewNote: z.string().optional().nullable(),
});

export type FaultReportCreateInput = z.infer<typeof FaultReportCreateSchema>;
export type FaultReportReviewInput = z.infer<typeof FaultReportReviewSchema>;
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/lib/validation/fault-reports.ts
git commit -m "Add FaultReport model and Zod validation schemas"
```

---

### Task 2: API Routes + Tests

**Files:**
- Create: `src/app/api/fault-reports/route.ts`
- Create: `src/app/api/fault-reports/[reportId]/route.ts`
- Create: `tests/api/fault-reports.test.ts`

**Interfaces:**
- Consumes: `FaultReportCreateSchema`, `FaultReportReviewSchema` from `src/lib/validation/fault-reports.ts`; `requireSession`, `requireAdmin`, `canAccess`, `isAdmin` from `src/lib/auth-guard.ts`; `resolveSchoolId` from `src/lib/tenant.ts`; `handleApiError` from `src/lib/api-errors.ts`
- Produces: `GET /api/fault-reports` → `FaultReport[]` with `item: { id, label, type, locationName }`; `POST /api/fault-reports` → `FaultReport`; `PUT /api/fault-reports/[reportId]` → `FaultReport`

- [ ] **Step 1: Write tests for POST /api/fault-reports**

Create `tests/api/fault-reports.test.ts`. Follow the exact mock pattern from `tests/api/faults.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run tests/api/fault-reports.test.ts`

Expected: All tests FAIL because the route files don't exist yet.

- [ ] **Step 3: Implement POST + GET /api/fault-reports**

Create `src/app/api/fault-reports/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canAccess, isAdmin } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/api-errors";
import { FaultReportCreateSchema } from "@/lib/validation/fault-reports";

export async function POST(req: NextRequest) {
  try {
    const user = await requireSession();
    const body = await req.json();
    const parsed = FaultReportCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const item = await prisma.item.findFirst({ where: { id: input.itemId } });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (!canAccess(user, item.schoolId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const report = await prisma.faultReport.create({
      data: {
        schoolId: user.schoolId!,
        itemId: input.itemId,
        roomName: input.roomName,
        faultType: input.faultType,
        severity: input.severity,
        description: input.description ?? null,
        photos: input.photos ?? [],
        reportedBy: user.name,
        reporterId: user.id,
        status: "Pending",
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireSession();
    const schoolId = user.schoolId!;
    const statusFilter = req.nextUrl.searchParams.get("status");

    const where: Record<string, unknown> = { schoolId };
    if (!isAdmin(user.role)) {
      where.reporterId = user.id;
    }
    if (statusFilter) {
      where.status = statusFilter;
    }

    const reports = await prisma.faultReport.findMany({
      where,
      include: {
        item: { select: { id: true, label: true, type: true, locationName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reports);
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 4: Implement PUT /api/fault-reports/[reportId]**

Create `src/app/api/fault-reports/[reportId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, canAccess } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/api-errors";
import { FaultReportReviewSchema } from "@/lib/validation/fault-reports";

type Params = { params: Promise<{ reportId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { reportId } = await params;

    const report = await prisma.faultReport.findFirst({
      where: { id: reportId },
    });
    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canAccess(user, report.schoolId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (report.status !== "Pending") {
      return NextResponse.json(
        { error: "Report already reviewed" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = FaultReportReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    if (input.action === "approve") {
      const finalSeverity = input.severity ?? report.severity;
      const finalFaultType = input.faultType ?? report.faultType;

      const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.item.findFirst({ where: { id: report.itemId } });
        if (!item) throw new Error("Item not found");

        await tx.fault.create({
          data: {
            itemId: report.itemId,
            faultType: finalFaultType,
            severity: finalSeverity,
            description: report.description ?? null,
            reportedBy: report.reportedBy,
            photos: report.photos ?? [],
          },
        });

        const escalated =
          finalSeverity === "High" || finalSeverity === "Critical"
            ? "Faulty"
            : item.status === "Operational"
              ? "Under Maintenance"
              : item.status;

        if (escalated !== item.status) {
          await tx.item.update({
            where: { id: report.itemId },
            data: { status: escalated },
          });
        }

        return tx.faultReport.update({
          where: { id: reportId },
          data: {
            status: "Approved",
            severity: finalSeverity,
            faultType: finalFaultType,
            reviewedBy: user.name,
            reviewNote: input.reviewNote ?? null,
            reviewedAt: new Date(),
          },
        });
      });

      return NextResponse.json(updated);
    }

    // Reject
    const updated = await prisma.faultReport.update({
      where: { id: reportId },
      data: {
        status: "Rejected",
        reviewedBy: user.name,
        reviewNote: input.reviewNote ?? null,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `npx vitest run tests/api/fault-reports.test.ts`

Expected: All tests PASS.

- [ ] **Step 6: Run full test suite for regressions**

Run: `npm test`

Expected: All 66+ tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/fault-reports/ tests/api/fault-reports.test.ts
git commit -m "Add fault report API routes with tests"
```

---

### Task 3: API Client + Auth Routing

**Files:**
- Modify: `src/lib/api-client.ts:96-97` — add `faultReports` namespace after `faults`
- Modify: `src/middleware.ts` — add USER → `/report` redirect and `/report` protection
- Modify: `src/lib/auth.config.ts` — route USER to `/report` post-login
- Modify: `src/components/LoginForm.tsx:7-12` — update `safeCallback` default for USER role

**Interfaces:**
- Consumes: `FaultReportCreateInput`, `FaultReportReviewInput` types
- Produces: `api.faultReports.list()`, `api.faultReports.create()`, `api.faultReports.review()`

- [ ] **Step 1: Add faultReports namespace to api-client**

In `src/lib/api-client.ts`, add after the `faults` object (after line 97):

```typescript
  faultReports: {
    list: () =>
      apiFetch<unknown[]>("/api/fault-reports"),
    create: (data: { itemId: string; roomName: string; faultType: string; severity?: string; description?: string; photos?: string[] }) =>
      apiFetch<unknown>("/api/fault-reports", { method: "POST", body: JSON.stringify(data) }),
    review: (id: string, data: { action: "approve" | "reject"; severity?: string; faultType?: string; reviewNote?: string }) =>
      apiFetch<unknown>(`/api/fault-reports/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  },
```

- [ ] **Step 2: Update middleware to redirect USER from /dashboard and protect /report**

Replace the content of `src/middleware.ts`:

```typescript
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const token = req.auth;

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    pathname.startsWith("/super-admin") &&
    token.user?.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (
    pathname.startsWith("/dashboard") &&
    token.user?.role === "USER"
  ) {
    return NextResponse.redirect(new URL("/report", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/super-admin/:path*", "/report/:path*", "/api/((?!auth|demo).*)"],
};
```

- [ ] **Step 3: Update auth.config.ts authorized callback for role-based redirect**

In `src/lib/auth.config.ts`, add an `authorized` callback inside the `callbacks` object (after the `session` callback, around line 28). This callback runs on every middleware-matched request and can redirect:

```typescript
    async authorized({ auth: token, request }) {
      if (!token) return false;
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/dashboard") && token.user?.role === "USER") {
        return Response.redirect(new URL("/report", request.url));
      }
      return true;
    },
```

**Note:** Since the middleware already handles this redirect, this callback is a belt-and-suspenders approach. The middleware check from Step 2 is the primary mechanism. If adding the `authorized` callback causes issues with the existing middleware pattern (the `auth()` wrapper), skip this step — the middleware redirect alone is sufficient.

- [ ] **Step 4: Update LoginForm default redirect for USER role**

In `src/components/LoginForm.tsx`, the `safeCallback` function currently defaults to `/dashboard`. The middleware will handle redirecting USER to `/report`, so no change is needed here — the middleware intercepts the `/dashboard` redirect and sends USER to `/report`. This is cleaner than trying to detect the role client-side before the session is available.

No code change needed — this step is a verification that the flow works: USER logs in → `callbackUrl` defaults to `/dashboard` → middleware redirects to `/report`.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-client.ts src/middleware.ts src/lib/auth.config.ts
git commit -m "Add fault reports API client and USER role routing to /report"
```

---

### Task 4: Teacher Report Page

**Files:**
- Create: `src/app/report/layout.tsx`
- Create: `src/app/report/page.tsx`
- Create: `src/components/ReportPage.tsx`

**Interfaces:**
- Consumes: `api.faultReports.create()`, `api.faultReports.list()`, `api.sections.list()`, `api.items.list()`, `api.faultTypes.list()`, `api.upload.file()` from `src/lib/api-client.ts`; session from `next-auth/react`
- Produces: Standalone `/report` page with 3-step form + My Reports section

- [ ] **Step 1: Create report layout with auth guard**

Create `src/app/report/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-guard";

export default async function ReportLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/report");
  return <>{children}</>;
}
```

- [ ] **Step 2: Create report page server component**

Create `src/app/report/page.tsx`:

```typescript
import ReportPage from "@/components/ReportPage";

export default function ReportRoute() {
  return <ReportPage />;
}
```

- [ ] **Step 3: Create the ReportPage client component**

Create `src/components/ReportPage.tsx`. This is the main component containing the header, 3-step form, and My Reports section. Key details:

- Uses `useSession()` to get teacher name and school name
- On mount, fetches sections (for room dropdown), items (to filter by selected room), fault types (for fault type dropdown), and own fault reports (for My Reports)
- State: `selectedRoom`, `selectedItem`, `faultType`, `severity`, `description`, `photos`, `submitting`, `success`, `myReports`
- The room dropdown uses `<optgroup>` per section with room names as options
- Selecting a room filters items to those with `locationName === selectedRoom`
- Item list shows each item as a clickable row with type icon, label, and status badge
- Fault form appears after item selection with fault type dropdown, severity button group, description textarea, and photo upload area
- Photo upload reuses `api.upload.file()` from `src/lib/api-client.ts`
- Submit calls `api.faultReports.create()`, then shows success message
- "Report Another" resets form state
- Below the form, My Reports section lists own past submissions sorted newest-first
- Demo banner appears when `schoolName === "Demo School"` (same style as dashboard Header)

```typescript
"use client";

import React, { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { api } from "@/lib/api-client";
import { SEV_COLORS, fmtDate } from "@/lib/constants";

interface SectionData {
  name: string;
  rooms: Array<{ name: string }>;
}

interface ItemData {
  id: string;
  label: string;
  type: string;
  status: string;
  locationName: string;
}

interface FaultReportData {
  id: string;
  roomName: string;
  faultType: string;
  severity: string;
  description?: string | null;
  status: string;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  createdAt: string;
  item: { label: string; type: string };
}

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  Pending: { bg: "#fef3c7", text: "#92400e" },
  Approved: { bg: "#dcfce7", text: "#166534" },
  Rejected: { bg: "#fee2e2", text: "#991b1b" },
};

export default function ReportPage() {
  const { data: session } = useSession();
  const userName = (session?.user as { name?: string })?.name ?? "";
  const schoolName = (session?.user as { schoolName?: string })?.schoolName ?? "";

  const [sections, setSections] = useState<SectionData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [faultTypes, setFaultTypes] = useState<string[]>([]);
  const [myReports, setMyReports] = useState<FaultReportData[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [faultType, setFaultType] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [itemSearch, setItemSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [sec, itm, ft, reports] = await Promise.all([
          api.sections.list(),
          api.items.list(),
          api.faultTypes.list(),
          api.faultReports.list(),
        ]);
        setSections(sec as SectionData[]);
        setItems(itm as ItemData[]);
        setFaultTypes((ft as { types: string[] }).types);
        setMyReports(reports as FaultReportData[]);
      } catch (e) {
        console.error("Failed to load:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const roomItems = items.filter(i => i.locationName === selectedRoom);
  const filteredRoomItems = itemSearch
    ? roomItems.filter(i => i.label.toLowerCase().includes(itemSearch.toLowerCase()))
    : roomItems;

  const resetForm = () => {
    setSelectedRoom("");
    setSelectedItem(null);
    setFaultType("");
    setSeverity("Medium");
    setDescription("");
    setPhotos([]);
    setSuccess(false);
    setError("");
    setItemSearch("");
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(
        Array.from(files).map(f => api.upload.file(f, "fault-reports"))
      );
      setPhotos(prev => [...prev, ...urls]);
    } catch {
      setError("Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedItem || !faultType) return;
    setSubmitting(true);
    setError("");
    try {
      await api.faultReports.create({
        itemId: selectedItem.id,
        roomName: selectedRoom,
        faultType,
        severity,
        description: description || undefined,
        photos: photos.length > 0 ? photos : undefined,
      });
      setSuccess(true);
      const reports = await api.faultReports.list();
      setMyReports(reports as FaultReportData[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm("Reset demo to default state? All changes will be lost.")) return;
    await fetch("/api/demo/reset", { method: "POST" });
    window.location.reload();
  };

  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Mono','Courier New',monospace", background: "#f8fafc", minHeight: "100vh", color: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748b", fontSize: 13 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Mono','Courier New',monospace", background: "#f8fafc", minHeight: "100vh", color: "#1e293b" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,select,textarea{background:#f8fafc;border:1px solid #cbd5e1;color:#1e293b;border-radius:5px;padding:7px 10px;font-family:inherit;font-size:12px;width:100%;outline:none;transition:border .15s}
        input:focus,select:focus,textarea:focus{border-color:#6366f1}
        .btn{background:#f1f5f9;border:1px solid #cbd5e1;color:#1e293b;padding:6px 12px;border-radius:5px;cursor:pointer;font-family:inherit;font-size:11px;transition:all .15s}
        .btn:hover{background:#e2e8f0;border-color:#6366f1}
        .btn-primary{background:#3730a3!important;border-color:#6366f1!important;color:#fff!important}
        .badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:500;white-space:nowrap}
      `}</style>

      {/* Demo banner */}
      {schoolName === "Demo School" && (
        <div style={{
          background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff", padding: "6px 16px", fontSize: 11,
          display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "'Space Grotesk', sans-serif",
        }}>
          <span>Demo Mode — Teacher Fault Reporting</span>
          <button onClick={handleResetDemo} style={{
            background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 4,
            color: "#fff", fontSize: 10, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit",
          }}>
            Reset Demo
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 0 12px rgba(99,102,241,0.2)", flexShrink: 0 }}>◈</div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 14, color: "#4338ca" }}>
              {schoolName || "Investory Map"}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>Fault Report</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#64748b" }}>👤 {userName}</span>
          <button className="btn" onClick={() => signOut({ callbackUrl: "/login" })} style={{ color: "#ef4444", fontSize: 10 }}>Sign Out</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
        {success ? (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: "#166534", marginBottom: 8 }}>
              Report Submitted
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
              Your report has been submitted. The admin team will review it.
            </div>
            <button className="btn btn-primary" onClick={resetForm} style={{ padding: "8px 20px" }}>
              Report Another
            </button>
          </div>
        ) : (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 600, color: "#4338ca", marginBottom: 16 }}>
              ⚠ Report a Fault
            </div>

            {error && (
              <div style={{ background: "#fee2e2", border: "1px solid #ef4444", borderRadius: 6, padding: "8px 12px", color: "#dc2626", fontSize: 12, marginBottom: 12 }}>
                {error}
              </div>
            )}

            {/* Step 1: Location */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, fontWeight: 500 }}>
                1. Where are you?
              </label>
              <select
                value={selectedRoom}
                onChange={e => { setSelectedRoom(e.target.value); setSelectedItem(null); setItemSearch(""); }}
              >
                <option value="">Select a room...</option>
                {sections.map(s => (
                  <optgroup key={s.name} label={s.name}>
                    {(s.rooms || []).map(r => (
                      <option key={r.name} value={r.name}>{r.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Step 2: Item selection */}
            {selectedRoom && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, fontWeight: 500 }}>
                  2. Which item is faulty?
                </label>
                {roomItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#94a3b8", padding: "12px 0" }}>No items found in this room.</div>
                ) : (
                  <>
                    {roomItems.length > 5 && (
                      <input
                        placeholder="Search items..."
                        value={itemSearch}
                        onChange={e => setItemSearch(e.target.value)}
                        style={{ marginBottom: 6 }}
                      />
                    )}
                    <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                      {filteredRoomItems.map(item => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          style={{
                            padding: "8px 10px",
                            cursor: "pointer",
                            borderBottom: "1px solid #f1f5f9",
                            background: selectedItem?.id === item.id ? "#ede9fe" : "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ fontSize: 12, color: "#1e293b", fontWeight: selectedItem?.id === item.id ? 600 : 400 }}>
                            {item.label}
                          </span>
                          <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Fault details */}
            {selectedItem && (
              <div>
                <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, fontWeight: 500 }}>
                  3. What&apos;s wrong?
                </label>

                <select
                  value={faultType}
                  onChange={e => setFaultType(e.target.value)}
                  style={{ marginBottom: 8 }}
                >
                  <option value="">Select fault type...</option>
                  {faultTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Severity</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {SEVERITIES.map(s => {
                      const sc = SEV_COLORS[s] ?? SEV_COLORS.Low;
                      return (
                        <button
                          key={s}
                          onClick={() => setSeverity(s)}
                          style={{
                            flex: 1,
                            padding: "5px 0",
                            borderRadius: 4,
                            border: severity === s ? `2px solid ${sc.text}` : "1px solid #e2e8f0",
                            background: severity === s ? sc.bg : "#ffffff",
                            color: severity === s ? sc.text : "#64748b",
                            fontSize: 10,
                            fontWeight: severity === s ? 600 : 400,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <textarea
                  placeholder="Describe the issue (optional)"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  style={{ marginBottom: 8, resize: "vertical" }}
                />

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Photos (optional)</div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    style={{ fontSize: 11 }}
                  />
                  {photos.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                      {photos.map((p, i) => (
                        <img key={i} src={p} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4, border: "1px solid #cbd5e1" }} />
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={!faultType || submitting || uploading}
                  style={{ width: "100%", padding: "10px 0", fontSize: 13, opacity: (!faultType || submitting) ? 0.6 : 1 }}
                >
                  {submitting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* My Reports */}
        {myReports.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: "#4338ca", marginBottom: 10 }}>
              My Reports
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {myReports.map(r => {
                const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.Pending;
                return (
                  <div key={r.id} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 7, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span className="badge" style={{ background: badge.bg, color: badge.text }}>{r.status}</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{r.item.label}</span>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>@ {r.roomName}</span>
                      <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>{fmtDate(r.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{r.faultType} — {r.severity}</div>
                    {r.description && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{r.description}</div>}
                    {r.reviewNote && (
                      <div style={{ fontSize: 10, color: r.status === "Rejected" ? "#991b1b" : "#166534", marginTop: 4, fontStyle: "italic" }}>
                        Admin: {r.reviewNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Verify build passes**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/report/ src/components/ReportPage.tsx
git commit -m "Add teacher fault report page at /report"
```

---

### Task 5: Admin Review UI in FaultsView

**Files:**
- Modify: `src/components/FaultsView.tsx` — add pending reports section
- Modify: `src/components/TabNav.tsx` — add badge count prop
- Modify: `src/app/dashboard/page.tsx` — fetch fault reports, pass to FaultsView + TabNav

**Interfaces:**
- Consumes: `api.faultReports.list()`, `api.faultReports.review()` from `src/lib/api-client.ts`
- Produces: Pending reports section in FaultsView, badge count on Faults tab

- [ ] **Step 1: Update TabNav to accept a badge count**

Replace `src/components/TabNav.tsx`:

```typescript
interface TabNavProps {
  tab: string;
  setTab: (t: string) => void;
  faultReportCount?: number;
}

const TABS: [string, string][] = [
  ["sections", "🗺 Sections"],
  ["list", "📋 List"],
  ["faults", "⚠ Faults"],
  ["loans", "🔄 Loans"],
];

export default function TabNav({ tab, setTab, faultReportCount }: TabNavProps) {
  return (
    <div style={{ borderBottom: "1px solid #e2e8f0", padding: "0 16px", display: "flex", gap: 2, flexShrink: 0, overflowX: "auto" }}>
      {TABS.map(([k, l]) => (
        <button key={k} className="tab-btn" onClick={() => setTab(k)}
          style={{ padding: "8px 14px", fontSize: 12, color: tab === k ? "#4338ca" : "#64748b", borderBottom: tab === k ? "2px solid #6366f1" : "2px solid transparent", position: "relative" }}>
          {l}
          {k === "faults" && faultReportCount !== undefined && faultReportCount > 0 && (
            <span style={{
              marginLeft: 4,
              background: "#f59e0b",
              color: "#ffffff",
              fontSize: 9,
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: 99,
              verticalAlign: "top",
            }}>
              {faultReportCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add pending reports section to FaultsView**

Modify `src/components/FaultsView.tsx` to add new props and a collapsible pending reports section above the existing fault list. The new props are:

```typescript
interface FaultReportData {
  id: string;
  roomName: string;
  faultType: string;
  severity: string;
  description?: string | null;
  reportedBy: string;
  photos?: string[];
  status: string;
  createdAt: string;
  item: { id: string; label: string; type: string; locationName: string };
}

interface FaultsViewProps {
  items: Item[];
  onSelectItem: (item: Item) => void;
  onUpdateFault: (itemId: string, faultId: string, patch: { status: string }) => void;
  setLightbox: (src: string) => void;
  isAdmin?: boolean;
  pendingReports?: FaultReportData[];
  onReviewReport?: (reportId: string, data: { action: "approve" | "reject"; severity?: string; faultType?: string; reviewNote?: string }) => void;
}
```

Add these new state variables inside the component:

```typescript
const [pendingCollapsed, setPendingCollapsed] = useState(false);
const [reviewingId, setReviewingId] = useState<string | null>(null);
const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
const [editSeverity, setEditSeverity] = useState("");
const [editFaultType, setEditFaultType] = useState("");
const [reviewNote, setReviewNote] = useState("");
```

Add the pending reports section JSX before the existing filter bar (`<div style={{ display: "flex", gap: 6, ...`). Only render when `isAdmin && pendingReports && pendingReports.length > 0`:

The section shows:
- A collapsible header: "Pending Teacher Reports (N)" with a toggle arrow
- Each report card with amber left border (`borderLeft: "3px solid #f59e0b"`)
- Reporter name, timestamp, room, item label, fault type, severity badge, description, photo thumbnails
- Approve button expands inline: editable severity (button group), editable fault type (dropdown), note textarea, Confirm Approve button
- Reject button expands inline: reason textarea, Confirm Reject button
- On confirm, calls `onReviewReport(reportId, { action, severity?, faultType?, reviewNote? })` and resets the review state

The full implementation should render each pending report card with the amber styling, and when an admin clicks Approve or Reject, the card expands to show edit controls. On confirm, it calls the callback.

- [ ] **Step 3: Update dashboard to fetch and pass fault reports**

In `src/app/dashboard/page.tsx`:

Add a new state variable near line 34:

```typescript
const [faultReports, setFaultReports] = useState<unknown[]>([]);
```

In the `loadData` function (around line 57), add `api.faultReports.list()` to the `Promise.all`:

```typescript
const [fetchedItems, fetchedSections, fetchedLog, fetchedTypesData, fetchedFaultTypesData, fetchedReports] = await Promise.all([
  api.items.list(),
  api.sections.list(),
  api.moveLog.list(),
  api.types.list(),
  api.faultTypes.list(),
  api.faultReports.list(),
]);
```

Add `setFaultReports(fetchedReports);` after the existing state setters.

Add a handler for reviewing reports:

```typescript
const onReviewReport = async (reportId: string, data: { action: "approve" | "reject"; severity?: string; faultType?: string; reviewNote?: string }) => {
  try {
    await api.faultReports.review(reportId, data);
    const [fetchedItems, fetchedReports] = await Promise.all([
      api.items.list(),
      api.faultReports.list(),
    ]);
    setItems(fetchedItems);
    setFaultReports(fetchedReports);
  } catch (e) {
    console.error("Failed to review report:", e);
  }
};
```

Compute pending count for TabNav:

```typescript
const pendingReportCount = isAdmin
  ? (faultReports as Array<{ status: string }>).filter(r => r.status === "Pending").length
  : 0;
```

Update the `<TabNav>` component to pass the count:

```tsx
<TabNav tab={tab} setTab={setTab} faultReportCount={pendingReportCount} />
```

Update the `<FaultsView>` component to pass new props:

```tsx
<FaultsView
  items={items as Item[]}
  onSelectItem={openItem}
  onUpdateFault={onUpdateFault}
  setLightbox={setLightbox}
  isAdmin={isAdmin}
  pendingReports={isAdmin ? (faultReports as any[]).filter(r => r.status === "Pending") : undefined}
  onReviewReport={onReviewReport}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Verify build passes**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 6: Run full test suite**

Run: `npm test`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/FaultsView.tsx src/components/TabNav.tsx src/app/dashboard/page.tsx
git commit -m "Add admin review UI for pending fault reports in Faults tab"
```

---

### Task 6: Demo Mode + Landing Page

**Files:**
- Modify: `src/app/api/demo/reset/route.ts:183-369` — add teacher user + seed FaultReports
- Modify: `src/components/DemoButton.tsx` — add teacher variant props
- Modify: `src/app/page.tsx:166-185` — add "Try as Teacher" button

**Interfaces:**
- Consumes: `FaultReport` Prisma model; `DemoButton` component
- Produces: Teacher demo user in demo reset; seeded pending FaultReports; "Try as Teacher" button on landing page

- [ ] **Step 1: Add teacher user and seed FaultReports in demo reset**

In `src/app/api/demo/reset/route.ts`, after the existing admin user upsert (around line 205), add:

```typescript
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
```

In the delete-all transaction (around line 208), add `prisma.faultReport.deleteMany({ where: { schoolId } })` before the item deleteMany:

```typescript
    await prisma.$transaction([
      prisma.faultReport.deleteMany({ where: { schoolId } }),
      prisma.moveLogEntry.deleteMany({ where: { schoolId } }),
      prisma.auditLogEntry.deleteMany({ where: { schoolId } }),
      prisma.item.deleteMany({ where: { schoolId } }),
      prisma.section.deleteMany({ where: { schoolId } }),
    ]);
```

After the items are created (after line 359), seed sample FaultReports:

```typescript
    // Seed sample fault reports for demo
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
```

- [ ] **Step 2: Update DemoButton to support teacher variant**

Replace `src/components/DemoButton.tsx`:

```typescript
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

interface DemoButtonProps {
  variant?: "admin" | "teacher";
}

export default function DemoButton({ variant = "admin" }: DemoButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isTeacher = variant === "teacher";

  const handleDemo = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error || "Failed to set up demo");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email: isTeacher ? "teacher@demo.investorymap.com" : "demo@investorymap.com",
        password: "demo",
        redirect: false,
      });

      if (result?.error) {
        setError("Login failed after setup");
        setLoading(false);
        return;
      }

      router.push(isTeacher ? "/report" : "/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      <button
        onClick={handleDemo}
        disabled={loading}
        style={{
          padding: isTeacher ? "10px 28px" : "13px 36px",
          background: "#ffffff",
          border: `2px solid ${isTeacher ? "#f59e0b" : "#4f46e5"}`,
          borderRadius: 8,
          color: isTeacher ? "#b45309" : "#4f46e5",
          fontSize: isTeacher ? 13 : 15,
          fontWeight: 600,
          fontFamily: "'Space Grotesk', sans-serif",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "all 0.15s",
        }}
      >
        {loading
          ? "Loading demo..."
          : isTeacher
            ? "Try as Teacher"
            : "Try Demo"}
      </button>
      {error && (
        <div style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add "Try as Teacher" button to landing page**

In `src/app/page.tsx`, update the CTA buttons section (around line 166). Add a second `DemoButton` below the existing one:

Change:
```tsx
<div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
  <Link href="/login" style={{ ... }}>Go to Dashboard →</Link>
  <DemoButton />
</div>
```

To:
```tsx
<div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
  <Link href="/login" style={{ ... }}>Go to Dashboard →</Link>
  <DemoButton />
  <DemoButton variant="teacher" />
</div>
```

- [ ] **Step 4: Sync prisma/seed-demo.ts with the same demo changes**

If `prisma/seed-demo.ts` exists, apply the same changes: add teacher user creation and sample FaultReport seeding. Follow the same pattern as the API route changes in Step 1.

- [ ] **Step 5: Push schema to database**

Run: `npx prisma db push`

Expected: Schema synced successfully. FaultReport table created.

- [ ] **Step 6: Verify build passes**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 7: Run full test suite**

Run: `npm test`

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/demo/reset/route.ts src/components/DemoButton.tsx src/app/page.tsx prisma/seed-demo.ts
git commit -m "Add teacher demo user, seed fault reports, and Try as Teacher button"
```

---

### Task 7: Integration Test + Final Verification

**Files:**
- No new files — this is a verification task

**Interfaces:**
- Consumes: All prior tasks

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: All tests pass (66 existing + new fault-reports tests).

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 4: Start dev server and test the teacher flow**

Run: `npm run dev`

Then test manually:
1. Go to landing page — verify "Try as Teacher" button appears
2. Click "Try as Teacher" — verify it creates demo, logs in as teacher, lands on `/report`
3. On `/report` page: select a room, select an item, fill in fault details, submit
4. Verify success message and "Report Another" button
5. Verify "My Reports" section shows the submitted report with "Pending" status
6. Sign out, click "Try Demo" (admin) — verify landing on `/dashboard`
7. Click Faults tab — verify badge count shows pending reports
8. Verify pending reports section appears above confirmed faults
9. Test approve flow: click Approve, adjust severity, confirm — verify fault appears in confirmed list
10. Test reject flow: click Reject, add reason, confirm — verify it disappears from pending

- [ ] **Step 5: Commit final state**

```bash
git add -A
git status
git commit -m "Teacher fault reports feature complete — integration verified"
```
