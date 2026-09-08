import type { OutletFinding } from "../analytics/types";
import {
  decompositionEvidenceId,
  outletKey,
} from "./evidence";
import { summarizeEvidence } from "./signals";
import type {
  DropDecomposition,
  EvidenceFact,
  SupportLevel,
  SupportPatternId,
  SupportProfile,
} from "./types";
import { clamp, round, toPercent } from "./util";

/**
 * DETERMINISTIC SUPPORT / CONFIDENCE
 *
 * Confidence is never authored by the AI. For each possible explanation
 * pattern the engine pre-computes a SupportProfile (score 0..1 + level); AI
 * claims reference it via `supportProfileId`.
 *
 * Level bands:
 *   strong   >= 0.65
 *   moderate >= 0.40
 *   weak     <  0.40
 *
 * Patterns & formulas:
 *   1. stockout_partial_contribution (supports)
 *        score = 0.6 * verificationFactor + 0.4 * stockoutCoverageFactor
 *        verificationFactor = 1 when zero-sales verified on all stockout
 *          dates, else 0.25.
 *        stockoutCoverageFactor = |stockout product drop| / |outlet drop|,
 *          clamped to [0,1].
 *      -> the verification proves the mechanism for the affected SKUs, but
 *         the coverage factor structurally caps the score when stockouts
 *         explain only a small share of the outlet drop.
 *   2. incomplete_explanation (fact)
 *        score = 1 - flaggedCoverageFactor
 *      -> "the flagged products leave a large residual" is arithmetic, so a
 *         large residual yields a strong profile.
 *   3. broad_demand_hypothesis (possible)
 *        score = 0.5 * spreadFactor * residualFactor
 *      -> a genuine open hypothesis about unobserved causes; no direct
 *         mechanism is evidenced, so the score stays low/moderate at best.
 *   4. growth_sustain (supports)
 *        score = 0.5 + 0.25 * spreadFactor + 0.25 * zRobustFactor
 */
const LEVEL_STRONG = 0.65;
const LEVEL_MODERATE = 0.4;

export function levelFromScore(score: number): SupportLevel {
  if (score >= LEVEL_STRONG) return "strong";
  if (score >= LEVEL_MODERATE) return "moderate";
  return "weak";
}

function baseId(outletName: string, patternId: SupportPatternId): string {
  return `${outletKey(outletName)}:support:${patternId}`;
}

function percentShare(fraction: number, digits = 1): string {
  return `${toPercent(fraction, digits)}%`;
}

export function buildSupportProfiles(
  finding: OutletFinding,
  facts: EvidenceFact[],
  decomposition: DropDecomposition,
): SupportProfile[] {
  const summary = summarizeEvidence(facts);
  const key = outletKey(finding.outletName);
  const profiles: SupportProfile[] = [];

  const outletMag = Math.abs(decomposition.outletDropPerDay);
  const stockoutShare =
    outletMag > 0
      ? clamp(
          Math.abs(decomposition.explainedByStockoutsPerDay) / outletMag,
          0,
          1,
        )
      : 0;
  const flaggedShare =
    outletMag > 0
      ? clamp(
          Math.abs(decomposition.explainedByFlaggedPerDay) / outletMag,
          0,
          1,
        )
      : 0;
  const residualFactor =
    outletMag > 0
      ? clamp(Math.abs(decomposition.residualPerDay) / outletMag, 0, 1)
      : 0;
  const spreadFactor = clamp(
    summary.nonStockoutDecliningProducts.length / 4,
    0,
    1,
  );

  if (summary.stockoutFacts.length > 0) {
    const verificationFactor = summary.stockoutAllVerified ? 1 : 0.25;
    const score = round(
      0.6 * verificationFactor + 0.4 * stockoutShare,
      3,
    );
    const skuList = summary.stockoutSkus;
    const productIds = [...skuList].map((sku) =>
      (facts.find(
        (f) =>
          f.type === "product_change" &&
          f.productSku === sku,
      )?.id ?? ""),
    ).filter(Boolean);

    profiles.push({
      id: baseId(finding.outletName, "stockout_partial_contribution"),
      patternId: "stockout_partial_contribution",
      level: levelFromScore(score),
      score,
      basis: [
        summary.stockoutAllVerified
          ? `Zero sales verified on every stockout date (${[...skuList].join(", ")}).`
          : `Stockout zero-sales verification incomplete for ${[...skuList].join(", ")}.`,
        `Stockout products account for ${percentShare(stockoutShare)} of the outlet revenue drop.`,
      ],
      evidenceIds: [
        ...summary.stockoutFacts.map((f) => f.id),
        ...productIds,
      ],
    });
  }

  profiles.push({
    id: baseId(finding.outletName, "incomplete_explanation"),
    patternId: "incomplete_explanation",
    level: levelFromScore(clamp(1 - flaggedShare, 0, 1)),
    score: round(clamp(1 - flaggedShare, 0, 1), 3),
    basis: [
      `Flagged products explain ${percentShare(flaggedShare)} of the outlet revenue ${decomposition.direction === "decline" ? "drop" : "movement"}.`,
      `Residual (${percentShare(residualFactor)}) is unexplained by the products visible in this contract.`,
    ],
    evidenceIds: [
      decompositionEvidenceId(finding.outletName),
      ...summary.nonStockoutDecliningProducts
        .slice(0, 4)
        .map((f) => f.id),
    ],
  });

  if (
    decomposition.direction === "decline" &&
    summary.nonStockoutDecliningProducts.length >= 3
  ) {
    const score = round(0.5 * spreadFactor * residualFactor, 3);
    profiles.push({
      id: baseId(finding.outletName, "broad_demand_hypothesis"),
      patternId: "broad_demand_hypothesis",
      level: levelFromScore(score),
      score,
      basis: [
        `${summary.nonStockoutDecliningProducts.length} non-stockout SKUs declined during the same window.`,
        `Large unexplained residual (${percentShare(residualFactor)}) is consistent with an additional cause, but no direct evidence supports it.`,
      ],
      evidenceIds: [
        decompositionEvidenceId(finding.outletName),
        ...summary.nonStockoutDecliningProducts
          .slice(0, 6)
          .map((f) => f.id),
      ],
    });
  }

  if (decomposition.direction === "growth") {
    const growthSpread = clamp(
      summary.flaggedGrowthProducts.length / 4,
      0,
      1,
    );
    const zRaw = summary.outletRevenueFact?.measured.zScore ?? "n/a";
    const zRobust =
      typeof zRaw === "number" && zRaw > 2 ? 1 : 0;
    const score = round(
      0.5 + 0.25 * growthSpread + 0.25 * zRobust,
      3,
    );

    profiles.push({
      id: baseId(finding.outletName, "growth_sustain"),
      patternId: "growth_sustain",
      level: levelFromScore(score),
      score,
      basis: [
        `Growth is observed at ${summary.flaggedGrowthProducts.length} flagged product(s) and at the outlet level (z=${String(zRaw)}).`,
        "The mechanism behind the growth is not evidenced in this contract.",
      ],
      evidenceIds: [
        (summary.outletRevenueFact?.id ?? key),
        ...summary.flaggedGrowthProducts
          .slice(0, 6)
          .map((f) => f.id),
      ],
    });
  }

  return profiles;
}