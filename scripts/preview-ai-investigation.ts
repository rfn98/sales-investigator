import { analyze } from "../lib/analytics/investigator";
import { prisma } from "../lib/db";
import { buildInvestigationInputs, runInvestigation } from "../lib/ai";

/**
 * AI Investigation preview CLI.
 *
 *   npx tsx scripts/preview-ai-investigation.ts [endDate] [outletName?] [--provider <id>]
 *
 * Provider selection (highest to lowest precedence):
 *   --provider <id>  CLI flag
 *   AI_PROVIDER      env var (e.g. AI_PROVIDER=openai)
 *   default          "none" (offline/deterministic, never calls an LLM)
 *
 * With provider "none": dumps the deterministic contract (decomposition and
 * support profiles per non-NORMAL outlet + full JSON). With a real provider
 * (e.g. "openai"): runs the investigation and prints result + validation
 * status. API keys are never printed.
 */
const DEFAULT_END_DATE = "2026-09-07T00:00:00.000Z";

function fmtMoney(value: number): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtRupiah(value: number): string {
  return `${value < 0 ? "-Rp " : "Rp "}${fmtMoney(Math.abs(value))}`;
}

function parseArgs(argv: string[]): {
  endDate: Date;
  outletFilter: string | null;
  providerId: string;
} {
  const endDateArg = argv[2];
  let outletArg = argv[3];
  let providerId = process.env.AI_PROVIDER?.trim() || "none";

  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--provider" && argv[i + 1]) {
      providerId = argv[i + 1].trim();
    }
  }

  return {
    endDate: endDateArg
      ? new Date(endDateArg)
      : new Date(DEFAULT_END_DATE),
    outletFilter: outletArg?.trim().toLowerCase() || null,
    providerId,
  };
}

function printContractSection(inputs: ReturnType<typeof buildInvestigationInputs>): void {
  for (const input of inputs) {
    const d = input.signals.decomposition;
    console.log(`## ${input.entity.name} [${input.outcome.status}] id=${input.investigationId}`);
    console.log(
      `  drop/day ${fmtRupiah(d.outletDropPerDay)} | flagged ${fmtRupiah(d.explainedByFlaggedPerDay)} | stockouts ${fmtRupiah(d.explainedByStockoutsPerDay)} | residual ${fmtRupiah(d.residualPerDay)}`,
    );
    console.log(
      `  flagged explains ${d.droppedOutletShareFlaggedPct}% of the drop; stockouts ${d.droppedOutletShareStockoutsPct}%; residual ${(100 - d.droppedOutletShareFlaggedPct).toFixed(1)}%`,
    );
    for (const profile of input.supportProfiles) {
      console.log(
        `  [support] ${profile.id} = ${profile.level} (${profile.score})`,
      );
    }
    const flags = input.signals.flags
      .map((flag) => `${flag.id}=${String(flag.value)}`)
      .join(", ");
    console.log(`  flags: ${flags}`);
    console.log(
      `  candidates: ${input.recommendationCandidates.map((c) => c.id).join(", ")}`,
    );
    console.log("");
  }
}

function printResultSection(outcomes: Awaited<ReturnType<typeof runInvestigation>>): void {
  for (const outcome of outcomes) {
    console.log(
      `## ${outcome.input.entity.name} [${outcome.input.outcome.status}] refId=${outcome.input.investigationId}`,
    );
    console.log(`  provider=${outcome.providerId} model=${outcome.model ?? "n/a"}`);
    if (!outcome.ok) {
      console.log(
        `  validation: FAIL (attempts=${outcome.attempts ?? 1})`,
      );
      for (const error of outcome.errors) {
        console.log(`    - ${error}`);
      }
      console.log("");
      continue;
    }
    const result = outcome.result!;
    console.log(
      `  validation: PASS (attempts=${outcome.attempts ?? 1}/${outcome.attempts! > 1 ? 2 : 1})`,
    );
    console.log(`  executiveSummary: ${result.executiveSummary}`);
    const pf = result.primaryFinding;
    console.log(
      `  primaryFinding [${pf.causalStrength}]${pf.supportProfileId ? ` (${pf.supportProfileId})` : ""}: ${pf.statement}`,
    );
    console.log(`    reason: ${pf.reason}`);
    console.log(`    evidenceIds: ${pf.evidenceIds.join(", ")}`);
    console.log(`  contributingFactors: ${result.contributingFactors.length}`);
    for (const c of result.contributingFactors) {
      console.log(`    - [${c.causalStrength}] ${c.statement}`);
    }
    console.log(`  alternativeHypotheses: ${result.alternativeHypotheses.length}`);
    for (const c of result.alternativeHypotheses) {
      console.log(`    - [${c.causalStrength}] ${c.statement}`);
    }
    console.log(`  recommendations: ${result.recommendations.length}`);
    for (const rec of result.recommendations) {
      console.log(
        `    - [${rec.priority}]${rec.actionTemplateId ? ` ${rec.actionTemplateId}:` : ""} ${rec.action}`,
      );
      console.log(`      rationale: ${rec.rationale}`);
    }
    console.log(`  limitations: ${result.limitations.length}`);
    for (const l of result.limitations) {
      console.log(`    - ${l}`);
    }
    console.log("");
  }
}

async function main(): Promise<void> {
  const { endDate, outletFilter, providerId } = parseArgs(process.argv);

  const report = await analyze(prisma, endDate);
  const inputs = buildInvestigationInputs(report);

  const filtered = outletFilter
    ? inputs.filter(
        (input) => input.entity.name.trim().toLowerCase() === outletFilter,
      )
    : inputs;

  console.log(
    `AI INVESTIGATION — endDate ${report.endDate} (${report.analyzedAt}) | provider=${providerId}`,
  );
  console.log(
    `  Non-normal outlets: ${inputs.length}; shown: ${filtered.length}`,
  );
  console.log("");

  if (providerId === "none") {
    printContractSection(filtered);
    console.log("FULL CONTRACT(S), JSON");
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }

  const outcomes = await runInvestigation(report, { providerId });

  const shownOutcomes = outletFilter
    ? outcomes.filter(
        (o) => o.input.entity.name.trim().toLowerCase() === outletFilter,
      )
    : outcomes;

  printResultSection(shownOutcomes);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });