import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canAccess } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/api-errors";
import { LoanActionSchema } from "@/lib/validation/loans";

type Params = { params: Promise<{ itemId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireSession();
    const { itemId } = await params;
    const body = await req.json();

    const parsed = LoanActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const item = await prisma.item.findFirst({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canAccess(user, item.schoolId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (input.action === "loan-out") {
      // Loan-out: we override item.locationName with the borrower's name so
      // the Loans tab grouping works as in v1 (CLAUDE.md "Loan location
      // override"). Item + LoanEntry must be written atomically — a partial
      // write would leave the item "loaned" without a history row.
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.item.update({
          where: { id: itemId },
          data: {
            isLoaned: true,
            loanedTo: input.borrowerName,
            locationName: input.borrowerName,
          },
        });
        const entry = await tx.loanEntry.create({
          data: {
            itemId,
            borrowerName: input.borrowerName,
            borrowerId: input.borrowerId ?? null,
            issuedBy: input.issuedBy ?? user.name,
            expectedReturn: input.expectedReturn
              ? new Date(input.expectedReturn)
              : null,
            notes: input.notes ?? null,
            signature: input.signature ?? null,
            issuerSignature: input.issuerSignature ?? null,
            status: "Active",
          },
        });
        return { item: updated, loanEntry: entry };
      });

      const { locationName: ln, ...loanItemRest } = result.item as unknown as Record<string, unknown>;
      return NextResponse.json({ item: { ...loanItemRest, location: ln }, loanEntry: result.loanEntry }, { status: 201 });
    }

    // action === "return"
    // Close the most recent active loan (if any) and release the item back to
    // `returnLocation`. We still perform the item update even when no active
    // loan exists so stale isLoaned flags can be cleared.
    const activeLoan = await prisma.loanEntry.findFirst({
      where: { itemId, status: "Active" },
      orderBy: { dateOut: "desc" },
    });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({
        where: { id: itemId },
        data: {
          isLoaned: false,
          loanedTo: null,
          locationName: input.returnLocation,
        },
      });

      let closedLoan = null;
      if (activeLoan) {
        closedLoan = await tx.loanEntry.update({
          where: { id: activeLoan.id },
          data: {
            status: "Returned",
            dateIn: new Date(),
            receivedBy: input.receivedBy ?? user.name,
            condition: input.condition,
            returnLocation: input.returnLocation,
          },
        });
      }

      return { item: updated, loanEntry: closedLoan };
    });

    const { locationName: rln, ...retItemRest } = result.item as unknown as Record<string, unknown>;
    return NextResponse.json({ item: { ...retItemRest, location: rln }, loanEntry: result.loanEntry });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
