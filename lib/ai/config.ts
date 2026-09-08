import { availableProviderIds } from "./providers/interface";

export interface UiProviderResolution {
  providerId: string;
  /** Present when the caller should surface a configuration warning. */
  configError?: string;
}

/**
 * Server-side provider selection for the web UI. Mirrors the CLI precedence:
 * explicit AI_PROVIDER (validated) first, then openai automatically when both
 * OPENAI_API_KEY and OPENAI_MODEL are set (so the UI follows .env), and "none"
 * (offline mode) otherwise.
 *
 * Pure: read env at the call site and pass it in, so unit tests can inject it.
 * Never exposes the API key - only booleans decide the choice.
 */
export function resolveUiProvider(
  env: Readonly<Record<string, string | undefined>>,
): UiProviderResolution {
  const explicit = env.AI_PROVIDER?.trim();
  if (explicit) {
    if (availableProviderIds().includes(explicit)) {
      return { providerId: explicit };
    }
    return {
      providerId: "none",
      configError: `Unknown AI_PROVIDER '${explicit}'. Available: ${availableProviderIds().join(", ")}. Fell back to 'none'.`,
    };
  }

  const hasKey = !!env.OPENAI_API_KEY?.trim();
  const hasModel = !!env.OPENAI_MODEL?.trim();
  if (hasKey && hasModel) {
    return { providerId: "openai" };
  }

  const missing: string[] = [];
  if (!hasKey) missing.push("OPENAI_API_KEY");
  if (!hasModel) missing.push("OPENAI_MODEL");
  return {
    providerId: "none",
    configError: `OpenAI not configured (missing ${missing.join(", ")} in .env). Running in offline/deterministic mode.`,
  };
}