import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const school = await prisma.school.findUnique({
      where: { code: "DEMO" },
      select: { id: true },
    });

    return NextResponse.json({ available: !!school });
  } catch (e: unknown) {
    console.error("[api/demo/check] unexpected error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
