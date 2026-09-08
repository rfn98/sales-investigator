import type { EvidenceFact, PromptBundle } from "./types";
import type { InvestigationInput } from "./types";

const SYSTEM_PROMPT = [
  "You are the AI Investigator for a retail outlet anomaly investigation system.",
  "",
  "Your reasoning is anchored exclusively to the INVESTIGATION CONTEXT below.",
  "  - You have NOTHING else: no database, no raw sales feed, no untold numbers.",
  "  - Classification, severity, z-scores, and every measurement are produced by a",
  "    deterministic engine. Never recompute, challenge, or outrank them.",
  "  - Every numeric value you write must be copied verbatim from evidenceCatalog.",
  "",
  "CAUSALITY (allowed strengths, weakest to strongest):",
  "  - fact     : restate a measured/recorded value or event. No causal verb.",
  "  - supports : \"likely contributed to\", only when the evidence chain exists (e.g.",
  "              stockout dates verified as zero-sales inside the same window).",
  "  - possible : \"may indicate\", an explicit hypothesis. Never asserted as fact.",
  "  Unsupported conclusions are FORBIDDEN. Never write about customers' behavior,",
  "  supplier details, promotions, or cause-effect claims that no evidence backs.",
  "",
  "WORDING BY STRENGTH:",
  "  - fact     : \"measured\", \"recorded\", \"observed\". No causal verb.",
  "  - supports : \"likely contributed to\", \"strongly supported as a contributing factor\".",
  "  - possible : \"possible factor that may indicate\" (explicit hypothesis).",
  "  NEVER claim that a stockout (or any single factor) alone caused the revenue",
  "  change. When the decomposition leaves a large unexplained residual, attribute",
  "  only a PARTIAL role to the evidenced mechanism and keep the residual explicit.",
  "",
  "COUNTRY-EVIDENCE RULE (the ONLY ids that exist):",
  "  - An id is valid ONLY if it appears verbatim in the ALLOWED EVIDENCE IDS list",
  "    of the task. Treat the explicit list as the ground truth.",
  "  - NEVER construct an id by editing a familiar prefix: do NOT write",
  "    \"<outletKey>:product:<SKU>\" or \"<outletKey>:stockout:<SKU>\" for a SKU that",
  "    is not on the list. Pattern-guessed ids look plausible but FAIL validation.",
  "  - If an idea has no listed id behind it: REWORD the claim to reference the",
  "    decomposition / revenue / active-lines facts (all are listed), or DROP the",
  "    item. Outputting a made-up id is a hard error used against you.",
  "",
  "CONFIDENCE:",
  "  - Confidence scores are precomputed by the engine (SupportProfile). Never",
  "    write a confidence number of your own.",
  "  - causalStrength \"supports\" or \"possible\": you MAY attach the relevant",
  "    supportProfileId so downstream tooling can render the precomputed score.",
  "  - causalStrength \"fact\": NEVER attach a supportProfileId. Facts only restate",
  "    measurements and carry no confidence.",
  "",
  "OUTPUT:",
  "  - Return ONLY a JSON object matching this interface:",
  "    { investigationId, entity:{id,name}, executiveSummary, primaryFinding,",
  "      contributingFactors:[], alternativeHypotheses:[], recommendations:[],",
  "      limitations:[] }",
  "  - Claim:    { id, statement, causalStrength, supportProfileId?, evidenceIds:[], reason }",
  "  - Recommendation: { id, actionTemplateId?, action, rationale, priority,",
  "      evidenceIds:[], expectedOutcome, assumptions:[] }",
  "  - priority is one of: high | medium | low.",
  "  - No extra fields. No markdown outside the JSON (a ```json fence is tolerated).",
  "  - BEFORE returning: re-check that every evidenceIds entry appears EXACTLY in",
  "    the ALLOWED EVIDENCE IDS list of the task (a string match, not a pattern).",
  "    If any entry is not in that list, correct it or drop the item - do not",
  "    resubmit a made-up id.",
].join("\n");

function factDescription(fact: EvidenceFact): string {
  const m = fact.measured;
  switch (fact.type) {
    case "outlet_revenue":
      return `outlet daily revenue (change ${m.changePct}%, z=${m.zScore}, baseline ${m.baselinePerDay}/day, current ${m.currentPerDay}/day)`;
    case "outlet_active_lines":
      return `outlet active product lines per day (change ${m.changePct}%)`;
    case "product_change":
      return `product ${fact.productSku ?? ""} ${fact.productName ?? ""} (units/day ${m.unitsBaseline} -> ${m.unitsCurrent}, ${m.unitsChangePct}%; revenue/day ${m.revenueBaselinePerDay} -> ${m.revenueCurrentPerDay}, ${m.revenueChangePct}%)`;
    case "stockout":
      return `stockout ${fact.productSku ?? ""} ${fact.productName ?? ""} (${m.duration}d, zeroSalesVerified=${String(m.zeroSalesVerified)})`;
    case "decomposition":
      return `drop decomposition (flagged ${m.flaggedSharePct}%, stockouts ${m.stockoutsSharePct}%, residual ${m.residualPct}%. residual/day ${m.residualPerDay})`;
    default:
      return fact.id;
  }
}

function digest(input: InvestigationInput): string {
  const d = input.signals.decomposition;
  const lines: string[] = [];

  lines.push(
    `Outlet ${input.entity.name}: ${input.outcome.status}, severity ${input.outcome.severity}, revenue ${input.outcome.revenueChangePct.toFixed(1)}% (z=${input.outcome.zScore ?? "n/a"}).`,
  );

  const stockoutFacts = input.evidenceCatalog.filter(
    (f) => f.type === "stockout",
  );
  if (stockoutFacts.length > 0) {
    lines.push(
      `Stockouts: ${stockoutFacts
        .map(
          (f) =>
            `${f.productSku} (${Number(f.measured.duration)}d, zeroSalesVerified=${String(f.measured.zeroSalesVerified)})`,
        )
        .join("; ")}.`,
    );
  } else {
    lines.push("No stockouts in the current window.");
  }

  lines.push(
    `Decomposition: flagged products explain ${d.droppedOutletShareFlaggedPct}% of the outlet movement; stockout products ${d.droppedOutletShareStockoutsPct}%; the residual (${(100 - d.droppedOutletShareFlaggedPct).toFixed(1)}%) is unexplained by tracked SKUs.`,
  );

  if (input.supportProfiles.length > 0) {
    lines.push(
      `Support profiles: ${input.supportProfiles
        .map((p) => `${p.id} (${p.level}, score ${p.score})`)
        .join("; ")}.`,
    );
  }

  if (input.recommendationCandidates.length > 0) {
    lines.push(
      `Recommendation candidates available: ${input.recommendationCandidates
        .map((c) => c.id)
        .join(", ")}.`,
    );
  }

  lines.push(`${input.dataGaps.length} known data gaps (see dataGaps).`);
  return lines.join(" ");
}

/**
 * Builds the investigator prompt. `repairFeedback`, when present, contains the
 * validation issues from the previous attempt so the model can correct only
 * those errors (bounded retry in investigate.ts; never silent repair).
 */
export function buildInvestigationPrompt(
  input: InvestigationInput,
  repairFeedback?: string[],
): PromptBundle {
  const context = [
    `Investigation contract: ${input.investigationId}`,
    "",
    "SIGNALS / DECOMPOSITION:",
    `  direction=${input.signals.decomposition.direction} outletDropPerDay=${input.signals.decomposition.outletDropPerDay}`,
    `  flaggedPerDay=${input.signals.decomposition.explainedByFlaggedPerDay}`,
    `  stockoutsPerDay=${input.signals.decomposition.explainedByStockoutsPerDay}`,
    `  residualPerDay=${input.signals.decomposition.residualPerDay}`,
    `  flaggedSharePct=${input.signals.decomposition.droppedOutletShareFlaggedPct}`,
    `  stockoutsSharePct=${input.signals.decomposition.droppedOutletShareStockoutsPct}`,
    `  flags=${input.signals.flags.map((f) => `${f.id}=${String(f.value)}`).join(", ")}`,
    "",
    "CONTRACT JSON:",
    JSON.stringify(input, null, 2),
    "",
    "DIGEST:",
    digest(input),
  ].join("\n");

  const allowedEvidenceIds = input.evidenceCatalog.map((f) => f.id);
  const allowedEvidenceLines = input.evidenceCatalog.map(
    (f) => `  - ${f.id} -> ${factDescription(f)}`,
  );
  const supportProfileIds = input.supportProfiles.map((p) => p.id);
  const candidateIds = input.recommendationCandidates.map((c) => c.id);

  const examplePrimary = input.supportProfiles[0]
    ? `"causalStrength":"supports","supportProfileId":"${input.supportProfiles[0].id}"`
    : `"causalStrength":"supports"`;
  const exampleValidationId =
    input.evidenceCatalog.find((f) => f.type === "outlet_revenue")?.id ??
    allowedEvidenceIds[0];
  const exampleCandidateId = input.recommendationCandidates[0]
    ? input.recommendationCandidates[0].id
    : null;

  let task = [
    "Investigate why this anomaly happened and what to do next.",
    "",
    "1. primaryFinding: the strongest CAUSAL explanation the evidence supports.",
    `   Use causalStrength "supports" (or "possible") and, when one exists, attach`,
    "   a supportProfileId. A bare measurement is NOT an adequate primary finding.",
    "2. contributingFactors: additional evidence-backed mechanisms (if any).",
    "3. alternativeHypotheses: genuine possibilities with causalStrength \"possible\"",
    "   (only when evidence leaves them open).",
    "4. recommendations: choose and tailor from the recommendationCandidates in the",
    "   contract; add a new action only if you attach evidenceIds and keep any extra",
    "   assumptions explicit. Do not invent quantities, lead times, or customer data.",
    "5. limitations: use dataGaps, and any further caution warranted by the evidence.",
    "",
    "ALLOWED EVIDENCE IDS (copy these EXACT strings; never construct or edit one):",
    ...allowedEvidenceLines,
    "",
    "ID RULE for every claim and recommendation:",
    "  - evidenceIds must ONLY contain strings from the ALLOWED EVIDENCE IDS list",
    "    above (an exact string match).",
    "  - Do NOT guess an id by changing a prefix or SKU. Example of a forbidden",
    `    fabrication: "${input.entity.id}:product:<SKU>" where that SKU is not in the`,
    "    list. Pattern-guessed ids always look plausible and always fail validation.",
    "  - If the idea you want to express has no listed id (for example, a broader",
    "    demand hypothesis): reference the decomposition / revenue / active-lines",
    "    facts instead, or restate the idea in the executiveSummary, or DROP the",
    "    item. Never output a made-up id.",
    "",
    `ALLOWED supportProfileIds: ${supportProfileIds.join(", ") || "(none present)"}`,
    "  - attach supportProfileId ONLY when causalStrength is supports or possible;",
    "    fact claims must NOT include supportProfileId.",
    "",
    `ALLOWED actionTemplateIds (recommendations only): ${candidateIds.join(", ") || "(none)"}`,
    "",
    "EXAMPLE OF THE REQUIRED SHAPE (values are illustrative, ids are real):",
    `{ "investigationId": "${input.investigationId}", "entity": { "id": "${input.entity.id}", "name": "${input.entity.name}" },`,
    `  "executiveSummary": "Short summary that cites numbers verbatim.",`,
    `  "primaryFinding": { "id": "pf-1", "statement": "... likely contributed to the revenue drop.",`,
    `    ${examplePrimary}, "evidenceIds": ["${exampleValidationId}"], "reason": "..." },`,
    `  "contributingFactors": [], "alternativeHypotheses": [],`,
    `  "recommendations": [ { "id": "rc-1",${exampleCandidateId ? ` "actionTemplateId": "${exampleCandidateId}",` : ""} "action": "...", "rationale": "...",`,
    `    "priority": "medium", "evidenceIds": ["${exampleValidationId}"], "expectedOutcome": "...", "assumptions": [] } ],`,
    '  "limitations": ["Use dataGaps wording here."] }',
    "",
    "Guard against over-attribution: if the decomposition shows a large residual",
    "(a big share of the outlet movement unexplained by flagged products), you MUST",
    "NOT state that the stockout alone caused the revenue change. Express the",
    "uncertainty explicitly and distinguish confirmed mechanisms from hypotheses.",
  ].join("\n");

  if (repairFeedback && repairFeedback.length > 0) {
    task += [
      "",
      "",
      "PREVIOUS ATTEMPT WAS REJECTED BY VALIDATION. Fix ONLY these errors and return",
      "the full corrected JSON object:",
      ...repairFeedback.map((issue) => `  - ${issue}`),
      "",
      `Approved evidence id strings (use ONLY these): ${allowedEvidenceIds.join(", ")}`,
      "Do not explain. Return the corrected JSON object and nothing else.",
    ].join("\n");
  }

  return { system: SYSTEM_PROMPT, context, task };
}