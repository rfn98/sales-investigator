import type {
  Claim,
  InvestigationInput,
  InvestigationResult,
  Recommendation,
} from "./types";
import { CAUSALITY_RULES } from "./buildInput";

/**
 * Phrases that over-attribute causality. Combined with the rules in
 * CAUSALITY_RULES, these reject "this factor alone / entirely caused the
 * movement" claims even when the underlying facts are real.
 */
export const CAUSALITY_OVERCLAIM_PHRASES = [
  "caused the entire",
  "solely caused",
  "only cause of the",
  "explains the whole",
  "single reason for the",
];

export const DEFAULT_FORBIDDEN_PHRASES = [
  ...CAUSALITY_RULES.forbiddenPhrases,
  ...CAUSALITY_OVERCLAIM_PHRASES,
];

export type ValidationFailure =
  | { ok: false; issues: string[] }
  | { ok: true; result: InvestigationResult };

/**
 * Parses raw provider text into an unknown value. Tolerates a single
 * ```json ... ``` code fence; otherwise expects a standalone JSON object.
 */
export function parseInvestigationOutput(raw: string): {
  ok: true;
  value: unknown;
} | { ok: false; error: string } {
  const cleaned = raw
    .replace(/```(?:json)?\s*([\s\S]*?)```/gi, "$1")
    .trim();

  if (!cleaned) {
    return { ok: false, error: "Empty provider output; no JSON object found." };
  }

  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch (error) {
    return {
      ok: false,
      error: `Provider output is not valid JSON: ${(error as Error).message}`,
    };
  }
}

const CAUSAL_STRENGTHS: Claim["causalStrength"][] = [
  "fact",
  "supports",
  "possible",
];
const PRIORITIES: Recommendation["priority"][] = ["high", "medium", "low"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function collectClaimIssues(
  issues: string[],
  label: string,
  value: unknown,
  catalogIds: Set<string>,
  allowedCatalogIds: string[],
  supportProfileIds: Set<string>,
  allowedSupportProfileIds: string[],
  forbidden: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${label}: must be an object.`);
    return;
  }

  const statement = value.statement;
  const strength = value.causalStrength;
  const evidenceIds = value.evidenceIds;
  const reason = value.reason;
  const supportProfileId = value.supportProfileId;

  if (typeof statement !== "string" || statement.trim().length === 0) {
    issues.push(`${label}: statement must be a non-empty string.`);
  }
  if (
    typeof strength !== "string" ||
    !CAUSAL_STRENGTHS.includes(strength as Claim["causalStrength"])
  ) {
    issues.push(
      `${label}: causalStrength must be one of ${CAUSAL_STRENGTHS.join(", ")}.`,
    );
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    issues.push(`${label}: reason must be a non-empty string.`);
  }
  if (
    !isStringArray(evidenceIds) ||
    evidenceIds.length === 0 ||
    !evidenceIds.every((id) => catalogIds.has(id))
  ) {
    issues.push(
      `${label}: evidenceIds must be a non-empty array whose entries all exist in evidenceCatalog. Allowed ids: ${allowedCatalogIds.join(", ")}.`,
    );
  }
  if (supportProfileId !== undefined) {
    if (typeof supportProfileId !== "string" || !supportProfileIds.has(supportProfileId)) {
      issues.push(
        `${label}: supportProfileId (${String(supportProfileId)}) is not one of the precomputed supportProfile ids. Allowed supportProfile ids: ${allowedSupportProfileIds.join(", ")}.`,
      );
    }
    if (strength === "fact" && supportProfileId !== undefined) {
      issues.push(
        `${label}: facts restate measurements and do not take a supportProfileId (confidence applies to causal claims).`,
      );
    }
  }

  for (const field of [statement, reason]) {
    if (typeof field !== "string") continue;
    for (const phrase of forbidden) {
      if (field.toLowerCase().includes(phrase.toLowerCase())) {
        issues.push(
          `${label}: forbidden phrase "${phrase}" appears in text.`,
        );
      }
    }
  }
}

function collectRecommendationIssues(
  issues: string[],
  label: string,
  value: unknown,
  catalogIds: Set<string>,
  allowedCatalogIds: string[],
  actionTemplateIds: Set<string>,
  allowedActionTemplateIds: string[],
  forbidden: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${label}: must be an object.`);
    return;
  }

  const action = value.action;
  const actionTemplateId = value.actionTemplateId;
  const rationale = value.rationale;
  const priority = value.priority;
  const evidenceIds = value.evidenceIds;
  const expectedOutcome = value.expectedOutcome;
  const assumptions = value.assumptions;

  if (typeof action !== "string" || action.trim().length === 0) {
    issues.push(`${label}: action must be a non-empty string.`);
  }
  if (actionTemplateId !== undefined) {
    if (
      typeof actionTemplateId !== "string" ||
      !actionTemplateIds.has(actionTemplateId)
    ) {
      issues.push(
        `${label}: actionTemplateId must reference a recommendationCandidates id. Allowed actionTemplate ids: ${allowedActionTemplateIds.join(", ")}.`,
      );
    }
  }
  if (typeof rationale !== "string" || rationale.trim().length === 0) {
    issues.push(`${label}: rationale must be a non-empty string.`);
  }
  if (
    typeof priority !== "string" ||
    !PRIORITIES.includes(priority as Recommendation["priority"])
  ) {
    issues.push(`${label}: priority must be one of ${PRIORITIES.join(", ")}.`);
  }
  if (
    !isStringArray(evidenceIds) ||
    evidenceIds.length === 0 ||
    !evidenceIds.every((id) => catalogIds.has(id))
  ) {
    issues.push(
      `${label}: evidenceIds must be a non-empty array whose entries all exist in evidenceCatalog. Allowed ids: ${allowedCatalogIds.join(", ")}.`,
    );
  }
  if (typeof expectedOutcome !== "string" || expectedOutcome.trim().length === 0) {
    issues.push(`${label}: expectedOutcome must be a non-empty string.`);
  }
  if (!isStringArray(assumptions)) {
    issues.push(`${label}: assumptions must be an array of strings (may be empty).`);
  }

  for (const field of [action, rationale]) {
    if (typeof field !== "string") continue;
    for (const phrase of forbidden) {
      if (field.toLowerCase().includes(phrase.toLowerCase())) {
        issues.push(
          `${label}: forbidden phrase "${phrase}" appears in text.`,
        );
      }
    }
  }
}

/**
 * Structural + provenance validation of a parsed provider result against the
 * InvestigationInput it was generated from. Rejects unanchored claims.
 */
export function validateInvestigationResult(
  input: InvestigationInput,
  parsed: unknown,
  forbiddenPhrases: string[] = DEFAULT_FORBIDDEN_PHRASES,
): ValidationFailure {
  const issues: string[] = [];
  const catalogIds = new Set(input.evidenceCatalog.map((f) => f.id));
  const allowedCatalogIds = input.evidenceCatalog.map((f) => f.id);
  const supportProfileIds = new Set(input.supportProfiles.map((p) => p.id));
  const allowedSupportProfileIds = input.supportProfiles.map((p) => p.id);
  const actionTemplateIds = new Set(
    input.recommendationCandidates.map((c) => c.id),
  );
  const allowedActionTemplateIds = input.recommendationCandidates.map(
    (c) => c.id,
  );

  if (!isRecord(parsed)) {
    return {
      ok: false,
      issues: [
        "Provider output must be a single JSON object (investigation result).",
      ],
    };
  }

  if (parsed.investigationId !== input.investigationId) {
    issues.push(
      `investigationId mismatch: expected ${input.investigationId}, got ${String(parsed.investigationId)}.`,
    );
  }

  const entity = parsed.entity;
  if (
    !isRecord(entity) ||
    entity.id !== input.entity.id ||
    entity.name !== input.entity.name
  ) {
    issues.push(
      "entity must match the contract (id and exact outlet name).",
    );
  }

  const executiveSummary = parsed.executiveSummary;
  if (
    typeof executiveSummary !== "string" ||
    executiveSummary.trim().length === 0
  ) {
    issues.push("executiveSummary must be a non-empty string.");
  } else {
    for (const phrase of forbiddenPhrases) {
      if (executiveSummary.toLowerCase().includes(phrase.toLowerCase())) {
        issues.push(
          `executiveSummary: forbidden phrase "${phrase}" appears in text.`,
        );
      }
    }
  }

  collectClaimIssues(
    issues,
    "primaryFinding",
    parsed.primaryFinding,
    catalogIds,
    allowedCatalogIds,
    supportProfileIds,
    allowedSupportProfileIds,
    forbiddenPhrases,
  );

  if (!Array.isArray(parsed.contributingFactors)) {
    issues.push("contributingFactors must be an array.");
  } else {
    parsed.contributingFactors.forEach((claim, index) =>
      collectClaimIssues(
        issues,
        `contributingFactors[${index}]`,
        claim,
        catalogIds,
        allowedCatalogIds,
        supportProfileIds,
        allowedSupportProfileIds,
        forbiddenPhrases,
      ),
    );
  }

  if (!Array.isArray(parsed.alternativeHypotheses)) {
    issues.push("alternativeHypotheses must be an array.");
  } else {
    parsed.alternativeHypotheses.forEach((claim, index) =>
      collectClaimIssues(
        issues,
        `alternativeHypotheses[${index}]`,
        claim,
        catalogIds,
        allowedCatalogIds,
        supportProfileIds,
        allowedSupportProfileIds,
        forbiddenPhrases,
      ),
    );
  }

  if (!Array.isArray(parsed.recommendations)) {
    issues.push("recommendations must be an array.");
  } else {
    parsed.recommendations.forEach((rec, index) =>
      collectRecommendationIssues(
        issues,
        `recommendations[${index}]`,
        rec,
        catalogIds,
        allowedCatalogIds,
        actionTemplateIds,
        allowedActionTemplateIds,
        forbiddenPhrases,
      ),
    );
  }

  if (!isStringArray(parsed.limitations)) {
    issues.push("limitations must be an array of strings (may be empty).");
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, result: parsed as unknown as InvestigationResult };
}