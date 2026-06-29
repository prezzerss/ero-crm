import { NextResponse } from "next/server";
import { buildCsv, getReportingData, type ReportTable } from "../data";

const reportTables: ReportTable[] = ["clients", "contacts", "inbox", "summary"];

function isReportTable(value: string | null): value is ReportTable {
  return Boolean(value && reportTables.includes(value as ReportTable));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const table = url.searchParams.get("table");

  if (!isReportTable(table)) {
    return NextResponse.json({ error: "Unknown report table." }, { status: 400 });
  }

  const data = await getReportingData();
  const csv = buildCsv(table, data);

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="ero-crm-${table}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
