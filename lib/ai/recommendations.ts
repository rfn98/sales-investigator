import type { OutletFinding } from "../analytics/types";
import {
  decompositionEvidenceId,
  outletKey,
  productEvidenceId,
  stockoutEvidenceId,
} from "./evidence";
import { summarizeEvidence } from "./signals";
import type {
  ActionCandidate,
  DropDecomposition,
  EvidenceFact,
  Priority,
} from "./types";
import { clamp, round } from "./util";

/**
 * Deterministic recommendation candidates. The AI selects/adapts these; it
 * does not invent actions, quantities, supplier data, or customer behavior.
 */
export function buildRecommendationCandidates(
  finding: OutletFinding,
  facts: EvidenceFact[],
  decomposition: DropDecomposition,
): ActionCandidate[] {
  const summary = summarizeEvidence(facts);
  const key = outletKey(finding.outletName);
  const candidates: ActionCandidate[] = [];

  const outletMag = Math.abs(decomposition.outletDropPerDay);
  const residualRatio =
    outletMag > 0
      ? clamp(Math.abs(decomposition.residualPerDay) / outletMag, 0, 1)
      : 0;

  if (summary.stockoutFacts.length > 0) {
    const skus = [...summary.stockoutSkus].sort();
    const durations = summary.stockoutFacts
      .map((f) => `${f.productSku}: ${Number(f.measured.duration)} day(s)`)
      .join(", ");
    const skuRefs = summary.stockoutFacts.map((f) => f.productSku!);
    const evidenceIds = [
      ...summary.stockoutFacts.map((f) => f.id),
      ...skuRefs.map((sku) => productEvidenceId(finding.outletName, sku)),
    ];

    const worst = summary.worstStockoutSeverity;
    const priority: Priority =
      worst === "high" || worst === "critical" ? "high" : "medium";

    candidates.push({
      id: `${key}:rec:replenish`,
      action: `Replenish ${skus.join(", ")} and review reorder point / safety stock (out of stock for ${durations}).`,
      rationale:
        "Zero sales are verified on every stockout date, so restoring availability directly addresses the lost unit volume of these SKUs.",
      priority,
      evidenceIds,
      expectedOutcome:
        "Restored availability and recovered unit volume for the affected SKUs.",
      assumptions: [
        "Supplier lead times, reorder quantities, and safety stock levels are outside the available evidence.",
      ],
    });

    candidates.push({
      id: `${key}:rec:monitor`,
      action: `Monitor ${skus.join(", ")} over the next 7 days (next window) for continued zero-sales days.`,
      rationale:
        "Confirms whether replenishment resolved the availability gap or the stockout recurs.",
      priority: "medium",
      evidenceIds: summary.stockoutFacts.map((f) => f.id),
      expectedOutcome:
        "Early detection of recurrence during the next current window.",
      assumptions: [],
    });
  }

  if (
    decomposition.direction === "decline" &&
    summary.nonStockoutDecliningProducts.length >= 3 &&
    residualRatio > 0.5
  ) {
    const nonStockoutIds = summary.nonStockoutDecliningProducts
      .slice(0, 6)
      .map((f) => f.id);

    candidates.push({
      id: `${key}:rec:broad-probe`,
      action:
        "Investigate demand-side or operational factors affecting multiple SKUs (review channel, promotions, and store operations). This is a hypothesis, not a confirmed fact.",
      rationale: `Only ${round(
        decomposition.droppedOutletShareFlaggedPct,
        1,
      )}% of the revenue drop is explained by the flagged products; a large unexplained residual (${round(
        residualRatio * 100,
        1,
      )}%) plus declines across ${summary.nonStockoutDecliningProducts.length} non-stockout SKUs suggest additional contributing factors.`,
      priority: "medium",
      evidenceIds: [
        decompositionEvidenceId(finding.outletName),
        ...nonStockoutIds,
      ],
      expectedOutcome:
        "A concrete root-cause hypothesis testable with additional data.",
      assumptions: [
        "The residual may partly reflect declines in non-flagged SKUs that are not individually visible in this contract (see data gap 'flagged-only').",
      ],
    });
  }

  if (decomposition.direction === "growth") {
    const growthIds = summary.flaggedGrowthProducts
      .slice(0, 6)
      .map((f) => f.id);

    candidates.push({
      id: `${key}:rec:growth-sustain`,
      action:
        "Protect availability of the growing SKUs and identify what drove the growth (e.g. recent operational or promotional changes).",
      rationale:
        "Growth is observed at the outlet level and across flagged products; preventing stockouts in growing lines reduces the risk of losing the momentum.",
      priority: "medium",
      evidenceIds: [
        (summary.outletRevenueFact?.id ?? key),
        ...growthIds,
        decompositionEvidenceId(finding.outletName),
      ],
      expectedOutcome:
        "Growth continues without product availability gaps.",
      assumptions: [
        "The mechanism behind the growth is not evidenced (no promotion or calendar data in this contract).",
      ],
    });
  }

  return candidates;
}