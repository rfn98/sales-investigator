import type {
  PromptBundle,
  ProviderResponse,
} from "../types";

/**
 * Provider abstraction. A provider receives the prepared PromptBundle and
 * returns raw text via `investigate`. Parsing and validation happen in the
 * orchestrator, not in the provider. Providers never query the database and
 * never compute analytics.
 */

export interface InvestigatorProvider {
  readonly id: string;
  /** Resolved model for display/reporting; optional on the interface. */
  readonly model?: string | null;
  investigate(bundle: PromptBundle): Promise<ProviderResponse>;
}

export class ProviderNotImplementedError extends Error {
  constructor(providerId: string) {
    super(`Investigator provider "${providerId}" is not implemented (stub only).`);
    this.name = "ProviderNotImplementedError";
  }
}

const registry = new Map<string, () => InvestigatorProvider>();

export function registerProvider(
  id: string,
  factory: () => InvestigatorProvider,
): void {
  registry.set(id, factory);
}

export function availableProviderIds(): string[] {
  return [...registry.keys()];
}

export function getProvider(providerId: string): InvestigatorProvider {
  const factory = registry.get(providerId);
  if (!factory) {
    throw new Error(
      `Unknown investigator provider "${providerId}". Available: ${availableProviderIds().join(", ") || "(none)"}.`,
    );
  }
  return factory();
}

export function createInvestigator(
  providerId = "none",
): InvestigatorProvider {
  return getProvider(providerId);
}

/** Stub provider: cannot run investigations (offline/no-provider mode). */
class NoneProvider implements InvestigatorProvider {
  readonly id = "none";

  async investigate(
    _bundle: PromptBundle,
  ): Promise<ProviderResponse> {
    throw new ProviderNotImplementedError("none");
  }
}

registerProvider("none", () => new NoneProvider());

// Re-exported for prompt builders that construct bundles independently.
export type { PromptBundle } from "../types";