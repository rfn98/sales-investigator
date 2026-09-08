import type {
  Evidence,
  OutletFinding,
} from "../analytics/types";
import type { DataGap, EvidenceFact } from "./types";

/**
 * Stable, content-derived evidence ids. These are what the AI references for
 * provenance, replacing the ephemeral E{n} ids produced by the analytics
 * layer. Each fact keeps the original id (`sourceEvidenceId`) so claims can be
 * traced back to the audited Report JSON.
 */
export function outletKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

export const outletRevenueEvidenceId = (name: string): string =>
  `${outletKey(name)}:revenue`;

export const outletActiveLinesEvidenceId = (name: string): string =>
  `${outletKey(name)}:active-lines`;

export const productEvidenceId = (name: string, sku: string): string =>
  `${outletKey(name)}:product:${sku}`;

export const stockoutEvidenceId = (name: string, sku: string): string =>
  `${outletKey(name)}:stockout:${sku}`;

export const decompositionEvidenceId = (name: string): string =>
  `${outletKey(name)}:decomposition`;

function toJson(
  measured: Record<string, number | string | boolean | string[]>,
): Record<string, number | string | boolean | string[]> {
  return measured;
}

function fromEvidence(e: Evidence):
  | Omit<EvidenceFact, "outletName">
  | null {
  switch (e.type) {
    case "outlet_revenue_change":
      return {
        id: outletRevenueEvidenceId(e.outletName),
        sourceEvidenceId: e.id,
        type: "outlet_revenue",
        measured: toJson({
          severity: e.severity,
          changePct: e.changePct ?? 0,
          zScore: e.zScore ?? "n/a",
          baselinePerDay: e.baselineValue ?? 0,
          currentPerDay: e.currentValue ?? 0,
        }),
        description: e.description,
      };

    case "outlet_active_lines_change":
      return {
        id: outletActiveLinesEvidenceId(e.outletName),
        sourceEvidenceId: e.id,
        type: "outlet_active_lines",
        measured: toJson({
          changePct: e.changePct ?? 0,
          zScore: e.zScore ?? "n/a",
          baselinePerDay: e.baselineValue ?? 0,
          currentPerDay: e.currentValue ?? 0,
        }),
        description: e.description,
      };

    case "product_quantity_change":
      if (!e.productSku) return null;
      return {
        id: productEvidenceId(e.outletName, e.productSku),
        sourceEvidenceId: e.id,
        type: "product_change",
        productSku: e.productSku,
        productName: e.productName,
        measured: toJson({
          severity: e.severity,
          unitsBaseline: e.baselineValue ?? 0,
          unitsCurrent: e.currentValue ?? 0,
          unitsChangePct: e.changePct ?? 0,
          revenueBaselinePerDay: e.revenueBaselineValue ?? 0,
          revenueCurrentPerDay: e.revenueCurrentValue ?? 0,
          revenueChangePct: e.revenueChangePct ?? 0,
        }),
        description: e.description,
      };

    case "stockout":
      if (!e.productSku) return null;
      return {
        id: stockoutEvidenceId(e.outletName, e.productSku),
        sourceEvidenceId: e.id,
        type: "stockout",
        productSku: e.productSku,
        productName: e.productName,
        measured: toJson({
          duration: (e.days ?? []).length,
          days: (e.days ?? []).map((day) => day.date),
          zeroSalesVerified: e.zeroSalesVerified ?? false,
          severity: e.severity,
        }),
        description: e.description,
      };

    default:
      return null;
  }
}

/**
 * Builds the typed evidence catalog for an outlet finding. Does not include
 * the decomposition pseudo-fact; that is appended by signals.ts once the
 * decomposition is computed.
 */
export function buildEvidenceFacts(
  finding: OutletFinding,
): EvidenceFact[] {
  const facts: EvidenceFact[] = [];

  for (const evidence of finding.evidence) {
    const fact = fromEvidence(evidence);
    if (fact) {
      facts.push({ ...fact, outletName: finding.outletName });
    }
  }

  return facts;
}