import type { Severity } from "../analytics/types";
import { ACTIVE_LINES_DECLINE_GATE } from "../analytics/investigator";
import {
  decompositionEvidenceId,
  outletKey,
} from "./evidence";
import type {
  DropDecomposition,
  EvidenceFact,
  SignalFlag,
} from "./types";
import { round } from "./util";

const SEVERITY_ORDER: Severity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export interface EvidenceSummary {
  stockoutFacts: EvidenceFact[];
  stockoutSkus: Set<string>;
  stockoutAllVerified: boolean;
  worstStockoutSeverity: Severity | null;
  productFacts: EvidenceFact[];
  nonStockoutDecliningProducts: EvidenceFact[];
  flaggedGrowthProducts: EvidenceFact[];
  outletRevenueFact?: EvidenceFact;
  outletActiveLinesFact?: EvidenceFact;
}

export function summarizeEvidence(
  facts: EvidenceFact[],
): EvidenceSummary {
  const stockoutFacts = facts.filter((f) => f.type === "stockout");
  const stockoutSkus = new Set(
    stockoutFacts
      .map((f) => f.productSku)
      .filter((sku): sku is string => Boolean(sku)),
  );

  const productFacts = facts.filter((f) => f.type === "product_change");

  const nonStockoutDecliningProducts = productFacts.filter(
    (f) =>
      !stockoutSkus.has(f.productSku ?? "") &&
      Number(f.measured.unitsChangePct) < 0,
  );

  const flaggedGrowthProducts = productFacts.filter(
    (f) => Number(f.measured.unitsChangePct) > 0,
  );

  let worstStockoutSeverity: Severity | null = null;
  for (const s of stockoutFacts) {
    const sev = s.measured.severity as Severity;
    if (
      worstStockoutSeverity === null ||
      SEVERITY_ORDER.indexOf(sev) >
        SEVERITY_ORDER.indexOf(worstStockoutSeverity)
    ) {
      worstStockoutSeverity = sev;
    }
  }

  return {
    stockoutFacts,
    stockoutSkus,
    stockoutAllVerified: stockoutFacts.every(
      (f) => f.measured.zeroSalesVerified === true,
    ),
    worstStockoutSeverity,
    productFacts,
    nonStockoutDecliningProducts,
    flaggedGrowthProducts,
    outletRevenueFact: facts.find((f) => f.type === "outlet_revenue"),
    outletActiveLinesFact: facts.find(
      (f) => f.type === "outlet_active_lines",
    ),
  };
}

/**
 * Deterministic drop/growth decomposition built only from values already
 * present in the evidence catalog. This makes stockout-over-attribution
 * mathematically impossible: the AI sees exactly how much of the outlet
 * movement the flagged products explain.
 */
export function buildDecomposition(
  facts: EvidenceFact[],
): DropDecomposition {
  const summary = summarizeEvidence(facts);
  const outletDrop =
    (summary.outletRevenueFact
      ? Number(summary.outletRevenueFact.measured.currentPerDay)
      : 0) -
    (summary.outletRevenueFact
      ? Number(summary.outletRevenueFact.measured.baselinePerDay)
      : 0);

  let flagged = 0;
  let stockout = 0;

  for (const p of summary.productFacts) {
    const delta =
      Number(p.measured.revenueCurrentPerDay) -
      Number(p.measured.revenueBaselinePerDay);
    flagged += delta;
    if (summary.stockoutSkus.has(p.productSku ?? "")) {
      stockout += delta;
    }
  }

  const sharePct = (n: number): number =>
    outletDrop !== 0 ? (n / outletDrop) * 100 : 0;

  return {
    direction: outletDrop < 0 ? "decline" : "growth",
    outletDropPerDay: round(outletDrop, 2),
    explainedByFlaggedPerDay: round(flagged, 2),
    explainedByStockoutsPerDay: round(stockout, 2),
    residualPerDay: round(outletDrop - flagged, 2),
    droppedOutletShareFlaggedPct: round(sharePct(flagged), 1),
    droppedOutletShareStockoutsPct: round(sharePct(stockout), 1),
  };
}

/**
 * The decomposition as a citable evidence fact. The engine already references
 * `${outletKey(name)}:decomposition` from support profiles, recommendation
 * candidates, and signal flags; this fact makes that id verifiable inside
 * evidenceCatalog so the AI can cite the residual without inventing ids.
 * Every value is copied verbatim from the deterministically computed
 * DropDecomposition - no new arithmetic.
 */
export function buildDecompositionFact(
  outletName: string,
  decomposition: DropDecomposition,
): EvidenceFact {
  return {
    id: decompositionEvidenceId(outletName),
    sourceEvidenceId: null,
    type: "decomposition",
    outletName,
    measured: {
      direction: decomposition.direction,
      outletDropPerDay: decomposition.outletDropPerDay,
      explainedByFlaggedPerDay: decomposition.explainedByFlaggedPerDay,
      explainedByStockoutsPerDay: decomposition.explainedByStockoutsPerDay,
      residualPerDay: decomposition.residualPerDay,
      flaggedSharePct: decomposition.droppedOutletShareFlaggedPct,
      stockoutsSharePct: decomposition.droppedOutletShareStockoutsPct,
      residualPct: round(
        100 - decomposition.droppedOutletShareFlaggedPct,
        1,
      ),
    },
    description:
      "Drop decomposition: current-minus-baseline daily revenue at the outlet level, split into flagged-product deltas, stockout-product deltas, and a residual.",
  };
}

export function buildSignals(
  facts: EvidenceFact[],
  decomposition: DropDecomposition,
): { decomposition: DropDecomposition; flags: SignalFlag[] } {
  const summary = summarizeEvidence(facts);
  const outletName = facts[0]?.outletName ?? "outlet";
  const key = outletKey(outletName);
  const flags: SignalFlag[] = [];

  if (summary.outletActiveLinesFact) {
    const changePct = Number(
      summary.outletActiveLinesFact.measured.changePct,
    );
    flags.push({
      id: `${key}:flag:active-lines-gate`,
      label: "active-lines-decline-gate",
      value: changePct <= ACTIVE_LINES_DECLINE_GATE,
      evidenceIds: [summary.outletActiveLinesFact.id],
      note: `activeProductLines is treated as a causal decline signal only when changePct <= ${ACTIVE_LINES_DECLINE_GATE}% (ACTIVE_LINES_DECLINE_GATE).`,
    });
  }

  if (summary.stockoutFacts.length > 0) {
    flags.push({
      id: `${key}:flag:stockout-verification`,
      label: "stockout-zero-sales-verified",
      value: summary.stockoutAllVerified,
      evidenceIds: summary.stockoutFacts.map((f) => f.id),
      note: "true when no Sale rows exist for every stockout date involved.",
    });
  }

  if (decomposition.direction === "decline") {
    const outletMag = Math.abs(decomposition.outletDropPerDay);
    const residualRatio =
      outletMag > 0
        ? Math.abs(decomposition.residualPerDay) / outletMag
        : 0;

    if (residualRatio > 0.5) {
      flags.push({
        id: `${key}:flag:large-unexplained-residual`,
        label: "large-unexplained-residual",
        value: round(residualRatio, 2),
        evidenceIds: [
          decompositionEvidenceId(outletName),
          ...summary.nonStockoutDecliningProducts
            .slice(0, 4)
            .map((f) => f.id),
        ],
        note: "More than half of the outlet drop is unexplained by the flagged products visible in this contract.",
      });
    }
  }

  return { decomposition, flags };
}