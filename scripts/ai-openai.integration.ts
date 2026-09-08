import { analyze } from "../lib/analytics/investigator";
import { prisma } from "../lib/db";
import { runInvestigation } from "../lib/ai";

/**
 * Optional end-to-end check of a real LLM provider.
 *
 *   npx tsx scripts/ai-openai.integration.ts [endDate] [outletName?]
 *
 * Skips quietly unless both OPENAI_API_KEY and OPENAI_MODEL are set.
 * Never prints the API key. Does not fail the process when skipped.
 */
async function main(): Promise<void> {
  const endDateArg = process.argv[2];
  const outletFilter = process.argv[3]?.trim().toLowerCase();

  const run = process.env.AI_PROVIDER || "openai";
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
    console.log(
      "[integration] SKIPPED — OPENAI_API_KEY and/or OPENAI_MODEL not set.",
    );
    return;
  }

  const endDate = endDateArg
    ? new Date(endDateArg)
    : new Date("2026-09-07T00:00:00.000Z");

  const report = await analyze(prisma, endDate);
  const outcomes = await runInvestigation(report, { providerId: run });

  const shown = outletFilter
    ? outcomes.filter(
        (o) => o.input.entity.name.trim().toLowerCase() === outletFilter,
      )
    : outcomes;

  console.log(
    `AI OPENAI INTEGRATION — provider=${run} endDate ${report.endDate}`,
  );

  for (const outcome of shown) {
    console.log(
      `## ${outcome.input.entity.name} [${outcome.input.outcome.status}] provider=${outcome.providerId} model=${outcome.model ?? "n/a"}`,
    );
    if (!outcome.ok) {
      console.log(
        `  validation: FAIL (attempts=${outcome.attempts ?? 1})`,
      );
      for (const error of outcome.errors) {
        console.log(`    - ${error}`);
      }
      continue;
    }
    console.log(
      `  validation: PASS (attempts=${outcome.attempts ?? 1})`,
    );
    console.log(`  executiveSummary: ${outcome.result!.executiveSummary}`);
    console.log(
      `  primaryFinding [${outcome.result!.primaryFinding.causalStrength}]: ${outcome.result!.primaryFinding.statement}`,
    );
    console.log(
      `  recommendations: ${outcome.result!.recommendations
        .map((r) => `[${r.priority}] ${r.action}`)
        .join(" | ")}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });