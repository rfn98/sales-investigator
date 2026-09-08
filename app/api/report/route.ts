import { NextResponse } from "next/server";
import { DEFAULT_END_DATE, isValidEndDate } from "../../../lib/defaults";
import { getReport } from "../../../lib/report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const endDate = url.searchParams.get("endDate") ?? DEFAULT_END_DATE;

  if (!isValidEndDate(endDate)) {
    return NextResponse.json(
      {
        error: `Invalid endDate '${endDate}'. Expected YYYY-MM-DD.`,
        hint: `Use a date between 2026-06-10 and 2026-09-07, e.g. ${DEFAULT_END_DATE}.`,
      },
      { status: 400 },
    );
  }

  const report = await getReport(endDate);
  return NextResponse.json(report);
}