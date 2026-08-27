import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/api-errors";
import { resolveSchoolId } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const user = await requireSession();
    const schoolId = resolveSchoolId(
      user,
      req.nextUrl.searchParams.get("schoolId") || undefined
    );

    const items = await prisma.item.findMany({
      where: { schoolId },
      include: {
        faults: { where: { status: { not: "Resolved" } } },
        repairs: true,
      },
      orderBy: { label: "asc" },
    });

    const headers = [
      "Label", "AssetCode", "Type", "Brand", "Model", "Serial",
      "Location", "Cost", "WarrantyEnd", "Status", "Loanable", "LoanedTo",
      "Remark", "Comment", "OpenFaults", "Repairs",
    ];

    const rows = items.map((i) => [
      i.label, i.assetCode ?? "", i.type, i.brand ?? "", i.model ?? "",
      i.serial ?? "", i.locationName, i.cost?.toString() ?? "",
      i.warrantyEnd?.toISOString().slice(0, 10) ?? "", i.status,
      i.loanable ? "Yes" : "No", i.loanedTo ?? "", i.remark ?? "",
      i.comment ?? "", i.faults.length.toString(), i.repairs.length.toString(),
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="InvestoryMap_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
