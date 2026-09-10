import { NextResponse } from "next/server";
import { resolveUiProvider, runOutletInvestigation } from "../../../lib/ai";
import { getReport } from "../../../lib/report";
import { parseEndDate } from "../../../lib/defaults";
import { slugify } from "../../../components/format";

export const dynamic = "force-dynamic";

/**
 * Investigation API: runs a fresh LLM investigation for an outlet (no cache —
 * every call is a new run) and returns the outcome as JSON for the single-page
 * dashboard flow.
 */
export async function POST(request: Request) {
  let body: { slug?: unknown; endDate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const endDate = parseEndDate(
    typeof body.endDate === "string" ? body.endDate : undefined,
  );

  const { providerId } = resolveUiProvider(process.env);
  const report = await getReport(endDate);

  const exists = report.outlets.some(
    (outlet) => slugify(outlet.outletName) === slug,
  );
  if (!exists) {
    return NextResponse.json({ error: "outlet not found" }, { status: 404 });
  }

  const outcome = await runOutletInvestigation(report, slug, { providerId });
  return NextResponse.json({ outcome });
}