import type { Report } from "../analytics/types";
import { DATA_GAPS } from "./gaps";
import { buildEvidenceFacts } from "./evidence";
import { buildRecommendationCandidates } from "./recommendations";
import { buildDecomposition, buildDecompositionFact, buildSignals } from "./signals";
import { buildSupportProfiles } from "./support";
import type {
  CausalRulesRef,
  InvestigationInput,
} from "./types";
import { stableHash } from "./util";

/**
 * The deterministic contract assembler. Pure: consumes a Report, produces
 * InvestigationInput(s). No DB access, no provider calls.
 */

export const CAUSALITY_RULES: CausalRulesRef = {
  strengths: ["fact", "supports", "possible"],
  forbiddenPhrases: [
    "customers stopped",
    "customers left",
    "customers decided",
    "lost customers",
  ],
  claimRule:
    "Every material claim must reference at least one evidence id from evidenceCatalog.",
  supportRule:
    "Confidence is fixed by supportProfiles; claims must reference supportProfileId and never author a trust score.",
  activeLinesRule:
    "activeProductLines is causal evidence for a decline only when changePct <= -10% (decline gate); otherwise it is descriptive only.",
  numbersRule:
    "The only reliable numbers are those in evidenceCatalog. Copy them; never calculate, round down materially, or invent new figures.",
};

const SUPPORT_FORMULA =
  "Support scores (0..1) are precomputed deterministically: " +
  "level bands strong>=0.65, moderate>=0.40, weak<0.40. " +
  "stockout_partial_contribution = 0.6*verificationFactor + 0.4*stockoutCoverage; " +
  "incomplete_explanation = 1 - flaggedCoverage; " +
  "broad_demand_hypothesis = 0.5*spreadFactor*residualFactor; " +
  "growth_sustain = 0.5 + 0.25*spreadFactor + 0.25*zRobustFactor.";

export function buildInvestigationInputs(
  report: Report,
): InvestigationInput[] {
  const inputs: InvestigationInput[] = [];

  for (const finding of report.outlets) {
    if (finding.status === "NORMAL") continue;

    const facts = buildEvidenceFacts(finding);
    const decomposition = buildDecomposition(facts);
    const signals = buildSignals(facts, decomposition);
    const decompositionFact = buildDecompositionFact(
      finding.outletName,
      decomposition,
    );
    const supportProfiles = buildSupportProfiles(
      finding,
      facts,
      decomposition,
    );
    const recommendationCandidates = buildRecommendationCandidates(
      finding,
      facts,
      decomposition,
    );

    inputs.push({
      investigationId: stableHash(
        `${report.endDate}|${finding.outletName.trim().toLowerCase()}`,
      ),
      generatedFor: {
        endDate: report.endDate,
        analyzedAt: report.analyzedAt,
      },
      entity: {
        id: finding.outletName.trim().toLowerCase().replace(/\s+/g, "-"),
        name: finding.outletName,
      },
      window: {
        currentStart: report.window.currentStart,
        currentEnd: report.window.currentEnd,
        baselineStart: report.window.baselineStart,
        baselineEnd: report.window.baselineEnd,
        currentDays: report.window.currentDays,
        baselineDays: report.window.baselineDays,
      },
      outcome: {
        status: finding.status,
        severity: finding.severity,
        revenueChangePct: finding.revenue.changePct,
        zScore: finding.revenue.zScore,
        revenuePerDay: {
          baseline: finding.revenue.baselineDailyAvg,
          current: finding.revenue.currentDailyAvg,
        },
        activeLinesPerDay: {
          baseline: finding.activeProductLines.baselineDailyAvg,
          current: finding.activeProductLines.currentDailyAvg,
          declineGateApplied:
            finding.activeProductLines.changePct <= -10,
        },
      },
      evidenceCatalog: [decompositionFact, ...facts],
      signals,
      supportProfiles,
      recommendationCandidates,
      dataGaps: DATA_GAPS,
      methodology: {
        zScore: report.methodology.zScore,
        activeProductLines: report.methodology.activeProductLines,
        severityRule: report.methodology.severityRule,
        decomposition:
          "Drop decomposition: current-minus-baseline daily revenue at the outlet level, split into sum of flagged-product deltas and a residual. Both are direct arithmetic over evidenceCatalog revenue-per-day values.",
        supportFormula: SUPPORT_FORMULA,
      },
      causalityRules: CAUSALITY_RULES,
    });
  }

  return inputs;
}