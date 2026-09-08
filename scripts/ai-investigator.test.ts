import { test } from "node:test";
import assert from "node:assert/strict";
import type { Report, OutletFinding } from "../lib/analytics/types";
import {
  availableProviderIds,
  buildInvestigationPrompt,
  CAUSALITY_RULES,
  createInvestigator,
  extractAssistantContent,
  getProvider,
  loadOpenAIConfig,
  parseInvestigationOutput,
  registerProvider,
  runInvestigation,
  runOutletInvestigation,
  resolveUiProvider,
  validateInvestigationResult,
  buildInvestigationInputs,
} from "../lib/ai";
import { ProviderConfigurationError } from "../lib/ai";
import type { PromptBundle, ProviderResponse } from "../lib/ai/types";
import type { InvestigationInput, InvestigationResult } from "../lib/ai/types";
import type { CausalStrength } from "../lib/ai/types";
import type { InvestigatorProvider } from "../lib/ai";

/**
 * Provider + validation unit tests. No network, no API key, no database.
 */

const BE_ID = "outlet-bekasi";
const REV = `${BE_ID}:revenue`;
const DM1_PRODUCT = `${BE_ID}:product:DM-001`;
const DM1_STOCKOUT = `${BE_ID}:stockout:DM-001`;
const DECOMP = `${BE_ID}:decomposition`;
const SUPPORT = `${BE_ID}:support:stockout_partial_contribution`;
const REC = `${BE_ID}:rec:replenish`;

function makeInput(): InvestigationInput {
  return {
    investigationId: "test-inv-1",
    generatedFor: {
      endDate: "2026-09-07",
      analyzedAt: "2026-09-08T00:00:00.000Z",
    },
    entity: { id: BE_ID, name: "Outlet Bekasi" },
    window: {
      currentStart: "2026-09-01",
      currentEnd: "2026-09-07",
      baselineStart: "2026-08-04",
      baselineEnd: "2026-08-31",
      currentDays: 7,
      baselineDays: 28,
    },
    outcome: {
      status: "ANOMALY_DECLINE",
      severity: "critical",
      revenueChangePct: -42.7,
      zScore: -42.04,
      revenuePerDay: { baseline: 13931250, current: 7976000 },
      activeLinesPerDay: { baseline: 30, current: 29.1, declineGateApplied: false },
    },
    evidenceCatalog: [
      {
        id: REV,
        sourceEvidenceId: "E3",
        type: "outlet_revenue",
        outletName: "Outlet Bekasi",
        measured: {
          severity: "critical",
          changePct: -42.7,
          zScore: -42.04,
          baselinePerDay: 13931250,
          currentPerDay: 7976000,
        },
        description: "Daily revenue 13,931,250 -> 7,976,000 (-42.7%, z=-42.04)",
      },
      {
        id: DM1_PRODUCT,
        sourceEvidenceId: "E5",
        type: "product_change",
        outletName: "Outlet Bekasi",
        productSku: "DM-001",
        productName: "Dimsum Ayam",
        measured: {
          severity: "high",
          unitsBaseline: 32.6,
          unitsCurrent: 9.6,
          unitsChangePct: -70.6,
          revenueBaselinePerDay: 586286,
          revenueCurrentPerDay: 172286,
          revenueChangePct: -70.6,
        },
        description: "DM-001 (Dimsum Ayam) units/day 32.6 -> 9.6 (-70.6%)",
      },
      {
        id: DM1_STOCKOUT,
        sourceEvidenceId: "E11",
        type: "stockout",
        outletName: "Outlet Bekasi",
        productSku: "DM-001",
        measured: {
          duration: 4,
          days: ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"],
          zeroSalesVerified: true,
          severity: "high",
        },
        description: "DM-001 stockout 4 day(s) (zero sales verified)",
      },
      {
        id: DECOMP,
        sourceEvidenceId: null,
        type: "decomposition",
        outletName: "Outlet Bekasi",
        measured: {
          direction: "decline",
          outletDropPerDay: -5955250,
          explainedByFlaggedPerDay: -1594500,
          explainedByStockoutsPerDay: -669357,
          residualPerDay: -4360750,
          flaggedSharePct: 26.8,
          stockoutsSharePct: 11.2,
          residualPct: 73.2,
        },
        description: "Drop decomposition for Outlet Bekasi",
      },
    ],
    signals: {
      decomposition: {
        direction: "decline",
        outletDropPerDay: -5955250,
        explainedByFlaggedPerDay: -1594500,
        explainedByStockoutsPerDay: -669357,
        residualPerDay: -4360750,
        droppedOutletShareFlaggedPct: 26.8,
        droppedOutletShareStockoutsPct: 11.2,
      },
      flags: [],
    },
    supportProfiles: [
      {
        id: SUPPORT,
        patternId: "stockout_partial_contribution",
        level: "moderate",
        score: 0.645,
        basis: ["Zero sales verified on every stockout date."],
        evidenceIds: [DM1_STOCKOUT, DM1_PRODUCT],
      },
    ],
    recommendationCandidates: [
      {
        id: REC,
        action: "Replenish DM-001 and review reorder point.",
        rationale: "Restores availability.",
        priority: "high",
        evidenceIds: [DM1_STOCKOUT, DM1_PRODUCT],
        expectedOutcome: "Availability restored.",
        assumptions: ["Lead times unknown."],
      },
    ],
    dataGaps: [{ id: "no-promo-calendar", text: "No promotions data." }],
    methodology: {
      zScore: "Rolling windows.",
      activeProductLines: "Positive-sales product lines per day.",
      severityRule: "Deterministic bands.",
      decomposition: "Outlet minus flagged products.",
      supportFormula: "Precomputed by the engine.",
    },
    causalityRules: CAUSALITY_RULES,
  };
}

function makeValidResult(): InvestigationResult {
  return {
    investigationId: "test-inv-1",
    entity: { id: BE_ID, name: "Outlet Bekasi" },
    executiveSummary:
      "Bekasi revenue dropped 42.7%. The DM-001 stockout (4 days, zero sales verified) likely contributed to the drop; a large share of the movement remains unexplained by tracked SKUs.",
    primaryFinding: {
      id: "f1",
      statement:
        "The DM-001 stockout (4 days, zero sales verified) likely contributed to the drop in revenue.",
      causalStrength: "supports",
      supportProfileId: SUPPORT,
      evidenceIds: [DM1_STOCKOUT, REV],
      reason:
        "Stockout dates are zero-sales verified and fall inside the current window.",
    },
    contributingFactors: [
      {
        id: "f2",
        statement:
          "Flagged products account for 26.8% of the outlet movement; 73.2% is unexplained by tracked SKUs.",
        causalStrength: "fact",
        evidenceIds: [DECOMP],
        reason: "Direct arithmetic over the decomposition evidence.",
      },
    ],
    alternativeHypotheses: [],
    recommendations: [
      {
        id: "r1",
        actionTemplateId: REC,
        action: "Replenish DM-001 and review the reorder point.",
        rationale: "Restores availability of the affected SKU.",
        priority: "high",
        evidenceIds: [DM1_STOCKOUT, DM1_PRODUCT],
        expectedOutcome: "Availability restored.",
        assumptions: ["Supplier lead times are outside the available evidence."],
      },
    ],
    limitations: ["No promotions, pricing, or customer-traffic data is available."],
  };
}

test("valid structured response passes validation", () => {
  const input = makeInput();
  const outcome = validateInvestigationResult(input, makeValidResult());
  assert.equal(outcome.ok, true);
  if (outcome.ok) assert.equal(outcome.result.investigationId, "test-inv-1");
});

test("malformed JSON fails parsing", () => {
  const bad = parseInvestigationOutput("{ not json");
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /not valid JSON/);

  const empty = parseInvestigationOutput("   ");
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.error, /Empty provider output/);

  const fenced = parseInvestigationOutput("```json\n{}\n```");
  assert.equal(fenced.ok, true);
});

test("forged evidence id is rejected (no silent repair)", () => {
  const input = makeInput();
  const result = makeValidResult();
  result.primaryFinding.evidenceIds = [
    `${BE_ID}:product:MADE-UP-999`,
    REV,
  ];
  const outcome = validateInvestigationResult(input, result);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.match(outcome.issues.join("\n"), /evidenceIds/);
});

test("unsupported causality claim is rejected", () => {
  const input = makeInput();

  const entirely = makeValidResult();
  entirely.primaryFinding.statement =
    "The DM-001 stockout caused the entire revenue decline.";
  const rejected = validateInvestigationResult(input, entirely);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.match(rejected.issues.join("\n"), /forbidden phrase/);

  const badStrength = makeValidResult();
  badStrength.primaryFinding.causalStrength = "proven" as CausalStrength;
  const rejected2 = validateInvestigationResult(input, badStrength);
  assert.equal(rejected2.ok, false);
  if (!rejected2.ok) assert.match(rejected2.issues.join("\n"), /causalStrength/);
});

test("missing required fields are rejected", () => {
  const input = makeInput();

  const noPrimary = makeValidResult() as Partial<InvestigationResult> & Record<string, unknown>;
  delete noPrimary.primaryFinding;
  const outcome1 = validateInvestigationResult(input, noPrimary);
  assert.equal(outcome1.ok, false);

  const emptyEvidence = makeValidResult();
  emptyEvidence.primaryFinding.evidenceIds = [];
  const outcome2 = validateInvestigationResult(input, emptyEvidence);
  assert.equal(outcome2.ok, false);
  if (!outcome2.ok) assert.match(outcome2.issues.join("\n"), /evidenceIds/);

  const mismatchedEntity = makeValidResult();
  mismatchedEntity.entity = { id: BE_ID, name: "Outlet Bogor" };
  const outcome3 = validateInvestigationResult(input, mismatchedEntity);
  assert.equal(outcome3.ok, false);
  if (!outcome3.ok) assert.match(outcome3.issues.join("\n"), /entity/);
});

test("fact claim with supportProfileId is rejected", () => {
  const input = makeInput();
  const result = makeValidResult();
  result.primaryFinding.causalStrength = "fact";
  result.primaryFinding.statement = "Bekasi revenue fell 42.7%.";
  result.primaryFinding.supportProfileId = SUPPORT;
  const outcome = validateInvestigationResult(input, result);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.match(outcome.issues.join("\n"), /fact/);
});

test("forbidden phrase inside a claim is rejected", () => {
  const input = makeInput();
  const result = makeValidResult();
  result.executiveSummary =
    "Our customers decided to go elsewhere, so revenue fell.";
  const outcome = validateInvestigationResult(input, result);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.match(outcome.issues.join("\n"), /customers decided/);
});

test("evidence id must exist for alternativeHypotheses too", () => {
  const input = makeInput();
  const result = makeValidResult();
  result.alternativeHypotheses = [
    {
      id: "h1",
      statement:
        "Changes in store operations may indicate a broader demand shift.",
      causalStrength: "possible",
      evidenceIds: ["outlet-bekasi:product:NOPE"],
      reason: "Open hypothesis; no direct evidence.",
    },
  ];
  const outcome = validateInvestigationResult(input, result);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.match(outcome.issues.join("\n"), /alternativeHypotheses/);
});

test("prompt bundle is built with all three sections", () => {
  const bundle = buildInvestigationPrompt(makeInput());
  assert.ok(bundle.system.length > 50);
  assert.ok(bundle.context.includes("CONTRACT JSON"));
  assert.ok(bundle.task.length > 50);
});

test("prompt lists ALLOWED EVIDENCE IDS and keeps supportProfileId off facts", () => {
  const bundle = buildInvestigationPrompt(makeInput());
  assert.ok(bundle.task.includes("ALLOWED EVIDENCE IDS"));
  assert.ok(bundle.task.includes(DM1_STOCKOUT));
  assert.ok(bundle.task.includes(DM1_PRODUCT));
  assert.match(bundle.task, /fact claims must NOT include supportProfileId/);
  assert.ok(bundle.task.includes(`ALLOWED actionTemplateIds`));
  assert.ok(bundle.task.includes(REC));
});

test("prompt lists ids with descriptions and the anti-fabrication ID RULE", () => {
  const bundle = buildInvestigationPrompt(makeInput());
  assert.match(bundle.task, /outlet daily revenue/);
  assert.match(bundle.task, /stockout DM-001/);
  assert.match(bundle.task, /ID RULE for every claim and recommendation/);
  assert.match(bundle.task, /never construct or edit one/);
  assert.match(bundle.task, /:product:<SKU>/);
  assert.match(bundle.task, /Pattern-guessed ids always look plausible/);
});

test("prompt with repair feedback carries errors plus approved id strings", () => {
  const bundle = buildInvestigationPrompt(makeInput(), [
    "primaryFinding: causalStrength must be one of fact, supports, possible.",
    "recommendations[0]: evidenceIds must exist in evidenceCatalog.",
  ]);
  assert.ok(bundle.task.includes("PREVIOUS ATTEMPT WAS REJECTED BY VALIDATION"));
  assert.ok(bundle.task.includes("causalStrength must be one of"));
  assert.ok(bundle.task.includes("evidenceIds must exist"));
  assert.ok(bundle.task.includes("Approved evidence id strings (use ONLY these)"));
  assert.ok(bundle.task.includes(REV));
});

test("decomposition is a citable fact in engine-built evidenceCatalog", () => {
  const inputs = buildInvestigationInputs(minimalReport());
  assert.equal(inputs.length, 1);
  const catalog = inputs[0].evidenceCatalog;
  const deco = catalog.find((f) => f.type === "decomposition");
  assert.ok(deco);
  assert.equal(deco!.id, "outlet-bekasi:decomposition");
  assert.equal(deco!.measured.outletDropPerDay, -5955250);
  assert.equal(deco!.measured.residualPct, 100);
  assert.equal(deco!.measured.flaggedSharePct, 0);
  assert.equal(catalog[0].type, "decomposition");
  const validation = validateInvestigationResult(
    inputs[0],
    minimalValidResultFor(inputs[0]),
  );
  assert.equal(validation.ok, true);
});

test("validate feedback lists the allowed evidence ids", () => {
  const input = makeInput();
  const result = makeValidResult();
  result.primaryFinding.evidenceIds = [`${BE_ID}:product:MADE-UP-999`];
  const outcome = validateInvestigationResult(input, result);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) {
    const joined = outcome.issues.join("\n");
    assert.match(joined, /Allowed ids:/);
    assert.ok(joined.includes(REV));
    assert.ok(joined.includes(DECOMP));
  }
});

/**
 * Fake providers for retry tests: first attempt (bundle WITHOUT a repair
 * directive) returns the bad raw; the retry bundle returns the good raw.
 */
class FakeRetryProvider implements InvestigatorProvider {
  readonly id = "fake-retry";
  readonly model = "fake-1";
  constructor(
    private readonly badRaw: string,
    private readonly goodRaw: string,
  ) {}
  async investigate(bundle: PromptBundle): Promise<ProviderResponse> {
    const isRetry = bundle.task.includes("PREVIOUS ATTEMPT WAS REJECTED");
    return {
      raw: isRetry ? this.goodRaw : this.badRaw,
      model: this.model,
    };
  }
}

class FakeAlwaysBadProvider implements InvestigatorProvider {
  readonly id = "fake-bad";
  readonly model = "fake-1";
  constructor(private readonly badRaw: string) {}
  async investigate(_bundle: PromptBundle): Promise<ProviderResponse> {
    return { raw: this.badRaw, model: this.model };
  }
}

function minimalReport(): Report {
  const finding = {
    outletName: "Outlet Bekasi",
    status: "ANOMALY_DECLINE",
    severity: "critical",
    revenue: {
      changePct: -42.7,
      zScore: -42.04,
      baselineDailyAvg: 13931250,
      currentDailyAvg: 7976000,
    },
    activeProductLines: {
      baselineDailyAvg: 30,
      currentDailyAvg: 29.1,
      changePct: -2.857,
    },
    evidence: [
      {
        id: "E3",
        type: "outlet_revenue_change",
        severity: "critical",
        outletName: "Outlet Bekasi",
        baselineValue: 13931250,
        currentValue: 7976000,
        changePct: -42.7,
        zScore: -42.04,
        description: "Daily revenue 13,931,250 -> 7,976,000 (-42.7%, z=-42.04)",
      },
    ],
  } as unknown as OutletFinding;

  return {
    analyzedAt: "2026-09-08T00:00:00.000Z",
    endDate: "2026-09-07",
    window: {
      currentStart: "2026-09-01",
      currentEnd: "2026-09-07",
      baselineStart: "2026-08-04",
      baselineEnd: "2026-08-31",
      currentDays: 7,
      baselineDays: 28,
    },
    methodology: {
      zScore: "z",
      activeProductLines: "apl",
      severityRule: "sr",
    },
    outlets: [finding],
  } as unknown as Report;
}

function minimalValidResultFor(input: InvestigationInput): InvestigationResult {
  const revenueId = input.evidenceCatalog.find(
    (f) => f.type === "outlet_revenue",
  )!.id;
  const profileId = input.supportProfiles[0]?.id ?? "";
  return {
    investigationId: input.investigationId,
    entity: { id: input.entity.id, name: input.entity.name },
    executiveSummary:
      "Bekasi revenue dropped. The measured mechanism likely contributed to the drop; the movement is not fully explained by tracked SKUs.",
    primaryFinding: {
      id: "pf-1",
      statement:
        "The verified availability gap in the current window likely contributed to the drop in revenue.",
      causalStrength: "supports",
      supportProfileId: profileId,
      evidenceIds: [revenueId],
      reason: "Zero-sales dates are verified inside the current window.",
    },
    contributingFactors: [],
    alternativeHypotheses: [],
    recommendations: [],
    limitations: ["No promotions, pricing, or customer-traffic data is available."],
  };
}

function badRawWithForgedId(): string {
  const result = makeValidResult();
  result.primaryFinding.evidenceIds = [`${BE_ID}:product:MADE-UP-999`, REV];
  return JSON.stringify(result);
}

test("bounded retry recovers a valid result (attempts=2)", async () => {
  const expected = buildInvestigationInputs(minimalReport())[0];
  const good = JSON.stringify(minimalValidResultFor(expected));
  registerProvider(
    "fake-retry",
    () => new FakeRetryProvider(badRawWithForgedId(), good),
  );
  const outcomes = await runInvestigation(minimalReport(), {
    providerId: "fake-retry",
  });
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].ok, true);
  assert.equal(outcomes[0].attempts, 2);
  assert.equal(outcomes[0].model, "fake-1");
});

test("retry stops after maxAttempts and still fails strictly", async () => {
  registerProvider(
    "fake-bad",
    () => new FakeAlwaysBadProvider(badRawWithForgedId()),
  );
  const outcomes = await runInvestigation(minimalReport(), {
    providerId: "fake-bad",
  });
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].ok, false);
  assert.equal(outcomes[0].attempts, 2);
  assert.match(outcomes[0].errors.join("\n"), /evidenceIds/);
});

test("retryOnFailure=false short-circuits to a single attempt", async () => {
  registerProvider(
    "fake-bad",
    () => new FakeAlwaysBadProvider(badRawWithForgedId()),
  );
  const outcomes = await runInvestigation(minimalReport(), {
    providerId: "fake-bad",
    retryOnFailure: false,
  });
  assert.equal(outcomes[0].ok, false);
  assert.equal(outcomes[0].attempts, 1);
});

test("resolveUiProvider: offline none when OpenAI is not configured", () => {
  const resolution = resolveUiProvider({});
  assert.equal(resolution.providerId, "none");
  assert.ok(resolution.configError);
  assert.match(resolution.configError, /OPENAI_API_KEY/);
});

test("resolveUiProvider: openai when key and model are present", () => {
  const resolution = resolveUiProvider({
    OPENAI_API_KEY: "sk-test",
    OPENAI_MODEL: "combo-untuk-coding-auto-with-image",
  });
  assert.equal(resolution.providerId, "openai");
  assert.equal(resolution.configError, undefined);
});

test("resolveUiProvider: explicit AI_PROVIDER wins and is validated", () => {
  const ok = resolveUiProvider({
    AI_PROVIDER: "none",
    OPENAI_API_KEY: "sk-test",
    OPENAI_MODEL: "m",
  });
  assert.equal(ok.providerId, "none");
  assert.equal(ok.configError, undefined);

  const unknown = resolveUiProvider({ AI_PROVIDER: "does-not-exist" });
  assert.equal(unknown.providerId, "none");
  assert.match(unknown.configError!, /Unknown AI_PROVIDER/);
});

test("runOutletInvestigation: unknown entity returns null", async () => {
  const outcome = await runOutletInvestigation(minimalReport(), "outlet-nope", {
    providerId: "fake-retry",
  });
  assert.equal(outcome, null);
});

test("runOutletInvestigation: none provider returns the offline stub outcome", async () => {
  const outcome = await runOutletInvestigation(minimalReport(), "outlet-bekasi", {
    providerId: "none",
  });
  assert.ok(outcome);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.providerId, "none");
  assert.equal(outcome.input.entity.id, "outlet-bekasi");
  assert.match(outcome.errors.join("\n"), /offline\/deterministic/);
});

test("runOutletInvestigation: bounded retry for a single outlet", async () => {
  const expected = buildInvestigationInputs(minimalReport())[0];
  const good = JSON.stringify(minimalValidResultFor(expected));
  registerProvider(
    "fake-retry",
    () => new FakeRetryProvider(badRawWithForgedId(), good),
  );
  const outcome = await runOutletInvestigation(minimalReport(), "outlet-bekasi", {
    providerId: "fake-retry",
  });
  assert.ok(outcome);
  assert.equal(outcome.ok, true);
  assert.equal(outcome.attempts, 2);
  assert.equal(outcome.result?.investigationId, expected.investigationId);
});

test("provider selection: registry, createInvestigator, unknown provider", () => {
  const ids = availableProviderIds();
  assert.ok(ids.includes("none"));
  assert.ok(ids.includes("openai"));

  const none = createInvestigator("none");
  assert.equal(none.id, "none");

  assert.throws(() => getProvider("does-not-exist"), /Unknown investigator provider/);
});

test("none provider never calls a network: investigate rejects with stub error", async () => {
  const provider = createInvestigator("none");
  await assert.rejects(
    provider.investigate({
      system: "s",
      context: "c",
      task: "t",
    }),
    /stub/,
  );
});

test("runInvestigation with none provider returns deterministic offline outcome", async () => {
  const finding = {
    outletName: "Outlet Bekasi",
    status: "ANOMALY_DECLINE",
    severity: "critical",
    revenue: {
      changePct: -42.7,
      zScore: -42.04,
      baselineDailyAvg: 13931250,
      currentDailyAvg: 7976000,
    },
    activeProductLines: {
      baselineDailyAvg: 30,
      currentDailyAvg: 29.1,
      changePct: -2.857,
    },
    evidence: [],
  } as unknown as OutletFinding;

  const report = {
    analyzedAt: "2026-09-08T00:00:00.000Z",
    endDate: "2026-09-07",
    window: {
      currentStart: "2026-09-01",
      currentEnd: "2026-09-07",
      baselineStart: "2026-08-04",
      baselineEnd: "2026-08-31",
      currentDays: 7,
      baselineDays: 28,
    },
    methodology: {
      zScore: "z",
      activeProductLines: "apl",
      severityRule: "sr",
    },
    outlets: [finding],
  } as unknown as Report;

  const outcomes = await runInvestigation(report);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].ok, false);
  assert.equal(outcomes[0].providerId, "none");
  assert.equal(outcomes[0].model, undefined);
  assert.match(outcomes[0].errors[0], /stub/);
});

test("loadOpenAIConfig: missing key and missing model raise configuration errors", () => {
  assert.throws(
    () => loadOpenAIConfig({}),
    (error: unknown) =>
      error instanceof ProviderConfigurationError &&
      /OPENAI_API_KEY/.test(error.message),
  );
  assert.throws(
    () => loadOpenAIConfig({ OPENAI_API_KEY: "local" }),
    (error: unknown) =>
      error instanceof ProviderConfigurationError &&
      /OPENAI_MODEL/.test(error.message),
  );

  const config = loadOpenAIConfig({
    OPENAI_API_KEY: "local",
    OPENAI_MODEL: "combo-untuk-coding-auto-with-image",
  });
  assert.equal(config.apiKey, "local");
  assert.equal(config.model, "combo-untuk-coding-auto-with-image");
  assert.equal(config.baseUrl, "http://localhost:20128/v1");
  assert.equal(config.jsonMode, false);
});

test("extractAssistantContent: string and parts-array content, and missing content", () => {
  assert.equal(
    extractAssistantContent({
      choices: [{ message: { content: "hi" } }],
    }),
    "hi",
  );
  assert.equal(
    extractAssistantContent({
      choices: [
        {
          message: {
            content: [
              { type: "text", text: "part1" },
              { type: "text", text: " part2" },
            ],
          },
        },
      ],
    }),
    "part1 part2",
  );
  assert.equal(extractAssistantContent({ choices: [] }), null);
  assert.equal(
    extractAssistantContent({ choices: [{ message: { content: null } }] }),
    null,
  );
});