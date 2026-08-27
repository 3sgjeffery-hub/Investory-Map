import { NextResponse } from "next/server";

export async function GET() {
  const headers = [
    "Label", "AssetCode", "Type", "Brand", "Model", "Serial",
    "Location", "Cost", "WarrantyEnd", "Status", "Loanable",
    "Remark", "Comment",
  ];

  const sampleRow = [
    "Projector 01", "AV-2024-001", "Projector", "Epson", "EB-W52",
    "X1YZ234567", "HALL", "899", "2027-06-15", "Operational", "Yes",
    "Ceiling mounted, left side", "",
  ];

  const rows = [headers, sampleRow];
  const csv = rows
    .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="InvestoryMap_Template.csv"',
    },
  });
}
