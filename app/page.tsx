import HomeShell from "../components/HomeShell";
import { slugify } from "../components/format";
import { parseEndDate } from "../lib/defaults";
import { getReport } from "../lib/report";
import { getMaxSalesDate } from "../lib/db";
import { resolveUiProvider, runOutletInvestigation } from "../lib/ai";
import type { InvestigationOutcome } from "../lib/ai";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    endDate?: string | string[];
    investigate?: string | string[];
    warm?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.endDate) ? params.endDate[0] : params.endDate;
  const endDate = parseEndDate(raw);
  const report = await getReport(endDate);
  const maxDate = await getMaxSalesDate();

  const minDate = report.outlets
    .flatMap((outlet) => outlet.dailyRevenue.map((p) => p.date))
    .sort()[0];

  const invest = Array.isArray(params.investigate)
    ? params.investigate[0]
    : params.investigate;
  const warm = (Array.isArray(params.warm) ? params.warm[0] : params.warm) === "1";

  let initialOutcome: InvestigationOutcome | null = null;
  if (invest && warm) {
    // Internal smoke-harness path: run the LLM server-side so a plain GET
    // yields the dossier for HTML verification. The UI never passes `warm`.
    const exists = report.outlets.some(
      (outlet) => slugify(outlet.outletName) === invest,
    );
    if (exists) {
      const { providerId } = resolveUiProvider(process.env);
      initialOutcome = await runOutletInvestigation(report, invest, { providerId });
    }
  }

  return (
    <HomeShell
      report={report}
      endDate={endDate}
      maxDate={maxDate}
      minDate={minDate}
      initialInvestigate={invest ?? null}
      initialOutcome={initialOutcome}
    />
  );
}