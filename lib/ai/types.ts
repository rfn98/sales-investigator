import type { Severity } from "../analytics/types";

/**
 * AI INVESTIGATOR — contract types.
 *
 * Boundary: this layer consumes the deterministic Report only. It never
 * queries PostgreSQL and never computes anomaly scores. Everything the AI
 * may reference is captured in `InvestigationInput`; every number it may
 * repeat must come from `evidenceCatalog`.
 */

export type CausalStrength = "fact" | "supports" | "possible";
export type SupportLevel = "strong" | "moderate" | "weak";
export type Priority = "high" | "medium" | "low";

export type EvidenceFactType =
  | "outlet_revenue"
  | "outlet_active_lines"
  | "product_change"
  | "stockout"
  | "decomposition";

/**
 * A single measured fact. `id` is stable and content-derived (see
 * evidence.ts). `sourceEvidenceId` is the original evidence id from the
 * deterministic Report (e.g. "E1") so every AI claim can be traced back to
 * the audited analytics output.
 */
export interface EvidenceFact {
  id: string;
  sourceEvidenceId: string | null;
  type: EvidenceFactType;
  outletName: string;
  productSku?: string;
  productName?: string;
  measured: Record<string, number | string | boolean | string[]>;
  description: string;
}

export interface DropDecomposition {
  direction: "decline" | "growth";
  /** current − baseline daily revenue (IDR/day). Negative on a decline. */
  outletDropPerDay: number;
  /** sum of daily revenue deltas across flagged product evidence. */
  explainedByFlaggedPerDay: number;
  /** sum of daily revenue deltas across stockout-affected flagged products. */
  explainedByStockoutsPerDay: number;
  /** outletDropPerDay − explainedByFlaggedPerDay. */
  residualPerDay: number;
  droppedOutletShareFlaggedPct: number;
  droppedOutletShareStockoutsPct: number;
}

export interface SignalFlag {
  id: string;
  label: string;
  value: boolean | number | string;
  evidenceIds: string[];
  note: string;
}

export type SupportPatternId =
  | "stockout_partial_contribution"
  | "incomplete_explanation"
  | "broad_demand_hypothesis"
  | "growth_sustain";

/**
 * Deterministic confidence. The AI never authors a score; it references
 * `SupportProfile.id` from claims via `supportProfileId`.
 */
export interface SupportProfile {
  id: string;
  patternId: SupportPatternId;
  level: SupportLevel;
  score: number;
  basis: string[];
  evidenceIds: string[];
}

export interface ActionCandidate {
  id: string;
  action: string;
  rationale: string;
  priority: Priority;
  evidenceIds: string[];
  expectedOutcome: string;
  assumptions: string[];
}

export interface DataGap {
  id: string;
  text: string;
}

export interface CausalRulesRef {
  strengths: CausalStrength[];
  forbiddenPhrases: string[];
  claimRule: string;
  supportRule: string;
  activeLinesRule: string;
  numbersRule: string;
}

export interface InvestigationInput {
  investigationId: string;
  generatedFor: { endDate: string; analyzedAt: string };
  entity: { id: string; name: string };
  window: {
    currentStart: string;
    currentEnd: string;
    baselineStart: string;
    baselineEnd: string;
    currentDays: number;
    baselineDays: number;
  };
  outcome: {
    status: "ANOMALY_DECLINE" | "ANOMALY_GROWTH";
    severity: Severity;
    revenueChangePct: number;
    zScore: number | null;
    revenuePerDay: { baseline: number; current: number };
    activeLinesPerDay: {
      baseline: number;
      current: number;
      declineGateApplied: boolean;
    };
  };
  evidenceCatalog: EvidenceFact[];
  signals: { decomposition: DropDecomposition; flags: SignalFlag[] };
  supportProfiles: SupportProfile[];
  recommendationCandidates: ActionCandidate[];
  dataGaps: DataGap[];
  methodology: {
    zScore: string;
    activeProductLines: string;
    severityRule: string;
    decomposition: string;
    supportFormula: string;
  };
  causalityRules: CausalRulesRef;
}

export interface Claim {
  id: string;
  statement: string;
  causalStrength: CausalStrength;
  supportProfileId?: string;
  /** must be a non-empty subset of the input evidenceCatalog ids. */
  evidenceIds: string[];
  reason: string;
}

export interface Recommendation {
  id: string;
  actionTemplateId?: string;
  action: string;
  rationale: string;
  priority: Priority;
  evidenceIds: string[];
  expectedOutcome: string;
  assumptions: string[];
}

export interface InvestigationResult {
  investigationId: string;
  entity: { id: string; name: string };
  executiveSummary: string;
  primaryFinding: Claim;
  contributingFactors: Claim[];
  alternativeHypotheses: Claim[];
  recommendations: Recommendation[];
  limitations: string[];
}

/** Provider-facing prompt, split into the three required sections. */
export interface PromptBundle {
  system: string;
  context: string;
  task: string;
}

/** Raw provider output channel: the provider returns unparsed text. */
export interface ProviderResponse {
  raw: string;
  /** Resolved model used for this call (for display/reporting only). */
  model?: string;
}