import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { PromptBundle, ProviderResponse } from "../types";
import {
  ProviderConfigurationError,
  ProviderTransportError,
} from "./errors";
import { registerProvider } from "./interface";
import type { InvestigatorProvider } from "./interface";

/**
 * Real LLM provider via global `fetch` (zero dependency). Talks to any
 * OpenAI-compatible /chat/completions endpoint (default: local 9Router).
 *
 * Boundary: this provider only sends a PromptBundle and returns raw text.
 * It never queries the database, never computes analytics, and never repairs
 * or invents evidence ids — provenance is enforced downstream in validate.ts.
 */

export interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  temperature: number;
  jsonMode: boolean;
}

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  temperature?: number;
  jsonMode?: boolean;
}

function requireEnv(
  value: string | undefined,
  name: string,
  hint: string,
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new ProviderConfigurationError(
      `${name} is not set (${hint}).`,
    );
  }
  return trimmed;
}

function positiveInt(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ProviderConfigurationError(
      `${name} must be a positive number, got "${value}".`,
    );
  }
  return Math.floor(parsed);
}

function finiteNumber(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ProviderConfigurationError(
      `${name} must be a number, got "${value}".`,
    );
  }
  return parsed;
}

export function loadOpenAIConfig(
  env: Readonly<Record<string, string | undefined>>,
): OpenAIProviderConfig {
  const apiKey = requireEnv(
    env.OPENAI_API_KEY,
    "OPENAI_API_KEY",
    "add it to .env or your shell; any placeholder value is accepted for the local 9Router",
  );
  const model = requireEnv(
    env.OPENAI_MODEL,
    "OPENAI_MODEL",
    "e.g. combo-untuk-coding-auto-with-image",
  );
  return {
    apiKey,
    model,
    baseUrl: (env.OPENAI_BASE_URL?.trim() ||
      "http://localhost:20128/v1").replace(/\/+$/, ""),
    timeoutMs: positiveInt(env.OPENAI_TIMEOUT_MS, 60_000, "OPENAI_TIMEOUT_MS"),
    temperature: finiteNumber(env.OPENAI_TEMPERATURE, 0, "OPENAI_TEMPERATURE"),
    jsonMode: env.OPENAI_JSON_MODE?.trim().toLowerCase() === "on",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function contentToString(content: unknown): string | null {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (
        isRecord(part) &&
        part.type === "text" &&
        typeof part.text === "string"
      ) {
        parts.push(part.text);
      }
    }
    return parts.length > 0 ? parts.join("") : null;
  }
  return null;
}

function snippet(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * Best-effort raw-output capture for prompt tuning. Active only when
 * OPENAI_SAVE_RAW=1. Never throws, never writes the API key.
 */
async function maybeSaveRaw(raw: string, model: string): Promise<void> {
  if (process.env.OPENAI_SAVE_RAW?.trim() !== "1") return;
  const dir = process.env.OPENAI_RAW_DIR?.trim() || path.join(os.tmpdir(), "opencode");
  try {
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, `raw-investigator-${stamp}.json`);
    await writeFile(
      file,
      JSON.stringify({ capturedAt: stamp, model, raw }, null, 2),
      "utf8",
    );
    console.error(`[debug] raw investigator response -> ${file}`);
  } catch {
    // capture is best-effort
  }
}

/** Extracts the assistant text from an OpenAI-compatible chat completion. */
export function extractAssistantContent(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const choices = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return null;
  return contentToString(first.message.content);
}

export class OpenAIProvider implements InvestigatorProvider {
  readonly id = "openai";
  private readonly configSource: () => OpenAIProviderConfig;

  constructor(config?: OpenAIProviderConfig) {
    this.configSource = config ? () => config : () => loadOpenAIConfig(process.env);
  }

  /** For display only; null when configuration is invalid. */
  get model(): string | null {
    try {
      return this.configSource().model;
    } catch {
      return null;
    }
  }

  async investigate(bundle: PromptBundle): Promise<ProviderResponse> {
    const config = this.configSource(); // throws ProviderConfigurationError if env incomplete

    const payload: Record<string, unknown> = {
      model: config.model,
      temperature: config.temperature,
      messages: [
        { role: "system", content: bundle.system },
        {
          role: "user",
          content: `${bundle.context}\n\n${bundle.task}`,
        },
      ],
    };
    if (config.jsonMode) {
      payload.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      let res: Response;
      try {
        res = await fetch(
          `${config.baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );
      } catch (error) {
        const name = error instanceof Error ? error.name : undefined;
        throw new ProviderTransportError(
          name === "AbortError"
            ? `LLM request timed out after ${config.timeoutMs}ms.`
            : `Network error calling LLM: ${(error as Error).message}`,
        );
      }

      const text = await res.text();
      if (!res.ok) {
        throw new ProviderTransportError(
          `LLM API returned HTTP ${res.status}: ${snippet(text) || "empty body"}`,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new ProviderTransportError(
          "LLM API returned an invalid JSON body at HTTP 200.",
        );
      }

      const content = extractAssistantContent(parsed);
      if (content === null || content.trim().length === 0) {
        throw new ProviderTransportError(
          "LLM response contained no usable content (choices[0].message.content).",
        );
      }

      const responseModel =
        isRecord(parsed) && typeof parsed.model === "string"
          ? parsed.model
          : config.model;

      const raw = content.trim();
      await maybeSaveRaw(raw, responseModel);

      return { raw, model: responseModel };
    } finally {
      clearTimeout(timer);
    }
  }
}

registerProvider("openai", () => new OpenAIProvider());