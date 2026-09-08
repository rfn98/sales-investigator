import type { Report } from "../analytics/types";
import { buildInvestigationInputs } from "./buildInput";
import { buildInvestigationPrompt } from "./prompts";
import { parseInvestigationOutput, validateInvestigationResult } from "./validate";
import { getProvider } from "./providers/interface";
import type { InvestigatorProvider } from "./providers/interface";
import type { InvestigationInput, InvestigationResult } from "./types";

export interface RunInvestigationOptions {
  providerId?: string;
  /**
   * Re-attempt once (bounded) with validation feedback when the first attempt
   * fails validation. Default true. Never repairs evidence ids silently - the
   * model must correct its own output, and the result is re-validated strictly.
   */
  retryOnFailure?: boolean;
  /** Total attempts per outlet (max 2 by default = 1 retry). */
  maxAttempts?: number;
}

export interface InvestigationOutcome {
  input: InvestigationInput;
  providerId: string;
  /** Model reported by the provider (display only). */
  model?: string;
  /** How many attempts ran for this outlet (1, or 2 when a retry happened). */
  attempts?: number;
  ok: boolean;
  result: InvestigationResult | null;
  errors: string[];
}

function failWith(
  providerId: string,
  input: InvestigationInput,
  errors: string[],
): InvestigationOutcome {
  return {
    input,
    providerId,
    ok: false,
    result: null,
    errors,
  };
}

async function runAttempt(
  input: InvestigationInput,
  provider: InvestigatorProvider,
  bundle: ReturnType<typeof buildInvestigationPrompt>,
  providerId: string,
  attemptNo: number,
): Promise<InvestigationOutcome> {
  try {
    const response = await provider.investigate(bundle);
    const parsed = parseInvestigationOutput(response.raw);
    if (!parsed.ok) {
      return {
        input,
        providerId,
        model: response.model,
        attempts: attemptNo,
        ok: false,
        result: null,
        errors: [parsed.error],
      };
    }
    const validation = validateInvestigationResult(input, parsed.value);
    if (!validation.ok) {
      return {
        input,
        providerId,
        model: response.model,
        attempts: attemptNo,
        ok: false,
        result: null,
        errors: validation.issues,
      };
    }
    return {
      input,
      providerId,
      model: response.model,
      attempts: attemptNo,
      ok: true,
      result: validation.result,
      errors: [],
    };
  } catch (error) {
    return {
      input,
      providerId,
      model: provider.model ?? undefined,
      attempts: attemptNo,
      ok: false,
      result: null,
      errors: [(error as Error).message],
    };
  }
}

/**
 * Single-input attempt sequence: one call, then one bounded retry (with
 * validation feedback) unless retryOnFailure/maxAttempts say otherwise.
 */
async function attemptSequence(
  input: InvestigationInput,
  provider: InvestigatorProvider,
  providerId: string,
  retryOnFailure: boolean,
  maxAttempts: number,
): Promise<InvestigationOutcome> {
  const first = await runAttempt(
    input,
    provider,
    buildInvestigationPrompt(input),
    providerId,
    1,
  );

  if (first.ok || !retryOnFailure || maxAttempts < 2) {
    return first;
  }

  const repairBundle = buildInvestigationPrompt(input, first.errors);
  return runAttempt(input, provider, repairBundle, providerId, 2);
}

/**
 * Orchestrator. Always-valid inputs are produced from a Report; the declared
 * provider (default "none", the stub) is responsible only for text generation.
 * Post-processing (parse + provenance validation) is done here, deterministically.
 *
 * Flow: input -> PromptBundle -> provider -> raw -> parse -> validate -> reject.
 * On the first validation/parse failure the model gets one bounded chance to
 * correct with explicit feedback; the corrected output is re-validated strictly.
 * Evidence ids are NEVER silently repaired - forged ids always fail.
 */
export async function runInvestigation(
  report: Report,
  options: RunInvestigationOptions = {},
): Promise<InvestigationOutcome[]> {
  const providerId = options.providerId ?? "none";
  const inputs = buildInvestigationInputs(report);
  const retryOnFailure = options.retryOnFailure ?? true;
  const maxAttempts = options.maxAttempts ?? 2;

  if (providerId === "none") {
    return inputs.map((input) =>
      failWith(providerId, input, [
        "Provider 'none' is a stub and does not run an LLM investigation (offline/deterministic mode). Use AI_PROVIDER=openai with OPENAI_API_KEY and OPENAI_MODEL set to run a real investigation.",
      ]),
    );
  }

  const provider = getProvider(providerId);
  const outcomes: InvestigationOutcome[] = [];

  for (const input of inputs) {
    outcomes.push(
      await attemptSequence(input, provider, providerId, retryOnFailure, maxAttempts),
    );
  }

  return outcomes;
}

/**
 * Single-outlet variant for per-outlet UIs: builds all inputs from the Report,
 * picks only the target outlet (by stable entity id), and runs the bounded
 * attempt sequence for it, so a page visit costs 1-2 LLM calls at most.
 * Returns null when the entity is not present in the Report.
 */
export async function runOutletInvestigation(
  report: Report,
  entityId: string,
  options: RunInvestigationOptions = {},
): Promise<InvestigationOutcome | null> {
  const providerId = options.providerId ?? "none";
  const input = buildInvestigationInputs(report).find(
    (candidate) => candidate.entity.id === entityId,
  );
  if (!input) return null;

  if (providerId === "none") {
    return failWith(providerId, input, [
      "Provider 'none' is a stub and does not run an LLM investigation (offline/deterministic mode). Use AI_PROVIDER=openai with OPENAI_API_KEY and OPENAI_MODEL set to run a real investigation.",
    ]);
  }

  const retryOnFailure = options.retryOnFailure ?? true;
  const maxAttempts = options.maxAttempts ?? 2;
  return attemptSequence(
    input,
    getProvider(providerId),
    providerId,
    retryOnFailure,
    maxAttempts,
  );
}