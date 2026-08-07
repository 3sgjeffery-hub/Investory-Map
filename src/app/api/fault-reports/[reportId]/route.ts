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
