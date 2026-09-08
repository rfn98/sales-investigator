/**
 * Provider failure taxonomy. These are structured failures surfaced through
 * runInvestigation outcomes — never secrets, never stack internals.
 */

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationError";
  }
}

export class ProviderTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderTransportError";
  }
}