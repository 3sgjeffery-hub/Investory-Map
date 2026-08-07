import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canAccess, isAdmin } from "@/lib/auth-guard";
import { resolveSchoolId } from "@/lib/tenant";
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
        schoolId: item.schoolId,
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
    const schoolId = resolveSchoolId(
      user,
      req.nextUrl.searchParams.get("schoolId") || undefined
    );
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
