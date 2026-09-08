export * from "./types";
export {
  buildInvestigationInputs,
  CAUSALITY_RULES,
} from "./buildInput";
export * from "./evidence";
export * from "./gaps";
export * from "./signals";
export * from "./support";
export * from "./recommendations";
export { buildInvestigationPrompt } from "./prompts";
export {
  parseInvestigationOutput,
  validateInvestigationResult,
} from "./validate";
export { runInvestigation, runOutletInvestigation } from "./investigate";
export type { RunInvestigationOptions, InvestigationOutcome } from "./investigate";
export { resolveUiProvider } from "./config";
export type { UiProviderResolution } from "./config";
export {
  registerProvider,
  availableProviderIds,
  getProvider,
  createInvestigator,
} from "./providers/interface";
export type { InvestigatorProvider } from "./providers/interface";
export { ProviderNotImplementedError } from "./providers/interface";
export {
  ProviderConfigurationError,
  ProviderTransportError,
} from "./providers/errors";

// Side-effect: registers the "openai" provider in the shared registry.
import "./providers/openai";
export {
  OpenAIProvider,
  loadOpenAIConfig,
  extractAssistantContent,
} from "./providers/openai";
export type {
  OpenAIProviderConfig,
  OpenAIProviderOptions,
} from "./providers/openai";